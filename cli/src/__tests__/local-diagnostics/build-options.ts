import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BuildOptions } from "esbuild";

export interface LocalBuildInput {
  define?: Record<string, string>;
  metafile?: boolean;
  write?: boolean;
}

export type FactoryOptions = BuildOptions & {
  banner: { js: string };
  define: Record<string, string>;
  entryPoints: string[];
  external: string[];
};

interface ConfigModule {
  default: FactoryOptions;
  createLocalDiagnosticsBuildOptions(input?: LocalBuildInput): FactoryOptions;
  createMainBuildOptions(): FactoryOptions;
}

const cliDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function isConfigModule(value: unknown): value is ConfigModule {
  return typeof value === "object" && value !== null && "default" in value && "createMainBuildOptions" in value && "createLocalDiagnosticsBuildOptions" in value;
}

export async function loadBuildFactories(): Promise<ConfigModule> {
  const imported = await import(pathToFileURL(resolve(cliDirectory, "esbuild.config.mjs")).href);
  if (!isConfigModule(imported)) throw new Error("Invalid esbuild configuration module");
  return imported;
}
