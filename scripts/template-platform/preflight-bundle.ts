import { readFile } from "node:fs/promises";

import { loadTemplateBundleDirectory } from "../../src/lib/template-platform/bundle-directory.ts";
import { validateTemplateBundleAssetPayloads } from "../../src/lib/template-platform/importer.ts";
import {
  formatTemplateBundlePreflightReport,
  preflightTemplateBundle,
  type TemplateBundlePreflightSample,
} from "../../src/lib/template-platform/preflight.ts";

type CliOptions = {
  bundleDir?: string;
  json: boolean;
  samples: string[];
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { json: false, samples: [] };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--sample":
        if (!next) throw new Error("--sample requires a file path.");
        options.samples.push(next);
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

async function loadSamples(paths: string[]): Promise<TemplateBundlePreflightSample[]> {
  const samples: TemplateBundlePreflightSample[] = [];
  for (const path of paths) {
    const parsed = JSON.parse(await readFile(path, "utf8")) as
      | TemplateBundlePreflightSample
      | TemplateBundlePreflightSample[]
      | Record<string, unknown>;
    if (Array.isArray(parsed)) {
      samples.push(...parsed);
    } else if ("fields" in parsed && typeof parsed.fields === "object") {
      samples.push(parsed as TemplateBundlePreflightSample);
    } else {
      samples.push({
        key: path.split("/").pop()?.replace(/\.json$/i, "") || "sample",
        fields: parsed,
      });
    }
  }
  return samples;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.bundleDir) {
    throw new Error(
      [
        "Usage: npm run template-platform:preflight-bundle -- <bundle-dir> [--sample fixtures/default.json] [--json]",
        "",
        "The bundle directory must contain manifest.json and every asset path declared by the manifest.",
      ].join("\n")
    );
  }

  const bundle = await loadTemplateBundleDirectory(options.bundleDir);
  const samples = await loadSamples(options.samples);
  const report = await preflightTemplateBundle({
    manifest: bundle.manifest,
    samples: samples.length ? samples : undefined,
    assets: bundle.assets,
  });
  const assetIssues = validateTemplateBundleAssetPayloads(
    bundle.manifest.assets,
    bundle.assets
  );
  const finalReport = {
    ...report,
    ok: report.ok && assetIssues.every((issue) => issue.severity !== "error"),
    issues: [...report.issues, ...assetIssues],
  };

  if (options.json) {
    console.log(JSON.stringify(finalReport, null, 2));
  } else {
    console.log(formatTemplateBundlePreflightReport(finalReport));
  }

  if (!finalReport.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
