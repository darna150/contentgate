import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const PRODUCTION_OVERRIDE = "I_UNDERSTAND_THIS_CONNECTS_TO_PRODUCTION";

function supabaseProjectRef(value) {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname;
    return /^([a-z0-9-]+)\.supabase\.(?:co|net)$/i.exec(hostname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function isLocalSupabase(value) {
  if (!value) return false;
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function assertSafeDevEnvironment(input) {
  const url = input.supabaseUrl?.trim();
  const target = input.environment?.trim().toLowerCase();
  const expectedRef = input.expectedProjectRef?.trim();

  if (!url) return { mode: "unconfigured", projectRef: null };

  const projectRef = supabaseProjectRef(url);
  const local = isLocalSupabase(url);
  if (!projectRef && !local) {
    throw new Error("Refusing dev start: NEXT_PUBLIC_SUPABASE_URL is not a recognized Supabase or local URL.");
  }
  if (!target || !["development", "staging", "production"].includes(target)) {
    throw new Error(
      "Refusing configured dev start: CONTENTGATE_ENVIRONMENT must explicitly be development, staging, or production."
    );
  }
  if (local && target !== "development") {
    throw new Error("Refusing dev start: a local Supabase URL must use CONTENTGATE_ENVIRONMENT=development.");
  }
  if (projectRef) {
    if (!expectedRef) {
      throw new Error(
        "Refusing remote dev start: CONTENTGATE_SUPABASE_PROJECT_REF must bind the checkout to its intended Supabase project."
      );
    }
    if (expectedRef !== projectRef) {
      throw new Error(
        `Refusing dev start: Supabase URL resolves to ${projectRef}, but CONTENTGATE_SUPABASE_PROJECT_REF is ${expectedRef}.`
      );
    }
  }
  if (target === "production" && input.allowProduction !== PRODUCTION_OVERRIDE) {
    throw new Error(
      "Refusing local dev against production. Use an env-free, development, or staging configuration."
    );
  }

  return { mode: target, projectRef };
}

function run() {
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  loadEnvConfig(projectDir, true);
  const result = assertSafeDevEnvironment({
    environment: process.env.CONTENTGATE_ENVIRONMENT,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    expectedProjectRef: process.env.CONTENTGATE_SUPABASE_PROJECT_REF,
    allowProduction: process.env.CONTENTGATE_ALLOW_PRODUCTION_DEV,
  });
  console.log(
    result.mode === "unconfigured"
      ? "Starting env-free ContentGate development preview."
      : `Starting ContentGate development preview against ${result.mode} (${result.projectRef ?? "local"}).`
  );

  const require = createRequire(import.meta.url);
  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
    cwd: projectDir,
    env: process.env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
