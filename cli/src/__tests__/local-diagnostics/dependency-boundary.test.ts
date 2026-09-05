import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { productManifest } from "./product-manifest.js";

const scanner = () => import("./scanner.js").catch(() => undefined);
const names = (findings: Array<{ file: string; line: number; reason: string; specifier: string | null }>) => findings.map(({ file, line, reason, specifier }) => `${basename(file)}:${line}:${specifier}:${reason}`);
const censusProductSources = (productDirectory: string): string[] => {
  const sources: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        sources.push(relative(productDirectory, path));
      }
    }
  };

  visit(productDirectory);
  return sources.sort();
};
const importSpecifiers = (file: string): string[] => {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  source.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const location = source.getLineAndCharacterOfPosition(node.moduleSpecifier.getStart(source));
      specifiers.push(`${basename(file)}:${location.line + 1}:${node.moduleSpecifier.text}`);
    }
  });
  return specifiers;
};

describe("local-diagnostics dependency boundary", () => {
  it("accepts the real seven-file product set and exposes every allowed import", async () => {
    const loaded = await scanner();
    expect(loaded).toBeDefined();
    expect(loaded!.scanProduct(productManifest)).toEqual([]);
  });

  it("matches the local-diagnostics TypeScript census to the exact product manifest", () => {
    const productDirectory = dirname(productManifest[0]!);
    expect(censusProductSources(productDirectory)).toEqual(productManifest.map((file) => relative(productDirectory, file)).sort());
  });

  it("includes nested TypeScript product sources in the census", () => {
    const directory = mkdtempSync(join(tmpdir(), "pc-ld-boundary-"));
    try {
      mkdirSync(join(directory, "nested"));
      writeFileSync(join(directory, "root.ts"), "export {};");
      writeFileSync(join(directory, "nested", "source.ts"), "export {};");
      expect(censusProductSources(directory)).toEqual(["nested/source.ts", "root.ts"]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("pins every ImportDeclaration specifier in the seven-file product set", () => {
    expect(productManifest.flatMap(importSpecifiers)).toEqual([
      "index.ts:1:./local-diagnostics.js",
      "index.ts:2:./build-metadata.js",
      "index.ts:3:./schema.js",
      "local-diagnostics.ts:1:./core.js",
      "local-diagnostics.ts:2:./renderers.js",
      "local-diagnostics.ts:3:./schema.js",
      "core.ts:1:./matrix.js",
      "core.ts:2:./schema.js",
      "matrix.ts:1:./schema.js",
      "renderers.ts:1:./schema.js",
    ]);
  });

  it("reports every schema importer when schema.ts is absent", async () => {
    const loaded = await scanner();
    const findings = loaded!.scanProduct(productManifest.filter((file) => !file.endsWith("schema.ts")));
    expect(names(findings)).toEqual([
      "index.ts:3:./schema.js:specifier-not-in-product-set",
      "local-diagnostics.ts:3:./schema.js:specifier-not-in-product-set",
      "core.ts:2:./schema.js:specifier-not-in-product-set",
      "matrix.ts:1:./schema.js:specifier-not-in-product-set",
      "renderers.ts:1:./schema.js:specifier-not-in-product-set",
    ]);
  });

  it("detects the eleven banned globals from AST reference sites", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([{ file: resolve(root, "control.ts"), source: "setTimeout; setInterval; setImmediate; queueMicrotask; fetch; WebSocket; AbortController; AbortSignal; MessageChannel; MessagePort; Atomics;" }], root);
    expect(findings).toHaveLength(11);
    expect(findings.map((finding: { reason: string }) => finding.reason)).toEqual(["setTimeout", "setInterval", "setImmediate", "queueMicrotask", "fetch", "WebSocket", "AbortController", "AbortSignal", "MessageChannel", "MessagePort", "Atomics"].map((name) => `banned-identifier:${name}`));
  });

  it("reports banned members in destructured aliases", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([{ file: resolve(root, "control.ts"), source: 'const { constructor: compile } = (() => {});\ncompile("return 1")();\nconst { "__proto__": prototype } = {};\nconst { constructor } = {};\nconst { __proto__ } = {};' }], root);
    expect(findings.map((finding: { line: number; column: number; reason: string }) => `${finding.line}:${finding.column}:${finding.reason}`)).toEqual([
      "1:9:banned-member:constructor",
      "3:9:banned-member:__proto__",
      "4:9:banned-member:constructor",
      "5:9:banned-member:__proto__",
    ]);
  });

  it("does not treat array destructuring bindings as banned members", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([{ file: resolve(root, "control.ts"), source: "const [constructor, __proto__] = values; const ordinary = { constructor: value, require: module };" }], root);
    expect(findings).toEqual([]);
  });

  it("reports nested assignment patterns without classifying binary object literals", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([{ file: resolve(root, "control.ts"), source: 'let compile; let alias; let computed; let nested; let equality; let comma;\n({ constructor: compile } = (() => {}));\n({ require: alias } = module);\nconst { ["constructor"]: computed } = {};\n({ payload: [{ constructor: nested }] } = input);\n({ constructor: equality } === value);\n({ require: comma }, value);' }], root);
    expect(findings.map((finding: { line: number; reason: string }) => `${finding.line}:${finding.reason}`)).toEqual(["2:banned-member:constructor", "3:banned-member:require", "4:banned-member:constructor", "5:banned-member:constructor"]);
  });

  it("rejects shorthand and dynamic computed destructuring assignments without rejecting literals", async () => {
    const loaded = await scanner(); const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([{ file: resolve(root, "control.ts"), source: "let constructor, require, compile, key; ({ constructor } = fn); ({ require } = fn); ({ [key]: compile } = fn); const { [key]: declared } = fn; ({ ['safe']: value } = fn); const { ['safe']: staticValue } = fn; const ordinary = { [key]: compile };" }], root);
    expect(findings.map((finding: { reason: string }) => finding.reason)).toEqual(["banned-identifier:require", "banned-member:constructor", "banned-identifier:require", "banned-member:require", "computed-member-access", "computed-member-access"]);
  });

  it("keeps relative containment, membership, and type-only import checks independent", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([{ file: resolve(root, "entry.ts"), source: 'import type { T } from "./missing.js"; import { type U, value } from "./mixed.js"; import { x } from "../escape.js"; import { y } from "/absolute.js"; import { z } from "./extension";' }], root);
    expect(findings.map((finding: { reason: string }) => finding.reason)).toEqual(["specifier-not-in-product-set", "specifier-not-in-product-set", "specifier-escapes-root", "specifier-absolute", "specifier-missing-js-extension"]);
  });

  it("rejects dot-prefixed specifiers that are not ./ or ../", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([
      { file: resolve(root, "entry.ts"), source: 'import { hidden } from ".hidden.js";' },
      { file: resolve(root, ".hidden.ts"), source: "export const hidden = true;" },
    ], root);
    expect(findings.map((finding: { reason: string }) => finding.reason)).toEqual(["specifier-not-relative"]);
  });

  it("covers every frozen module-reference form at its candidate expression", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const findings = loaded!.scanSources([{ file: resolve(root, "control.ts"), source: 'import external = require("./missing.js");\nconst identifier = "./missing.js";\nimport(identifier);\nimport(`./missing.js`);\nimport(condition ? "./missing.js" : "./other.js");\nexport * from "./missing.js";\ntype T = import("./missing.js").T;' }], root);
    expect(findings.map((finding: { line: number; column: number; boundary: string; reason: string; specifier: string | null }) => `${finding.line}:${finding.column}:${finding.boundary}:${finding.reason}:${finding.specifier}`)).toEqual([
      "1:27:B1:specifier-not-in-product-set:./missing.js",
      "3:8:B1:nonliteral-module-specifier:null",
      "4:8:B1:nonliteral-module-specifier:null",
      "5:8:B1:nonliteral-module-specifier:null",
      "6:15:B1:specifier-not-in-product-set:./missing.js",
      "7:17:B1:specifier-not-in-product-set:./missing.js",
    ]);
  });

  it("keeps triple-slash directive categories and positions distinct from filenames", async () => {
    const loaded = await scanner();
    const root = resolve("/virtual/local-diagnostics");
    const input = { file: resolve(root, "directives.ts"), source: '/// <reference path="./dependency.ts" />\n/// <reference types="dependency-types" />\n/// <reference lib="esnext" />' };
    const source = ts.createSourceFile(input.file, input.source, ts.ScriptTarget.Latest, true);
    const directives = [
      [source.referencedFiles[0]!, "OOA/triple-slash:referencedFiles"],
      [source.typeReferenceDirectives[0]!, "OOA/triple-slash:typeReferenceDirectives"],
      [source.libReferenceDirectives[0]!, "OOA/triple-slash:libReferenceDirectives"],
    ] as const;
    const expected = directives.map(([directive, reason]) => {
      const location = source.getLineAndCharacterOfPosition(directive.pos);
      return `${location.line + 1}:${location.character + 1}:${reason}:null`;
    });
    const findings = loaded!.scanSources([input], root);
    expect(findings.map((finding: { line: number; column: number; boundary: string; reason: string; specifier: string | null }) => `${finding.line}:${finding.column}:${finding.boundary}/${finding.reason}:${finding.specifier}`)).toEqual(expected);
  });
});
