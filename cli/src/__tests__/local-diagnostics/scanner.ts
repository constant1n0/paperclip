import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import ts from "typescript";

const BANNED_IDENTIFIERS = new Set(["require", "eval", "Function", "globalThis", "global", "Reflect", "createRequire", "WebAssembly", "__proto__", "Object", "setTimeout", "setInterval", "setImmediate", "queueMicrotask", "fetch", "WebSocket", "AbortController", "AbortSignal", "MessageChannel", "MessagePort", "Atomics"]);
const BANNED_MEMBERS = new Set(["require", "constructor", "__proto__"]);
const PROCESS_MEMBERS = new Set(["argv", "version", "platform", "arch", "stdout", "exitCode"]);
const NAME_POSITIONS = new Set<ts.SyntaxKind>([ts.SyntaxKind.PropertyAssignment, ts.SyntaxKind.PropertySignature, ts.SyntaxKind.MethodSignature, ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor, ts.SyntaxKind.EnumMember, ts.SyntaxKind.PropertyAccessExpression]);

export interface Finding { file: string; line: number; column: number; boundary: string; reason: string; specifier: string | null }
export interface Source { file: string; source: string }

const finding = (source: ts.SourceFile, node: ts.Node, boundary: string, reason: string, specifier: string | null): Finding => {
  const location = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { file: source.fileName, line: location.line + 1, column: location.character + 1, boundary, reason, specifier };
};
const isReference = (node: ts.Identifier): boolean => !(NAME_POSITIONS.has(node.parent.kind) && (node.parent as ts.NamedDeclaration).name === node) && !(ts.isQualifiedName(node.parent) && node.parent.right === node) && !(ts.isBindingElement(node.parent) && (node.parent.name === node || node.parent.propertyName === node));
const propertyName = (node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | undefined => ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : undefined;
const bindingMemberName = (node: ts.BindingElement): string | undefined => node.propertyName ? ts.isIdentifier(node.propertyName) || ts.isStringLiteral(node.propertyName) ? node.propertyName.text : undefined : ts.isIdentifier(node.name) ? node.name.text : undefined;
const inRoot = (root: string, target: string) => target === root || target.startsWith(`${root}${sep}`);

export function scanSources(sources: Source[], root: string): Finding[] {
  const members = new Set(sources.map(({ file }) => resolve(file)));
  const findings: Finding[] = [];
  for (const input of sources) {
    const source = ts.createSourceFile(input.file, input.source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        const target = resolve(dirname(input.file), specifier.replace(/\.js$/, ".ts"));
        const reason = /^(?:\/|[A-Za-z]:[\\/])/.test(specifier) ? "specifier-absolute" : !specifier.startsWith("./") && !specifier.startsWith("../") ? "specifier-not-relative" : !specifier.endsWith(".js") ? "specifier-missing-js-extension" : !inRoot(resolve(root), target) ? "specifier-escapes-root" : !members.has(target) ? "specifier-not-in-product-set" : undefined;
        if (reason) findings.push(finding(source, node.moduleSpecifier, "B1", reason, specifier));
      }
      if (ts.isIdentifier(node) && isReference(node)) {
        const parent = node.parent;
        const allowedProcess = node.text === "process" && ts.isPropertyAccessExpression(parent) && parent.expression === node && PROCESS_MEMBERS.has(parent.name.text);
        const safeObject = node.text === "Object" && ts.isPropertyAccessExpression(parent) && parent.expression === node && parent.name.text === "entries";
        if (node.text === "process" && !allowedProcess) findings.push(finding(source, node, "B3", "process-identifier-escapes-allowed-member-access", null));
        else if (BANNED_IDENTIFIERS.has(node.text) && !safeObject) findings.push(finding(source, node, "B2", `banned-identifier:${node.text}`, null));
      }
      if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
        const member = propertyName(node);
        if (member && BANNED_MEMBERS.has(member)) findings.push(finding(source, node, "B2", `banned-member:${member}`, null));
        if (ts.isElementAccessExpression(node) && node.argumentExpression && !ts.isStringLiteral(node.argumentExpression) && !ts.isNumericLiteral(node.argumentExpression)) findings.push(finding(source, node, "B2", "computed-member-access", null));
      }
      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const member = bindingMemberName(node);
        if (member && BANNED_MEMBERS.has(member)) findings.push(finding(source, node, "B2", `banned-member:${member}`, null));
      }
      if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) findings.push(finding(source, node, "B2", "import-meta", null));
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const directive of [...source.referencedFiles, ...source.typeReferenceDirectives, ...source.libReferenceDirectives]) findings.push(finding(source, source, "OOA", `triple-slash:${directive.fileName}`, null));
  }
  const order = new Map(sources.map(({ file }, index) => [resolve(file), index]));
  return findings.sort((left, right) => (order.get(left.file) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.file) ?? Number.MAX_SAFE_INTEGER) || left.line - right.line || left.column - right.column || left.boundary.localeCompare(right.boundary) || left.reason.localeCompare(right.reason));
}

export function scanProduct(files: string[]): Finding[] {
  const root = resolve(dirname(files[0] ?? "."));
  return scanSources(files.map((file) => ({ file: resolve(file), source: readFileSync(file, "utf8") })), root);
}
