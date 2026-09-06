#!/usr/bin/env node
/**
 * check-forbidden-tokens.mjs
 *
 * Scans the codebase for forbidden tokens before publishing to npm.
 * Mirrors the git pre-commit hook logic, but runs against the full
 * working tree (not just staged changes).
 *
 * Token list: .git/hooks/forbidden-tokens.txt (one per line, # comments ok).
 * If the file is missing, the check still uses the active local username when
 * available. If username detection fails, the check degrades gracefully.
 */

import { execSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function uniqueNonEmpty(values) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)));
}

export function resolveDynamicForbiddenTokens(env = process.env, osModule = os) {
  const candidates = [env.USER, env.LOGNAME, env.USERNAME];

  try {
    candidates.push(osModule.userInfo().username);
  } catch {
    // Some environments do not expose userInfo; env vars are enough fallback.
  }

  return uniqueNonEmpty(candidates);
}

export function readForbiddenTokensFile(tokensFile) {
  if (!existsSync(tokensFile)) return [];

  return readFileSync(tokensFile, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function resolveForbiddenTokens(tokensFile, env = process.env, osModule = os) {
  return uniqueNonEmpty([
    ...resolveDynamicForbiddenTokens(env, osModule),
    ...readForbiddenTokensFile(tokensFile),
  ]);
}

function isConfidentlyBinary(content) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(content);
    return false;
  } catch {
    // Invalid UTF-8 alone is ambiguous; require a high density of binary bytes.
  }

  if (content.length < 64) return false;

  let binaryBytes = 0;
  for (const byte of content) {
    if ((byte < 0x09 && byte !== 0x00) || (byte > 0x0d && byte < 0x20) || byte >= 0x7f) {
      binaryBytes += 1;
    }
  }
  return binaryBytes / content.length >= 0.3;
}

function looksLikeUtf16(content, zeroOffset) {
  const pairs = Math.floor(content.length / 2);
  if (pairs < 4) return false;

  let zeroes = 0;
  let textBytes = 0;
  for (let index = 0; index < pairs * 2; index += 2) {
    const textByte = content[index + (zeroOffset === 0 ? 1 : 0)];
    if (content[index + zeroOffset] === 0x00) zeroes += 1;
    if (textByte === 0x09 || textByte === 0x0a || textByte === 0x0d || (textByte >= 0x20 && textByte <= 0x7e)) {
      textBytes += 1;
    }
  }
  return zeroes / pairs >= 0.6 && textBytes / pairs >= 0.6;
}

function decodeUtf16Be(content) {
  const evenLength = content.length - (content.length % 2);
  const littleEndian = Buffer.allocUnsafe(evenLength);
  for (let index = 0; index < evenLength; index += 2) {
    littleEndian[index] = content[index + 1];
    littleEndian[index + 1] = content[index];
  }
  return new TextDecoder("utf-16le").decode(littleEndian);
}

function hasUtf16TokenEvidence(content, tokens, zeroOffset) {
  for (const token of tokens) {
    if (![...token].every((character) => character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) <= 0x7e)) continue;

    for (let index = 0; index <= content.length - token.length * 2; index += 2) {
      let matches = true;
      for (let offset = 0; offset < token.length; offset += 1) {
        const textByte = content[index + offset * 2 + (zeroOffset === 0 ? 1 : 0)];
        const lowerByte = textByte >= 0x41 && textByte <= 0x5a ? textByte + 0x20 : textByte;
        if (content[index + offset * 2 + zeroOffset] !== 0x00 || lowerByte !== token.charCodeAt(offset)) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
  }
  return false;
}

function decodeText(content, tokens) {
  if (content[0] === 0xff && content[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(content.subarray(2));
  }
  if (content[0] === 0xfe && content[1] === 0xff) {
    return decodeUtf16Be(content.subarray(2));
  }
  if (looksLikeUtf16(content, 1) || hasUtf16TokenEvidence(content, tokens, 1)) {
    return new TextDecoder("utf-16le").decode(content);
  }
  if (looksLikeUtf16(content, 0) || hasUtf16TokenEvidence(content, tokens, 0)) return decodeUtf16Be(content);
  return null;
}

function listTrackedPaths(repoRoot, exec) {
  const output = exec("git ls-files -z -- ':!pnpm-lock.yaml' ':!.git'", {
    encoding: "buffer",
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return Buffer.from(output).toString("utf8").split("\0").filter(Boolean);
}

function readTrackedContent(repoRoot, trackedPath, lstat, readFile, readlink) {
  const filePath = resolve(repoRoot, trackedPath);
  if (filePath !== repoRoot && !filePath.startsWith(`${repoRoot}/`)) {
    throw new Error("tracked path resolves outside the repository");
  }

  const stat = lstat(filePath);
  if (stat.isSymbolicLink()) return Buffer.from(readlink(filePath));
  if (!stat.isFile()) throw new Error("tracked entry is not a regular file or symbolic link");
  return readFile(filePath);
}

export function runForbiddenTokenCheck({
  repoRoot,
  tokens,
  exec = execSync,
  log = console.log,
  error = console.error,
  lstat = lstatSync,
  readFile = readFileSync,
  readlink = readlinkSync,
}) {
  if (tokens.length === 0) {
    log("  ℹ  Forbidden tokens list is empty — skipping check.");
    return 0;
  }

  let paths;
  try {
    paths = listTrackedPaths(repoRoot, exec);
  } catch (scanError) {
    error(`ERROR: Unable to enumerate tracked files: ${scanError.message}`);
    error("\nBuild blocked. Remove the forbidden token(s) before publishing.");
    return 1;
  }

  const normalizedTokens = tokens.map((token) => token.toLowerCase());
  const matches = [];

  for (const trackedPath of paths) {
    let content;
    try {
      content = readTrackedContent(repoRoot, trackedPath, lstat, readFile, readlink);
    } catch (scanError) {
      error(`ERROR: Unable to scan tracked file ${trackedPath}: ${scanError.message}`);
      error("\nBuild blocked. Remove the forbidden token(s) before publishing.");
      return 1;
    }
    const text = decodeText(content, normalizedTokens);
    if (text === null && isConfidentlyBinary(content)) continue;

    const lines = (text ?? new TextDecoder("utf-8").decode(content)).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (normalizedTokens.some((token) => lines[index].toLowerCase().includes(token))) {
        matches.push(`${trackedPath}:${index + 1}:${lines[index].replaceAll("\0", "\\0")}`);
      }
    }
  }

  if (matches.length > 0) {
    error("ERROR: Forbidden tokens found in tracked files:\n");
    for (const match of matches) {
      error(`  ${match}`);
    }
    error("\nBuild blocked. Remove the forbidden token(s) before publishing.");
    return 1;
  }

  log("  ✓  No forbidden tokens found.");
  return 0;
}

function resolveRepoPaths(exec = execSync) {
  const repoRoot = exec("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  const gitDir = exec("git rev-parse --git-dir", { encoding: "utf8", cwd: repoRoot }).trim();
  return {
    repoRoot,
    tokensFile: resolve(repoRoot, gitDir, "hooks/forbidden-tokens.txt"),
  };
}

function main() {
  const { repoRoot, tokensFile } = resolveRepoPaths();
  const tokens = resolveForbiddenTokens(tokensFile);
  process.exit(runForbiddenTokenCheck({ repoRoot, tokens }));
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}
