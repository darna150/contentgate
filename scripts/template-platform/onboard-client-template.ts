import { writeFile } from "node:fs/promises";

import { loadTemplateBundleDirectory } from "../../src/lib/template-platform/bundle-directory.ts";
import { validateTemplateBundleAssetPayloads } from "../../src/lib/template-platform/importer.ts";
import {
  buildTemplateOnboardingReport,
  formatTemplateOnboardingReport,
} from "../../src/lib/template-platform/onboarding-report.ts";
import {
  preflightTemplateBundle,
  type TemplateBundlePreflightSample,
} from "../../src/lib/template-platform/preflight.ts";

type CliOptions = {
  bundleDir?: string;
  json: boolean;
  output?: string;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--output":
        if (!next) throw new Error("--output requires a file path.");
        options.output = next;
        index += 1;
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        if (options.bundleDir) throw new Error(`Unexpected extra argument: ${arg}`);
        options.bundleDir = arg;
    }
  }
  return options;
}

function sampleFromManifest(
  manifest: Awaited<ReturnType<typeof loadTemplateBundleDirectory>>["manifest"]
): TemplateBundlePreflightSample {
  return {
    key: "manifest-defaults",
    fields: Object.fromEntries(
      manifest.fields.map((field) => [
        field.key,
        typeof field.defaultValue === "string"
          ? field.defaultValue
          : field.options?.[0] ?? "",
      ])
    ),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.bundleDir) {
    throw new Error(
      [
        "Usage: npm run template-platform:onboard-client -- <bundle-dir> [--json] [--output report.md]",
        "",
        "The bundle directory must contain manifest.json and every asset path declared by the manifest.",
      ].join("\n")
    );
  }

  const bundle = await loadTemplateBundleDirectory(options.bundleDir);
  const preflight = await preflightTemplateBundle({
    manifest: bundle.manifest,
    assets: bundle.assets,
    samples: [sampleFromManifest(bundle.manifest)],
  });
  const assetIssues = validateTemplateBundleAssetPayloads(
    bundle.manifest.assets,
    bundle.assets
  );
  const finalPreflight = {
    ...preflight,
    ok: preflight.ok && assetIssues.every((issue) => issue.severity !== "error"),
    issues: [...preflight.issues, ...assetIssues],
  };
  const report = buildTemplateOnboardingReport({
    manifest: bundle.manifest,
    preflight: finalPreflight,
  });
  const output = options.json
    ? JSON.stringify(report, null, 2)
    : formatTemplateOnboardingReport(report);

  if (options.output) {
    await writeFile(options.output, `${output}\n`);
  } else {
    console.log(output);
  }

  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
