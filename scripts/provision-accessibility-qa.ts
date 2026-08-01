import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { checkOnboardingEnvironment, currentOnboardingEnvironmentInput } from "../src/lib/onboarding/environment.ts";

loadEnvConfig(process.cwd());

const ADMIN_EMAIL = process.env.CONTENTGATE_E2E_EMAIL?.trim().toLowerCase();
const QA_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;
const MEMBER_EMAIL =
  process.env.CONTENTGATE_E2E_MEMBER_EMAIL?.trim().toLowerCase() ??
  "qa-accessibility-member@contentgate.example";
const APPROVER_EMAIL =
  process.env.CONTENTGATE_E2E_APPROVER_EMAIL?.trim().toLowerCase() ??
  "qa-accessibility-approver@contentgate.example";
const PRODUCT_NAME =
  process.env.CONTENTGATE_E2E_PRODUCT_NAME?.trim() ?? "Accessibility QA Product";
const DOCUMENT_TITLE = "Accessibility QA Approved Source";
const CONTENT_TITLE = "Accessibility QA Review Draft";

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function throwOnError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

function firstRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function main() {
  const environment = checkOnboardingEnvironment(
    currentOnboardingEnvironmentInput({ workspaceKey: "accessibility-qa" }),
  );
  if (!environment.ok || environment.target !== "staging") {
    throw new Error(
      [
        "Accessibility QA provisioning is staging-only.",
        ...environment.errors,
      ].join("\n"),
    );
  }

  const admin = createClient(
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: adminDirectory, error: adminLookupError } = await admin.rpc(
    "find_onboarding_user_by_email",
    { p_email: required(ADMIN_EMAIL, "CONTENTGATE_E2E_EMAIL") },
  );
  throwOnError(adminLookupError, "Look up QA admin");
  const qaAdmin = firstRow(
    adminDirectory as Array<{ user_id: string; organization_id: string | null }> | null,
  );
  if (!qaAdmin?.organization_id) {
    throw new Error("The QA admin must already have an organization profile.");
  }
  const organizationId = qaAdmin.organization_id;
  const adminUserId = qaAdmin.user_id;

  async function ensureRoleUser(email: string, role: "member" | "approver", fullName: string) {
    const { data: directory, error: lookupError } = await admin.rpc(
      "find_onboarding_user_by_email",
      { p_email: email },
    );
    throwOnError(lookupError, `Look up ${role} QA user`);
    const existing = firstRow(
      directory as Array<{ user_id: string; organization_id: string | null }> | null,
    );
    if (existing) {
      if (existing.organization_id !== organizationId) {
        throw new Error(`${email} already belongs to another workspace.`);
      }
      const { error: profileError } = await admin
        .from("profiles")
        .update({ role, full_name: fullName })
        .eq("id", existing.user_id)
        .eq("org_id", organizationId);
      throwOnError(profileError, `Update ${role} QA profile`);
      const { error: passwordError } = await admin.auth.admin.updateUserById(
        existing.user_id,
        { password: required(QA_PASSWORD, "CONTENTGATE_E2E_PASSWORD"), email_confirm: true },
      );
      throwOnError(passwordError, `Update ${role} QA password`);
      return existing.user_id;
    }

    const { error: provisionError } = await admin.rpc("provision_user", {
      provision_email: email,
      provision_org_id: organizationId,
      provision_role: role,
      provision_full_name: fullName,
    });
    throwOnError(provisionError, `Stage ${role} QA user`);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: required(QA_PASSWORD, "CONTENTGATE_E2E_PASSWORD"),
      email_confirm: true,
    });
    throwOnError(createError, `Create ${role} QA user`);
    if (!created.user) throw new Error(`Create ${role} QA user returned no user.`);
    return created.user.id;
  }

  const [memberUserId, approverUserId] = await Promise.all([
    ensureRoleUser(MEMBER_EMAIL, "member", "Accessibility QA Member"),
    ensureRoleUser(APPROVER_EMAIL, "approver", "Accessibility QA Approver"),
  ]);

  const { data: existingProduct, error: productLookupError } = await admin
    .from("products")
    .select("id")
    .eq("org_id", organizationId)
    .eq("name", PRODUCT_NAME)
    .maybeSingle();
  throwOnError(productLookupError, "Look up QA product");
  let productId = existingProduct?.id as string | undefined;
  if (!productId) {
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({
        org_id: organizationId,
        product_key: "accessibility-qa-product",
        name: PRODUCT_NAME,
        description: "A disposable, deterministic product used to exercise every ContentGate UI route.",
        disclaimer_text: "QA fixture only. Not for production use.",
        status: "active",
      })
      .select("id")
      .single();
    throwOnError(productError, "Create QA product");
    productId = product?.id;
  }
  if (!productId) throw new Error("QA product creation returned no ID.");

  const paragraphs = [
    { n: 1, text: "Accessibility QA Product is approved for deterministic accessibility testing." },
    { n: 2, text: "All fixture content is disposable and must never be used as a production claim." },
  ];
  const { data: existingDocument, error: documentLookupError } = await admin
    .from("documents")
    .select("id")
    .eq("org_id", organizationId)
    .eq("title", DOCUMENT_TITLE)
    .maybeSingle();
  throwOnError(documentLookupError, "Look up QA source document");
  let documentId = existingDocument?.id as string | undefined;
  if (!documentId) {
    const { data: document, error: documentError } = await admin
      .from("documents")
      .insert({
        org_id: organizationId,
        document_key: "accessibility-qa-source",
        product_id: productId,
        uploaded_by: adminUserId,
        title: DOCUMENT_TITLE,
        file_type: "text/plain",
        content_text: paragraphs.map((paragraph) => paragraph.text).join("\n\n"),
        paragraphs,
        approval_status: "approved",
      })
      .select("id")
      .single();
    throwOnError(documentError, "Create QA source document");
    documentId = document?.id;
  }
  if (!documentId) throw new Error("QA source creation returned no ID.");

  const { data: existingClaim, error: claimLookupError } = await admin
    .from("product_claims")
    .select("id")
    .eq("org_id", organizationId)
    .eq("product_id", productId)
    .eq("claim_key", "accessibility-qa-claim")
    .maybeSingle();
  throwOnError(claimLookupError, "Look up QA claim");
  if (!existingClaim) {
    const { error: claimError } = await admin.from("product_claims").insert({
      org_id: organizationId,
      product_id: productId,
      claim_key: "accessibility-qa-claim",
      claim_text: paragraphs[0].text,
      status: "approved",
      source_document_id: documentId,
      source_paragraph_n: 1,
      source_excerpt: paragraphs[0].text,
    });
    throwOnError(claimError, "Create QA claim");
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("product_template_assignments")
    .select("id, template_version_id, default_variant_key, default_payload, template_families(name)")
    .eq("org_id", organizationId)
    .eq("product_id", productId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  throwOnError(assignmentError, "Look up QA template assignment");

  let contentId: string | null = null;
  let templateName: string | null = null;
  if (assignment?.id && assignment.template_version_id && assignment.default_variant_key) {
    const { data: variant, error: variantError } = await admin
      .from("template_variants")
      .select("id")
      .eq("org_id", organizationId)
      .eq("template_version_id", assignment.template_version_id)
      .eq("variant_key", assignment.default_variant_key)
      .single();
    throwOnError(variantError, "Look up QA template variant");
    if (!variant?.id) throw new Error("QA template variant lookup returned no ID.");

    const { data: existingContent, error: contentLookupError } = await admin
      .from("generated_content")
      .select("id")
      .eq("org_id", organizationId)
      .eq("product_id", productId)
      .eq("title", CONTENT_TITLE)
      .maybeSingle();
    throwOnError(contentLookupError, "Look up QA generated content");
    contentId = (existingContent?.id as string | undefined) ?? null;
    if (!contentId) {
      const structuredFields = (assignment.default_payload ?? {}) as Record<string, string>;
      const firstField = Object.keys(structuredFields)[0] ?? "headline";
      const { data: content, error: contentError } = await admin
        .from("generated_content")
        .insert({
          org_id: organizationId,
          created_by: adminUserId,
          product_id: productId,
          template_version_id: assignment.template_version_id,
          template_variant_id: variant.id,
          source_document_ids: [documentId],
          citations: [
            {
              field: firstField,
              approved_source: `${DOCUMENT_TITLE} ¶1`,
              excerpt: paragraphs[0].text,
            },
          ],
          title: CONTENT_TITLE,
          body: Object.values(structuredFields).join("\n\n"),
          target_language: "en",
          status: "in_review",
          structured_fields: structuredFields,
          prompt_context: {
            platform_assignment_id: assignment.id,
            output_size: assignment.default_variant_key,
            compliance_state: "generated",
            generated_fields: Object.keys(structuredFields),
          },
        })
        .select("id")
        .single();
      throwOnError(contentError, "Create QA generated content");
      contentId = content?.id ?? null;
    }
    const family = firstRow(assignment.template_families as { name: string } | { name: string }[] | null);
    templateName = family?.name ?? null;
  }

  console.log(
    JSON.stringify(
      {
        organizationId,
        users: {
          admin: { email: ADMIN_EMAIL, userId: adminUserId },
          approver: { email: APPROVER_EMAIL, userId: approverUserId },
          member: { email: MEMBER_EMAIL, userId: memberUserId },
        },
        fixture: {
          productId,
          productName: PRODUCT_NAME,
          documentId,
          assignmentId: assignment?.id ?? null,
          templateName,
          contentId,
        },
        nextStep: assignment
          ? "Fixture is complete."
          : "Install and assign a template bundle, then rerun this command to create Studio content.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
