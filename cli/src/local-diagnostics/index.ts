import { runLocalDiagnostics } from "./local-diagnostics.js";
import { buildCommit, version } from "./build-metadata.js";
import type { Facts } from "./schema.js";

const facts: Facts = { metadata: { version, buildCommit }, runtime: { nodeVersion: process.version, platform: process.platform, architecture: process.arch } };
const { exitCode } = runLocalDiagnostics(process.argv.slice(2), facts, { write: (value) => process.stdout.write(value) });
process.exitCode = exitCode;
