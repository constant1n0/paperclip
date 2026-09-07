import { fileURLToPath } from "node:url";
import { canonicalJson } from "./private-local-diagnostics-artifact-lib.mjs";
import { verifyArtifact } from "./private-local-diagnostics-verification-lib.mjs";

const main = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (main) verifyArtifact(process.argv.slice(2)).then((value) => process.stdout.write(canonicalJson(value))).catch(() => { process.stderr.write("private artifact verification failed\n"); process.exitCode = 1; });
