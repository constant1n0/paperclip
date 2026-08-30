declare const __PC_VERSION__: string;
declare const __PC_BUILD_COMMIT__: string;

export const version: string = typeof __PC_VERSION__ === "string" ? __PC_VERSION__ : "";
export const buildCommit: string = typeof __PC_BUILD_COMMIT__ === "string" ? __PC_BUILD_COMMIT__ : "";
