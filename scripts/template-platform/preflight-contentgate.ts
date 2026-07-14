import { buildContentGateTemplateBundle } from "../../src/lib/template-platform/contentgate-bundle.ts";
import {
  formatTemplateBundlePreflightReport,
  preflightTemplateBundle,
  type TemplateBundlePreflightSample,
} from "../../src/lib/template-platform/preflight.ts";

const targets = [
  "contentgate_local_friendly",
  "contentgate_local_premium",
] as const;

const compactSamples: TemplateBundlePreflightSample[] = [
  {
    key: "safe-short-copy",
    fields: {
      cta: "Learn",
      headline: "On-brand posts",
      local_detail: "Local teams",
      proof_note: "Brand locked",
      subheadline: "Approved templates.",
    },
  },
];

async function main() {
  let failed = false;

  for (const layoutKey of targets) {
    const bundle = await buildContentGateTemplateBundle(layoutKey);
    const report = await preflightTemplateBundle({
      manifest: bundle.manifest,
      samples: compactSamples,
    });

    console.log(formatTemplateBundlePreflightReport(report));
    if (!report.ok) failed = true;
  }

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
