import { describe, expect, it, vi } from "vitest";

const {
  resolveDynamicForbiddenTokens,
  resolveForbiddenTokens,
  runForbiddenTokenCheck,
} = await import("../../../scripts/check-forbidden-tokens.mjs");

describe("forbidden token check", () => {
  it("derives username tokens without relying on whoami", () => {
    const tokens = resolveDynamicForbiddenTokens(
      { USER: "paperclip", LOGNAME: "paperclip", USERNAME: "pc" },
      {
        userInfo: () => ({ username: "paperclip" }),
      },
    );

    expect(tokens).toEqual(["paperclip", "pc"]);
  });

  it("falls back cleanly when user resolution fails", () => {
    const tokens = resolveDynamicForbiddenTokens(
      {},
      {
        userInfo: () => {
          throw new Error("missing user");
        },
      },
    );

    expect(tokens).toEqual([]);
  });

  it("merges dynamic and file-based forbidden tokens", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");

    const tokensFile = path.join(os.tmpdir(), `forbidden-tokens-${Date.now()}.txt`);
    fs.writeFileSync(tokensFile, "# comment\npaperclip\ncustom-token\n");

    try {
      const tokens = resolveForbiddenTokens(tokensFile, { USER: "paperclip" }, {
        userInfo: () => ({ username: "paperclip" }),
      });

      expect(tokens).toEqual(["paperclip", "custom-token"]);
    } finally {
      fs.unlinkSync(tokensFile);
    }
  });

  it("reports matches without leaking which token was searched", () => {
    const exec = vi
      .fn()
      .mockReturnValue(Buffer.from("server/file.ts\0"));
    const log = vi.fn();
    const error = vi.fn();

    const exitCode = runForbiddenTokenCheck({
      repoRoot: "/repo",
      tokens: ["found", "custom-token"],
      exec,
      log,
      error,
      lstat: () => ({ isFile: () => true, isSymbolicLink: () => false }),
      readFile: () => Buffer.from("found\n"),
    });

    expect(exitCode).toBe(1);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("ERROR: Forbidden tokens found in tracked files:\n");
    expect(error).toHaveBeenCalledWith("  server/file.ts:1:found");
    expect(error).toHaveBeenCalledWith("\nBuild blocked. Remove the forbidden token(s) before publishing.");
  });

  it("scans tracked text regardless of attributes or isolated NUL bytes", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { execFileSync, execSync } = await import("node:child_process");

    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forbidden-tokens-"));
    const token = "forbidden-token";
    const commands: string[] = [];
    const exec: typeof execSync = ((command: string, options?: Parameters<typeof execSync>[1]) => {
      commands.push(command);
      return execSync(command, options);
    }) as typeof execSync;

    try {
      execFileSync("git", ["init", "--quiet", repoRoot]);
      fs.writeFileSync(path.join(repoRoot, "tracked-text"), `${token}\n`);
      fs.writeFileSync(path.join(repoRoot, ".gitattributes"), "attribute-text -diff\n");
      fs.writeFileSync(path.join(repoRoot, "attribute-text"), `${token}\n`);
      fs.writeFileSync(path.join(repoRoot, "nul-text"), `safe\0${token}\n`);
      const mixedCaseToken = `${"\u0400".repeat(20)}FoRbIdDeN-ToKeN\n`;
      const utf16le = Buffer.from(mixedCaseToken, "utf16le");
      const utf16be = Buffer.from(utf16le).swap16();
      fs.writeFileSync(path.join(repoRoot, "utf16le-text"), utf16le);
      fs.writeFileSync(path.join(repoRoot, "utf16be-text"), utf16be);
      fs.writeFileSync(path.join(repoRoot, "utf16le-bom-text"), Buffer.concat([Buffer.from([0xff, 0xfe]), utf16le]));
      fs.writeFileSync(path.join(repoRoot, "utf16be-bom-text"), Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be]));
      fs.writeFileSync(
        path.join(repoRoot, "tracked-png"),
        Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]),
          Buffer.alloc(1024, 0xff),
          Buffer.from(token),
        ]),
      );
      execFileSync("git", ["-C", repoRoot, "add", ".gitattributes", "attribute-text", "nul-text", "tracked-text", "tracked-png", "utf16le-text", "utf16be-text", "utf16le-bom-text", "utf16be-bom-text"]);

      const textError = vi.fn();
      expect(runForbiddenTokenCheck({ repoRoot, tokens: [token], exec, error: textError })).toBe(1);
      expect(textError).toHaveBeenCalledWith(expect.stringContaining("tracked-text"));
      expect(textError).toHaveBeenCalledWith(expect.stringContaining("attribute-text"));
      expect(textError).toHaveBeenCalledWith(expect.stringContaining("nul-text"));
      expect(textError).toHaveBeenCalledWith(expect.stringContaining("utf16le-text"));
      expect(textError).toHaveBeenCalledWith(expect.stringContaining("utf16be-text"));
      expect(textError).toHaveBeenCalledWith(expect.stringContaining("utf16le-bom-text"));
      expect(textError).toHaveBeenCalledWith(expect.stringContaining("utf16be-bom-text"));
      expect(textError).not.toHaveBeenCalledWith(expect.stringContaining("tracked-png"));

      execFileSync("git", ["-C", repoRoot, "rm", "--cached", "attribute-text", "nul-text", "tracked-text", "utf16le-text", "utf16be-text", "utf16le-bom-text", "utf16be-bom-text"]);

      expect(runForbiddenTokenCheck({ repoRoot, tokens: [token], exec, error: vi.fn() })).toBe(0);
      expect(commands).toHaveLength(2);
      for (const command of commands) {
        expect(command).toContain("git ls-files -z");
        expect(command).toContain("':!pnpm-lock.yaml' ':!.git'");
        expect(command).not.toMatch(/\*\.(png|jpg|jpeg|gif|webp)/i);
      }
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
