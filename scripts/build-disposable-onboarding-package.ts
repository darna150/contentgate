import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buildContentGateTemplateBundle } from "../src/lib/template-platform/contentgate-bundle.ts";
import type { WorkspaceBlueprint } from "../src/lib/onboarding/blueprint.ts";

type Options = {
  output: string;
  workspaceKey: string;
  adminEmail: string;
  memberEmail: string;
};

function parseArgs(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error(
        "Usage: build-disposable-onboarding-package.ts --output <directory> --workspace-key <key> --admin-email <email> --member-email <email>"
      );
    }
    values.set(name, value);
  }
  const required = (name: string) => {
    const value = values.get(name)?.trim();
    if (!value) throw new Error(`${name} is required.`);
    return value;
  };
  return {
    output: resolve(required("--output")),
    workspaceKey: required("--workspace-key"),
    adminEmail: required("--admin-email").toLowerCase(),
    memberEmail: required("--member-email").toLowerCase(),
  };
}

async function writePackageFile(root: string, path: string, data: string | Uint8Array) {
  const target = resolve(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    await access(options.output);
    throw new Error(`Refusing to overwrite existing output directory: ${options.output}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
  }
  await mkdir(options.output, { recursive: false });

  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const square = bundle.manifest.variants.find((variant) => variant.key === "square");
  if (!square) {
    throw new Error("The bundled ContentGate template is missing its square variant.");
  }
  // Product choices are no longer embedded in the Set B template bundle: the
  // rendered backgrounds carry locked artwork, while DAM packshots remain
  // separate approved assets. Use the canonical transparent fixture directly
  // so disposable onboarding exercises the current contract.
  const productImage = await readFile(
    resolve(
      process.cwd(),
      "public/template-packages/contentgate/products/charcoal.png",
    ),
  );

  const bundleRoot = "templates/local-premium-v1";
  await writePackageFile(
    options.output,
    `${bundleRoot}/manifest.json`,
    `${JSON.stringify(bundle.manifest, null, 2)}\n`
  );
  for (const asset of bundle.assets) {
    await writePackageFile(options.output, `${bundleRoot}/${asset.path}`, asset.data);
  }

  const knowledge = [
    "Disposable Staging Onboarding Rehearsal",
    "",
    "The Atlas QA Brewer is a fictional specialty coffee product used only to validate ContentGate onboarding.",
    "Its approved campaign claim is: Consistent campaign output from governed source knowledge.",
    "All records, users, and files in this workspace must be removed after the rehearsal.",
  ].join("\n");
  await writePackageFile(options.output, "knowledge/approved-brief.txt", `${knowledge}\n`);
  await writePackageFile(options.output, "assets/atlas-qa-brewer.png", productImage);

  const blueprint: WorkspaceBlueprint = {
    schemaVersion: "contentgate-workspace-v1",
    workspace: {
      key: options.workspaceKey,
      name: "Disposable Staging Onboarding QA",
      industry: "Specialty coffee QA",
    },
    users: [
      {
        key: "client-admin",
        email: options.adminEmail,
        fullName: "Disposable Client Admin",
        role: "admin",
      },
      {
        key: "client-member",
        email: options.memberEmail,
        fullName: "Disposable Client Member",
        role: "member",
      },
    ],
    products: [
      {
        key: "atlas-qa-brewer",
        name: "Atlas QA Brewer",
        description: "A fictional specialty coffee product for a disposable staging rehearsal.",
        disclaimer: "Staging QA only. Not for publication.",
      },
    ],
    campaigns: [
      {
        key: "governed-launch",
        productKey: "atlas-qa-brewer",
        name: "Governed launch rehearsal",
        status: "active",
        brief: "Validate initial client provisioning, governed generation, review, and export.",
      },
    ],
    documents: [
      {
        key: "approved-rehearsal-brief",
        productKey: "atlas-qa-brewer",
        title: "Approved rehearsal brief",
        file: "knowledge/approved-brief.txt",
        approvalStatus: "approved",
      },
    ],
    claims: [
      {
        key: "governed-output-claim",
        productKey: "atlas-qa-brewer",
        text: "Consistent campaign output from governed source knowledge.",
        sourceDocumentKey: "approved-rehearsal-brief",
        sourceParagraph: 2,
        status: "approved",
      },
    ],
    assets: [
      {
        key: "atlas-product-image",
        productKey: "atlas-qa-brewer",
        type: "packshot",
        file: "assets/atlas-qa-brewer.png",
        title: "Atlas QA Brewer packshot",
        altText: "Fictional Atlas QA Brewer product packshot for staging QA",
        tags: ["staging", "qa", "packshot"],
        approvalStatus: "approved",
      },
    ],
    templateBundles: [
      {
        key: "local-premium",
        directory: bundleRoot,
        assignToProducts: ["atlas-qa-brewer"],
      },
    ],
    qa: {
      productKey: "atlas-qa-brewer",
      templateBundleKey: "local-premium",
      templateName: bundle.manifest.family.name,
      outputSizeKey: square.key,
      outputSizeLabel: square.label,
      outputWidth: square.width,
      outputHeight: square.height,
      knowledgeQuestion: "What is the approved campaign claim for Atlas QA Brewer?",
    },
  };
  await writePackageFile(
    options.output,
    "blueprint.json",
    `${JSON.stringify(blueprint, null, 2)}\n`
  );
  console.log(
    JSON.stringify({
      output: options.output,
      workspaceKey: options.workspaceKey,
      users: blueprint.users.length,
      products: blueprint.products.length,
      documents: blueprint.documents?.length ?? 0,
      assets: blueprint.assets?.length ?? 0,
      templateBundles: blueprint.templateBundles?.length ?? 0,
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
