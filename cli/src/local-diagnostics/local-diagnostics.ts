import { buildResult, internalResult } from "./core.js";
import { renderJson, renderText } from "./renderers.js";
import type { Facts, Result } from "./schema.js";
export interface CapabilityPort { write(value: string): void }
export function runLocalDiagnostics(argv: string[], facts: Facts, port: CapabilityPort): Result {
  let result: Result; try { result = buildResult(argv, facts); } catch { result = internalResult(facts); }
  port.write(result.status === "ok" && argv[0] === "--text" ? renderText(result) : renderJson(result));
  return result;
}
