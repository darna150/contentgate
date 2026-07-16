import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

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

export type WriteFigmaPublisherBundleResult = {
  ok: boolean;
  outputDirectory: string;
  issues: Awaited<ReturnType<typeof preflightTemplateBundle>>["issues"];
  checkedAt?: string;
  manifestKey?: string;
  sampleCount?: number;
  variantCount?: number;
  versionName?: string;
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

export async function writeFigmaPublisherBundle(input: {
  publisherInput: FigmaPublisherInput;
  inputDirectory: string;
  outputDirectory: string;
  skipPreflight?: boolean;
}): Promise<WriteFigmaPublisherBundleResult> {
  const outputDirectory = resolve(input.outputDirectory);
  const compiled = compileFigmaPublisherInput(input.publisherInput);

  if (!compiled.ok) {
    return {
      ok: false,
      outputDirectory,
      issues: compiled.issues.map((issue) => ({
        code: "publish_gate",
        path: issue.path,
        message: issue.message,
        severity: "error",
      })),
    };
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    join(outputDirectory, "manifest.json"),
    `${JSON.stringify(compiled.manifest, null, 2)}\n`
  );
  await copyBundleAssets({
    publisherInput: input.publisherInput,
    inputDirectory: input.inputDirectory,
    outputDirectory,
  });

  if (input.skipPreflight) {
    return {
      ok: true,
      outputDirectory,
      issues: [],
      manifestKey: compiled.manifest.family.key,
      versionName: compiled.manifest.version.name,
    };
  }

  const bundle = await loadTemplateBundleDirectory(outputDirectory);
  const report = await preflightTemplateBundle({
    manifest: bundle.manifest,
    assets: bundle.assets,
  });
  const assetIssues = validateTemplateBundleAssetPayloads(
    bundle.manifest.assets,
    bundle.assets
  );
  return {
    ok: report.ok && assetIssues.every((issue) => issue.severity !== "error"),
    outputDirectory,
    checkedAt: report.checkedAt,
    issues: [...report.issues, ...assetIssues],
    manifestKey: report.manifestKey,
    sampleCount: report.sampleCount,
    variantCount: report.variantCount,
    versionName: report.versionName,
  };
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
  const result = await writeFigmaPublisherBundle({
    publisherInput,
    inputDirectory: dirname(inputPath),
    outputDirectory,
    skipPreflight: options.skipPreflight,
  });

  if (!result.ok) {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(
        [
          "FAIL figma publisher input:",
          ...result.issues.map((issue) => `- ${issue.path}: ${issue.message}`),
        ].join("\n")
      );
    }
    process.exit(1);
  }

  if (options.skipPreflight) {
    console.log(`Wrote Figma publisher bundle to ${outputDirectory}`);
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      formatTemplateBundlePreflightReport({
        ok: result.ok,
        manifestKey: result.manifestKey ?? "unknown",
        versionName: result.versionName ?? "unknown",
        checkedAt: result.checkedAt ?? new Date().toISOString(),
        variantCount: result.variantCount ?? 0,
        sampleCount: result.sampleCount ?? 0,
        issues: result.issues,
      })
    );
    console.log(`Wrote Figma publisher bundle to ${outputDirectory}`);
  }

  if (!result.ok) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
