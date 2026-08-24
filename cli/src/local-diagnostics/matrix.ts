import { CHECK_STATUS, ERROR_CODE, STATUS, type Check, type ErrorCode, type Result } from "./schema.js";

export const guarantees = () => ({ localOnly: true, centralInspected: false, centralContacted: false, centralStarted: false, centralRecovered: false, centralValidated: false, filesystemAccessed: false, environmentMutated: false, subprocessSpawned: false, networkAccessed: false, databaseOpened: false, storageOpened: false, telemetryInitialized: false, providersInitialized: false, pluginsLoaded: false, workersLoaded: false, schedulersLoaded: false, recoveryLoaded: false, serverStarted: false, persistentTimersInstalled: false, signalHandlersInstalled: false, repairsPerformed: false });
export const checks = (build: Check, runtime: Check): Check[] => [build, runtime];
export function failure(result: Omit<Result, "status" | "checks" | "guarantees" | "error" | "exitCode">, code: ErrorCode, exitCode: number, buildCode = "not_evaluated"): Result {
  return { ...result, status: STATUS.ERROR, checks: checks({ id: "build.metadata", status: CHECK_STATUS.ERROR, code: buildCode }, { id: "runtime.node", status: CHECK_STATUS.ERROR, code: "not_evaluated" }), guarantees: guarantees(), error: { code }, exitCode };
}
export { CHECK_STATUS, ERROR_CODE, STATUS };
