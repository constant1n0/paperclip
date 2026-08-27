import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const productDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../local-diagnostics");

export const productManifest = [
  "index.ts",
  "build-metadata.ts",
  "local-diagnostics.ts",
  "core.ts",
  "matrix.ts",
  "renderers.ts",
  "schema.ts",
].map((file) => resolve(productDirectory, file));
