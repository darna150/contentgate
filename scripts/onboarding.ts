import { loadEnvConfig } from "@next/env";

import { checkOnboardingEnvironment, currentOnboardingEnvironmentInput } from "../src/lib/onboarding/environment.ts";
import { provisionWorkspace } from "../src/lib/onboarding/engine.ts";
import { preflightWorkspacePackage } from "../src/lib/onboarding/package.ts";

loadEnvConfig(process.cwd());

type Options = {
  command: "preflight" | "provision";
  packageDirectory: string;
  confirmation?: string;
  operatorEmail?: string;
};

function parseArgs(args: string[]): Options {
  const command = args[0];
  if (command !== "preflight" && command !== "provision") {
    throw new Error("Usage: onboarding.ts <preflight|provision> <package-directory> [--confirm \"…\"] [--operator-email email]");
  }
  const packageDirectory = args[1];
  if (!packageDirectory || packageDirectory.startsWith("--")) {
    throw new Error("A workspace package directory is required.");
  }
  const options: Options = { command, packageDirectory };
  for (let index = 2; index < args.length; index += 1) {
    const argument = args[index];
    const next = args[index + 1];
    if (argument === "--confirm" && next) {
      options.confirmation = next;
      index += 1;
    } else if (argument === "--operator-email" && next) {
      options.operatorEmail = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const preflight = await preflightWorkspacePackage(options.packageDirectory);
  if (!preflight.ok || !preflight.prepared) {
    console.error(JSON.stringify({ ok: false, issues: preflight.issues, counts: preflight.blueprint.counts }, null, 2));
    process.exitCode = 1;
    return;
  }

  const summary = {
    ok: true,
    workspaceKey: preflight.prepared.blueprint.workspace.key,
    blueprintSha256: preflight.prepared.blueprintSha256,
    counts: preflight.blueprint.counts,
  };
  if (options.command === "preflight") {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const environment = checkOnboardingEnvironment(
    currentOnboardingEnvironmentInput({
      workspaceKey: preflight.prepared.blueprint.workspace.key,
      confirmation: options.confirmation,
    }),
  );
  if (!environment.ok || !environment.target) {
    throw new Error(environment.errors.join("\n"));
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for provisioning.");
  }

  // The read-only preflight command must remain runnable in a plain Node CLI.
  // Load the server-only Supabase adapter only after the provision path and
  // its environment guards have been selected.
  const { createSupabaseOnboardingRepository } = await import(
    "../src/lib/onboarding/supabase-repository.ts"
  );

  const receipt = await provisionWorkspace({
    environment: environment.target,
    package: preflight.prepared,
    repository: createSupabaseOnboardingRepository(),
    operatorEmail: options.operatorEmail,
    setupRedirectTo: process.env.CONTENTGATE_APP_URL
      ? `${process.env.CONTENTGATE_APP_URL.replace(/\/$/, "")}/welcome`
      : undefined,
  });
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
