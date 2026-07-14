import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

import { loadTemplateBundleDirectory } from "../../src/lib/template-platform/bundle-directory.ts";
import {
  compileFigmaPublisherInput,
  type FigmaPublisherInput,
} from "../../src/lib/template-platform/figma-publisher.ts";
import { validateTemplateBundleAssetPayloads } from "../../src/lib/template-platform/importer.ts";
import {
  formatTemplateBundlePreflightReport,
  preflightTemplateBundle,
} from "../../src/lib/template-platform/preflight.ts";

type CliOptions = {
  inputPath?: string;
  outputDirectory?: string;
  json: boolean;
  skipPreflight: boolean;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { json: false, skipPreflight: false };

  for (const arg of args) {
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--skip-preflight":
        options.skipPreflight = true;
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        if (!options.inputPath) {
          options.inputPath = arg;
        } else if (!options.outputDirectory) {
          options.outputDirectory = arg;
        } else {
          throw new Error(`Unexpected extra argument: ${arg}`);
        }
    }
  }

  return options;
}

function isInside(parent: string, child: string) {
  const normalizedParent = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(normalizedParent);
}

function resolveOutputPath(root: string, relativePath: string) {
  if (relativePath.startsWith("/") || relativePath.includes("\\")) {
    throw new Error(`Unsafe bundle asset path: ${relativePath}`);
  }
  const resolved = resolve(root, relativePath);
  if (!isInside(root, resolved)) {
    throw new Error(`Bundle asset path escapes output directory: ${relativePath}`);
  }
  return resolved;
}

function resolveSourcePath(inputDirectory: string, candidate: string) {
  return isAbsolute(candidate) ? candidate : resolve(inputDirectory, candidate);
}

function sourcePathByManifestPath(input: FigmaPublisherInput) {
  const entries = [
    ...input.fonts.map((font) => [font.path, font.sourcePath ?? font.path] as const),
    ...(input.assets ?? []).map((asset) => [
      asset.path,
      asset.sourcePath ?? asset.path,
    ] as const),
  ];
  return new Map(entries);
}

async function copyBundleAssets(input: {
  publisherInput: FigmaPublisherInput;
  inputDirectory: string;
  outputDirectory: string;
}) {
  const sources = sourcePathByManifestPath(input.publisherInput);
  const result = compileFigmaPublisherInput(input.publisherInput);
  if (!result.ok) throw new Error("Cannot copy assets for an invalid publisher input.");

  for (const asset of result.manifest.assets) {
    const source = sources.get(asset.path);
    if (!source) {
      throw new Error(`No sourcePath or relative source file declared for ${asset.path}.`);
    }
    const resolvedSource = resolveSourcePath(input.inputDirectory, source);
    const resolvedOutput = resolveOutputPath(input.outputDirectory, asset.path);
    if (resolvedSource === resolvedOutput) continue;
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await copyFile(resolvedSource, resolvedOutput);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.inputPath || !options.outputDirectory) {
    throw new Error(
      [
        "Usage: npm run template-platform:write-figma-publisher-bundle -- <publisher-input.json> <bundle-dir> [--json] [--skip-preflight]",
        "",
        "The publisher input must include annotated Figma frame/layer metadata, font assets, and exported reference/background image metadata.",
      ].join("\n")
    );
  }

  const inputPath = resolve(options.inputPath);
  const outputDirectory = resolve(options.outputDirectory);
  const publisherInput = JSON.parse(
    await readFile(inputPath, "utf8")
  ) as FigmaPublisherInput;
  const compiled = compileFigmaPublisherInput(publisherInput);

  if (!compiled.ok) {
    if (options.json) {
      console.log(JSON.stringify({ ok: false, issues: compiled.issues }, null, 2));
    } else {
      console.error(
        [
          "FAIL figma publisher input:",
          ...compiled.issues.map((issue) => `- ${issue.path}: ${issue.message}`),
        ].join("\n")
      );
    }
    process.exit(1);
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    join(outputDirectory, "manifest.json"),
    `${JSON.stringify(compiled.manifest, null, 2)}\n`
  );
  await copyBundleAssets({
    publisherInput,
    inputDirectory: dirname(inputPath),
    outputDirectory,
  });

  if (options.skipPreflight) {
    console.log(`Wrote Figma publisher bundle to ${outputDirectory}`);
    return;
  }

  const bundle = await loadTemplateBundleDirectory(outputDirectory);
  const report = await preflightTemplateBundle({ manifest: bundle.manifest });
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
    console.log(`Wrote Figma publisher bundle to ${outputDirectory}`);
  }

  if (!finalReport.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
