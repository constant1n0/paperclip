export const STATUS = { OK: "ok", INCOMPATIBLE: "incompatible", ERROR: "error" } as const;
export const CHECK_STATUS = { PASS: "pass", FAIL: "fail", ERROR: "error" } as const;
export const ERROR_CODE = { INVALID_ARGUMENTS: "invalid_arguments", UNSUPPORTED_RUNTIME: "unsupported_runtime", INVALID_BUILD_METADATA: "invalid_build_metadata", INTERNAL_ERROR: "internal_error" } as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];
export type CheckStatus = (typeof CHECK_STATUS)[keyof typeof CHECK_STATUS];
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export interface Metadata { version: string; buildCommit: string }
export interface RuntimeFacts { nodeVersion: string; platform: string; architecture: string }
export interface Facts { metadata: Metadata; runtime: RuntimeFacts }
export interface Check { id: string; status: CheckStatus; code: string }
export interface Scope { assessed: string; centralHealth: string; centralLiveness: string; centralReadiness: string }
export interface Guarantees { localOnly: boolean; centralInspected: boolean; centralContacted: boolean; centralStarted: boolean; centralRecovered: boolean; centralValidated: boolean; filesystemAccessed: boolean; environmentMutated: boolean; subprocessSpawned: boolean; networkAccessed: boolean; databaseOpened: boolean; storageOpened: boolean; telemetryInitialized: boolean; providersInitialized: boolean; pluginsLoaded: boolean; workersLoaded: boolean; schedulersLoaded: boolean; recoveryLoaded: boolean; serverStarted: boolean; persistentTimersInstalled: boolean; signalHandlersInstalled: boolean; repairsPerformed: boolean }
export interface Result { schemaVersion: string; command: string; status: Status; scope: Scope; paperclip: Metadata | null; runtime: RuntimeFacts; checks: Check[]; guarantees: Guarantees; error?: { code: ErrorCode }; exitCode: number }
