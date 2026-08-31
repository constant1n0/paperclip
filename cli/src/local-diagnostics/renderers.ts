import type { Result } from "./schema.js";
export function renderJson(result: Result): string { const { exitCode: _exitCode, ...json } = result; return `${JSON.stringify(json)}\n`; }
export function renderText(result: Result): string {
  return ["paperclipai-local-diagnostics", `status: ${result.status}`, "scope: diagnostic-runtime/build-compatibility; CENTRAL health/liveness/readiness not assessed", `paperclip: ${result.paperclip?.version} ${result.paperclip?.buildCommit}`, `runtime: ${result.runtime.nodeVersion} ${result.runtime.platform} ${result.runtime.architecture}`, `checks: ${result.checks.map((check) => `${check.id}=${check.status}/${check.code}`).join(", ")}`, `guarantees: ${Object.entries(result.guarantees).map(([key, value]) => `${key}=${value}`).join(", ")}`, ""].join("\n");
}
