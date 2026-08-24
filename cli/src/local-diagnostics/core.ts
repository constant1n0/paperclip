import { checks, failure, guarantees, CHECK_STATUS, ERROR_CODE, STATUS } from "./matrix.js";
import type { Facts, Result } from "./schema.js";

const scope = () => ({ assessed: "diagnostic-runtime/build-compatibility", centralHealth: "not_assessed", centralLiveness: "not_assessed", centralReadiness: "not_assessed" });
const base = (facts: Facts) => ({ schemaVersion: "v1", command: "paperclipai-local-diagnostics", status: STATUS.ERROR, scope: scope(), paperclip: null, runtime: facts.runtime });
export function parseArguments(argv: string[]) {
  const valid = argv.length === 0 || (argv.length === 1 && (argv[0] === "--json" || argv[0] === "--text"));
  return { mode: valid && argv[0] === "--text" ? "text" : "json", error: valid ? null : ERROR_CODE.INVALID_ARGUMENTS, exitCode: valid ? 0 : 2 };
}
const validMetadata = (facts: Facts) => /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*)))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(facts.metadata.version) && /^[0-9a-f]{40}$/i.test(facts.metadata.buildCommit);
const supportedRuntime = (version: string) => /^v?(\d+)/.exec(version)?.[1] ? Number(/^v?(\d+)/.exec(version)![1]) >= 20 : false;
export function buildResult(argv: string[], facts: Facts): Result {
  const args = parseArguments(argv); const common = base(facts);
  if (args.error) return failure(common, args.error, args.exitCode);
  if (!validMetadata(facts)) return failure(common, ERROR_CODE.INVALID_BUILD_METADATA, 3, "invalid");
  const runtime = supportedRuntime(facts.runtime.nodeVersion);
  return { ...common, status: runtime ? STATUS.OK : STATUS.INCOMPATIBLE, paperclip: facts.metadata, checks: checks({ id: "build.metadata", status: CHECK_STATUS.PASS, code: "valid" }, { id: "runtime.node", status: runtime ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL, code: runtime ? "supported" : "unsupported" }), guarantees: guarantees(), ...(runtime ? {} : { error: { code: ERROR_CODE.UNSUPPORTED_RUNTIME } }), exitCode: runtime ? 0 : 2 };
}
export function internalResult(facts: Facts): Result { return failure(base(facts), ERROR_CODE.INTERNAL_ERROR, 3); }
