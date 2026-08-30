import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BuildOptions } from "esbuild";

interface BuildOptionsInput {
  entry: string;
  defineOverride?: Record<string, string>;
  omitDefine?: boolean;
}

interface ConfigModule {
  default: BuildOptions;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliDirectory = resolve(__dirname, "../../..");

function isConfigModule(value: unknown): value is ConfigModule {
  return typeof value === "object" && value !== null && "default" in value && typeof value.default === "object" && value.default !== null;
}

export async function buildOptions({ entry, defineOverride = {}, omitDefine = false }: BuildOptionsInput): Promise<BuildOptions> {
  const imported = await import(pathToFileURL(resolve(cliDirectory, "esbuild.config.mjs")).href);
  if (!isConfigModule(imported)) throw new Error("Invalid esbuild configuration module");
  const { outfile: _outfile, outdir: _outdir, define: shippedDefine = {}, ...shipped } = imported.default;

  return {
    ...shipped,
    absWorkingDir: cliDirectory,
    entryPoints: [entry],
    write: false,
    metafile: true,
    sourcemap: false,
    define: omitDefine ? {} : { ...shippedDefine, ...defineOverride },
  };
}
