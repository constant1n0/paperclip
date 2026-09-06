import { describe, expect, it } from "vitest";
import { scanSources } from "./scanner.js";

const ROOT = "/corpus";
const MANIFEST = ["/corpus/case.ts", "/corpus/x.ts"];
const extensionIdentifiers = ["setTimeout", "setInterval", "setImmediate", "queueMicrotask", "fetch", "WebSocket", "AbortController", "AbortSignal", "MessageChannel", "MessagePort", "Atomics"];
type CorpusCase = readonly [string, string, readonly string[], string?];

const frozen: CorpusCase[] = [
  ["relative in-manifest", 'import { a } from "./x.js";', []], ["relative parent escape", 'import { a } from "../x.js";', ["B1/specifier-escapes-root"]],
  ["posix absolute", 'import "/abs.js";', ["B1/specifier-absolute"]], ["windows absolute", 'import "C:\\\\abs.js";', ["B1/specifier-absolute"]],
  ["node: builtin", 'import "node:fs";', ["B1/specifier-not-relative"]], ["bare", 'import "fs";', ["B1/specifier-not-relative"]], ["scoped bare", 'import "@scope/pkg";', ["B1/specifier-not-relative"]],
  ["subpath imports", 'import "#imports";', ["B1/specifier-not-relative"]], ["https url", 'import "https://x";', ["B1/specifier-not-relative"]], ["file url", 'import "file:///x";', ["B1/specifier-not-relative"]],
  ["data url", 'import "data:text/js,0";', ["B1/specifier-not-relative"]], ["missing .js extension", 'import "./x";', ["B1/specifier-missing-js-extension"]], ["deep escape", 'import "../../escape.js";', ["B1/specifier-escapes-root"]],
  ["sibling not in manifest", 'import "./not-in-manifest.js";', ["B1/specifier-not-in-product-set"]], ["import equals require", 'import fs = require("node:fs");', ["B1/specifier-not-relative"]],
  ["dynamic identifier", "import(x);", ["B1/nonliteral-module-specifier"]], ["dynamic template", "import(`node:${x}`);", ["B1/nonliteral-module-specifier"]], ["dynamic ternary", "import(cond?a:b);", ["B1/nonliteral-module-specifier"]],
  ["import type", 'import type {} from "node:fs";', ["B1/specifier-not-relative"]], ["export star", 'export * from "node:fs";', ["B1/specifier-not-relative"]], ["import type node", 'type T = import("node:fs").Stats;', ["B1/specifier-not-relative"]],
  ["require literal", 'require("node:fs");', ["B2/banned-identifier:require"]], ["require template", "require(`node:fs`);", ["B2/banned-identifier:require"]], ["require identifier arg", "require(x);", ["B2/banned-identifier:require"]],
  ["require value capture", "const load = require;", ["B2/banned-identifier:require"]], ["module.require", 'module.require("x");', ["B2/banned-member:require"]], ["module['require']", 'module["require"]("x");', ["B2/banned-member:require"]],
  ["module escaped require", 'module["\\u0072equire"]("x");', ["B2/banned-member:require"]], ["module[computed]", 'module[r]("x");', ["B2/computed-member-access"]],
  ["globalThis[computed]", "globalThis[k];", ["B2/banned-identifier:globalThis", "B2/computed-member-access"]], ["global.process.env", "global.process.env;", ["B2/banned-identifier:global"]],
  ["Object descriptor on process", 'Object.getOwnPropertyDescriptor(process,"env");', ["B2/banned-identifier:Object", "B3/process-identifier-escapes-allowed-member-access"]], ["Reflect.get", "Reflect.get(o,k);", ["B2/banned-identifier:Reflect"]],
  ["new Function", 'new Function("return this");', ["B2/banned-identifier:Function"]], ["arrow .constructor", "(()=>{}).constructor;", ["B2/banned-member:constructor"]], ["object __proto__", "({}).__proto__;", ["B2/banned-member:__proto__"]],
  ["destructured process", "const { env } = process;", ["B3/process-identifier-escapes-allowed-member-access"]], ["aliased process", "const p = process;", ["B3/process-identifier-escapes-allowed-member-access"]], ["process as argument", "f(process);", ["B3/process-identifier-escapes-allowed-member-access"]],
  ["eval", 'eval("1");', ["B2/banned-identifier:eval"]], ["WebAssembly", "WebAssembly.compile(b);", ["B2/banned-identifier:WebAssembly"]], ["createRequire", "createRequire(import.meta.url);", ["B2/banned-identifier:createRequire", "B2/import-meta"]],
  ["legitimate Object.entries", "Object.entries(o).map(([k,v])=>`${k}=${v}`);", []], ["unpinned Object.keys", "Object.keys(o);", ["B2/banned-identifier:Object"]],
  ["decl: property assignment", 'const x = { process: "batch" };', []], ["decl: property signature", "interface Runner { process: () => void }", []], ["decl: method declaration", "class C { process() { return 1; } }", []],
  ["decl: method signature", "interface R { process(x: number): void }", []], ["decl: property access name", "runner.process(x);", []], ["decl: enum member", "enum E { process }", []],
  ["shorthand is a reference", "const o = { process };", ["B3/process-identifier-escapes-allowed-member-access"]], ["allowed: argv", "const a = process.argv.slice(2);", []], ["allowed: stdout.write", "process.stdout.write(v);", []],
  ["allowed: exitCode", "process.exitCode = r;", []], ["allowed: runtime facts", "const f = { nodeVersion: process.version, platform: process.platform, architecture: process.arch };", []],
  ["env mutation", 'process.env.X = "1";', ["B3/process-identifier-escapes-allowed-member-access"]], ["_events channel", 'process._events["SIGUSR2"] = h;', ["B3/process-identifier-escapes-allowed-member-access"]],
  ["emit newListener", 'process.emit("newListener","SIGUSR2",h);', ["B3/process-identifier-escapes-allowed-member-access"]], ["loadEnvFile", 'process.loadEnvFile("./x.env");', ["B3/process-identifier-escapes-allowed-member-access"]],
  ["stdin.constructor", "new (process.stdin.constructor)({});", ["B2/banned-member:constructor", "B3/process-identifier-escapes-allowed-member-access"]], ["execArgv read", 'const n = process.execArgv.join(" ");', ["B3/process-identifier-escapes-allowed-member-access"]],
  ["reallyExit", "process.reallyExit(0);", ["B3/process-identifier-escapes-allowed-member-access"]], ["getBuiltinModule", 'process.getBuiltinModule("fs");', ["B3/process-identifier-escapes-allowed-member-access"]],
  ["two-hop prototype on", 'Object.getPrototypeOf(Object.getPrototypeOf(process)).on.call(process,"SIGINT",f);', ["B2/banned-identifier:Object", "B2/banned-identifier:Object", "B3/process-identifier-escapes-allowed-member-access", "B3/process-identifier-escapes-allowed-member-access"]],
  ["triple-slash reference", '/// <reference path="../../evil.d.ts" />\nexport {};', ["OOA/triple-slash:referencedFiles"]], ["triple-slash types", '/// <reference types="node" />\nexport {};', ["OOA/triple-slash:typeReferenceDirectives"]],
  ["triple-slash lib", '/// <reference lib="dom" />\nexport {};', ["OOA/triple-slash:libReferenceDirectives"]],
];

const extension: CorpusCase[] = [
  ["isolated banned global: setTimeout", "setTimeout;", ["B2/banned-identifier:setTimeout"], "setTimeout"],
  ["isolated banned global: setInterval", "setInterval;", ["B2/banned-identifier:setInterval"], "setInterval"],
  ["isolated banned global: setImmediate", "setImmediate;", ["B2/banned-identifier:setImmediate"], "setImmediate"],
  ["isolated banned global: queueMicrotask", "queueMicrotask;", ["B2/banned-identifier:queueMicrotask"], "queueMicrotask"],
  ["isolated banned global: fetch", "fetch;", ["B2/banned-identifier:fetch"], "fetch"],
  ["isolated banned global: WebSocket", "WebSocket;", ["B2/banned-identifier:WebSocket"], "WebSocket"],
  ["isolated banned global: AbortController", "AbortController;", ["B2/banned-identifier:AbortController"], "AbortController"],
  ["isolated banned global: AbortSignal", "AbortSignal;", ["B2/banned-identifier:AbortSignal"], "AbortSignal"],
  ["isolated banned global: MessageChannel", "MessageChannel;", ["B2/banned-identifier:MessageChannel"], "MessageChannel"],
  ["isolated banned global: MessagePort", "MessagePort;", ["B2/banned-identifier:MessagePort"], "MessagePort"],
  ["isolated banned global: Atomics", "Atomics;", ["B2/banned-identifier:Atomics"], "Atomics"],
];
const corpus = [...frozen, ...extension];
const actual = (source: string) => scanSources([{ file: MANIFEST[0]!, source }, { file: MANIFEST[1]!, source: "export {};" }], ROOT).map((finding) => `${finding.boundary}/${finding.reason}`).sort();
const results = corpus.map(([label, source, expected]) => ({ label, actual: actual(source), expected: [...expected].sort() }));
const mismatches = results.filter(({ actual, expected }) => actual.join("\u0000") !== expected.join("\u0000"));

describe("local-diagnostics frozen static corpus", () => {
  it("preserves the 67 frozen cases", () => expect(frozen).toHaveLength(67));
  it("contains exactly the 11 isolated banned-global extensions", () => {
    expect(extension).toHaveLength(11);
    expect(extension.map(([, , , identifier]) => identifier).sort()).toEqual([...extensionIdentifiers].sort());
    expect(extension.map(([, source, expected, identifier]) => [source, expected, identifier])).toEqual(extensionIdentifiers.map((identifier) => [`${identifier};`, [`B2/banned-identifier:${identifier}`], identifier]));
  });
  it("contains exactly 78 unique cases", () => {
    expect(corpus).toHaveLength(78);
    expect(new Set(corpus.map(([label]) => label)).size).toBe(78);
  });
  it.each(results)("matches the exact multiset for %s", ({ actual, expected }) => expect(actual).toEqual(expected));
  it("records zero per-case multiset mismatches", () => expect(mismatches).toHaveLength(0));
});
