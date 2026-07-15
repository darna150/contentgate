import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { flattenFields, revisionInstruction, type Evidence } from "@/lib/templates";
import {
  fieldLimitInstruction,
  templateFieldIssues,
} from "@/lib/template-fields";
import { TEMPLATE_OUTPUT_SIZES, type TemplateSizeKey } from "@/lib/template-contract";
import { isProductLifecycleActive } from "@/lib/product-workspace";
import { evidenceSourceIsApproved } from "@/lib/evidence-validation";
import { consumeApiRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  normalizeTemplatePlatformAssignment,
  type TemplatePlatformAssignmentRow,
} from "@/lib/template-platform/assignments";
import {
  getTemplateBundleVariantFieldLimits,
  resolveTemplateBundleRuntimeVariant,
} from "@/lib/template-platform/runtime";
import {
  coerceTemplatePlatformFieldsToFit,
  formatTemplatePlatformFitIssues,
  templatePlatformFieldFitIssues,
  templatePlatformFitInstructions,
} from "@/lib/template-platform/fit";

export const runtime = "nodejs";
export const maxDuration = 60;

const GENERATION_MODEL =
  process.env.ANTHROPIC_GENERATION_MODEL ??
  process.env.ANTHROPIC_MODEL ??
  "claude-sonnet-4-6";
const PLATFORM_GENERATION_ATTEMPTS = Math.max(
  1,
  Number(process.env.PLATFORM_GENERATION_ATTEMPTS ?? "1")
);
const MAX_GENERATION_SOURCE_PARAGRAPHS = 24;

type Body = {
  productTemplateId?: string;
  platformAssignmentId?: string;
  language?: string;
  outputSize?: string;
  revisions?: string[]; // controlled revision keys, applied as extra instructions
  replaceContentId?: string; // when revising, update this draft in place
};

const ALLOWED_LANGUAGES = new Set([
  "English",
  "Filipino",
  "Spanish",
  "Portuguese",
  "Vietnamese",
  "Thai",
]);

type SourceEntry = {
  label: string;
  text: string;
};

type ReplaceContentRow = {
  id: string;
  status: string;
  created_by: string;
  product_id: string;
  template_version_id: string | null;
  template_variant_id: string | null;
  prompt_context: Record<string, unknown> | null;
};

function filterApprovedEvidence(
  evidence: Evidence[],
  editableFields: string[],
  approvedSources: string[]
) {
  const validFields = new Set(editableFields);
  return evidence.filter((item) => {
    if (!validFields.has(item.field)) return false;
    if (typeof item.approved_source !== "string") return false;
    return evidenceSourceIsApproved(item.approved_source, approvedSources);
  });
}

function asTemplateSizeKey(value: unknown): TemplateSizeKey | null {
  return typeof value === "string" && value in TEMPLATE_OUTPUT_SIZES
    ? (value as TemplateSizeKey)
    : null;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, String(child ?? "")])
  );
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Generation is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let requestBody: Body;
  try {
    requestBody = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const {
    productTemplateId,
    platformAssignmentId,
    language = "English",
    outputSize,
    revisions = [],
    replaceContentId,
  } = requestBody;
  if (productTemplateId) {
    return Response.json(
      { error: "This older template is read-only. Choose an approved template." },
      { status: 410 }
    );
  }
  if (!platformAssignmentId) {
    return Response.json({ error: "Missing approved template." }, { status: 400 });
  }
  if (!ALLOWED_LANGUAGES.has(language)) {
    return Response.json({ error: "Unsupported language." }, { status: 400 });
  }
  if (!Array.isArray(revisions) || revisions.length > 1) {
    return Response.json({ error: "Invalid refinement selection." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return Response.json({ error: "No profile." }, { status: 401 });

  if (platformAssignmentId) {
    const outputSizeKey = asTemplateSizeKey(outputSize);
    if (!outputSizeKey) {
      return Response.json(
        { error: "Choose an output size before generating this template." },
        { status: 400 }
      );
    }

    const { data: assignmentRow } = await supabase
      .from("product_template_assignments")
      .select(
        "id, product_id, status, default_variant_key, generation_profile, default_payload, template_families(id, family_key, name), template_versions(id, version_label, status, manifest)"
      )
      .eq("id", platformAssignmentId)
      .eq("org_id", profile.org_id)
      .single();
    if (!assignmentRow) {
      return Response.json({ error: "Template not found." }, { status: 404 });
    }
    const assignment = normalizeTemplatePlatformAssignment(
      assignmentRow as TemplatePlatformAssignmentRow
    );
    if (!assignment) {
      return Response.json(
        { error: "This template is not ready for content generation." },
        { status: 409 }
      );
    }
    const runtimeVariant = resolveTemplateBundleRuntimeVariant(
      assignment.manifest,
      outputSizeKey
    );
    if (!runtimeVariant) {
      return Response.json({ error: "Unsupported output size for this template." }, { status: 400 });
    }

    const { data: variantRow } = await supabase
      .from("template_variants")
      .select("id")
      .eq("template_version_id", assignment.versionId)
      .eq("variant_key", outputSizeKey)
      .single();
    if (!variantRow) {
      return Response.json({ error: "Template variant not found." }, { status: 409 });
    }

    let replaceContent: ReplaceContentRow | null = null;
    if (replaceContentId) {
      const { data: existingContent } = await supabase
        .from("generated_content")
        .select(
          "id, status, created_by, product_id, template_version_id, template_variant_id, prompt_context"
        )
        .eq("id", replaceContentId)
        .eq("org_id", profile.org_id)
        .single();
      if (!existingContent) {
        return Response.json({ error: "Draft to regenerate was not found." }, { status: 404 });
      }
      if (existingContent.created_by !== user.id) {
        return Response.json({ error: "Only the draft author can regenerate it." }, { status: 403 });
      }
      if (!["draft", "rejected"].includes(existingContent.status)) {
        return Response.json(
          { error: "Only draft or returned content can be regenerated." },
          { status: 409 }
        );
      }
      if (
        existingContent.product_id !== assignment.productId ||
        existingContent.template_version_id !== assignment.versionId ||
        existingContent.template_variant_id !== variantRow.id
      ) {
        return Response.json(
          { error: "This draft belongs to a different template or output size." },
          { status: 409 }
        );
      }
      replaceContent = existingContent as ReplaceContentRow;
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, name, description, disclaimer_text, status")
      .eq("id", assignment.productId)
      .single();
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    if (!isProductLifecycleActive(product.status)) {
      return Response.json(
        { error: "Content can only be generated for an active product." },
        { status: 409 }
      );
    }

    const [{ data: claims }, { data: docs }] = await Promise.all([
      supabase.from("product_claims").select("claim_text").eq("product_id", product.id).eq("status", "approved"),
      supabase
        .from("documents")
        .select("id, title, paragraphs")
        .eq("product_id", product.id),
    ]);

    const editableFields = runtimeVariant.fields.map((field) => field.key);
    const fieldLimits = getTemplateBundleVariantFieldLimits(
      assignment.manifest,
      outputSizeKey
    );
    const typographyInstructions = templatePlatformFitInstructions({
      manifest: assignment.manifest,
      variantKey: outputSizeKey,
    });
    const defaultCopy = asStringRecord(
      (assignmentRow as TemplatePlatformAssignmentRow).default_payload
    );
    const approvedClaims = (claims ?? []).map((c) => c.claim_text);
    const sourceDocs = docs ?? [];
    const sourceEntries: SourceEntry[] = sourceDocs
      .flatMap((d) =>
        ((d.paragraphs as { n: number; text: string }[]) ?? []).map((p) => ({
          label: `${d.title} ¶${p.n}`,
          text: p.text,
        }))
      )
      .slice(0, MAX_GENERATION_SOURCE_PARAGRAPHS);
    const sourceText = sourceEntries
      .map((entry) => `[${entry.label}] ${entry.text}`)
      .join("\n");
    const approvedEvidenceSources = [
      ...approvedClaims,
      ...sourceEntries.map((entry) => entry.text),
      ...sourceEntries.map((entry) => `[${entry.label}] ${entry.text}`),
    ];
    const extraInstructions = revisions
      .map(revisionInstruction)
      .filter(Boolean)
      .join(" ");
    const generationProfile =
      (assignmentRow as TemplatePlatformAssignmentRow).generation_profile &&
      typeof (assignmentRow as TemplatePlatformAssignmentRow).generation_profile === "object"
        ? JSON.stringify((assignmentRow as TemplatePlatformAssignmentRow).generation_profile)
        : "";

    const system = [
      `You write compliant brand-content and localized marketing copy for "${product.name}".`,
      `Use ONLY the approved claims and approved source text provided. Never invent features, integrations, pricing, customer guarantees, legal claims, or workflow capabilities. If a benefit is not supported by an approved claim or source, do not make it.`,
      `Write in ${language}.`,
      `Return your answer only through the provided tool.`,
    ].join(" ");

    const userPrompt = [
      `APPROVED CLAIMS (the only claims you may make):`,
      approvedClaims.map((c, i) => `${i + 1}. ${c}`).join("\n"),
      ``,
      `APPROVED SOURCE TEXT:`,
      sourceText,
      ``,
      `TASK: Create copy for ${assignment.familyName}.`,
      generationProfile ? `GENERATION PROFILE: ${generationProfile}` : ``,
      extraInstructions ? `\nADDITIONAL DIRECTION: ${extraInstructions}` : ``,
      `\nSELECTED OUTPUT SIZE: ${TEMPLATE_OUTPUT_SIZES[outputSizeKey].label} (${TEMPLATE_OUTPUT_SIZES[outputSizeKey].w}x${TEMPLATE_OUTPUT_SIZES[outputSizeKey].h}). Generate copy only for this size and stay inside its field limits.`,
      ``,
      `Produce exactly these fields: ${editableFields.join(", ")}.`,
      `FIELD LIMITS:`,
      editableFields.map((key) => fieldLimitInstruction(key, fieldLimits[key])).join("\n"),
      typographyInstructions.length ? `\nTYPOGRAPHIC FIT RULES:` : ``,
      typographyInstructions.join("\n"),
      typographyInstructions.length
        ? `These rendered-line limits are strict. Prefer shorter, complete wording rather than filling the character allowance.`
        : ``,
      ``,
      `The existing template copy below is a length and tone reference only. Do not repeat unsupported facts from it:`,
      editableFields.map((key) => `${key}: ${defaultCopy[key] ?? ""}`).join("\n"),
      `For every field that makes a factual or benefit claim, add an evidence entry naming the approved claim or approved source sentence it rests on.`,
    ].join("\n");

    const fieldProps: Record<string, { type: "string"; maxLength?: number }> = {};
    for (const f of editableFields) {
      fieldProps[f] = {
        type: "string",
        ...(fieldLimits[f]?.max_chars ? { maxLength: fieldLimits[f].max_chars } : {}),
      };
    }

    try {
      const rateLimit = await consumeApiRateLimit(supabase, "content.generate");
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    } catch (error) {
      console.error("content generation rate limit failed:", error);
      return Response.json({ error: "Generation is temporarily unavailable." }, { status: 503 });
    }

    const anthropic = new Anthropic();
    const tool = {
      name: "build_asset_content",
      description:
        "Return finished, compliant copy that fits the selected template size and the approved evidence behind each claim.",
      input_schema: {
        type: "object" as const,
        properties: {
          fields: {
            type: "object" as const,
            properties: fieldProps,
            required: editableFields,
          },
          evidence: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                field: { type: "string" as const },
                approved_source: { type: "string" as const },
              },
              required: ["field", "approved_source"],
            },
          },
        },
        required: ["fields", "evidence"],
      },
    };

    let out: { fields: Record<string, string>; evidence: Evidence[] } | null = null;
    let structured: Record<string, string> = {};
    let lastCandidateEvidence: Evidence[] = [];
    let retryReasons: string[] = [];

    for (let attempt = 0; attempt < PLATFORM_GENERATION_ATTEMPTS; attempt += 1) {
      const attemptPrompt = retryReasons.length
        ? [
            userPrompt,
            ``,
            `REWRITE REQUIRED: The previous draft failed the locked template fit check:`,
            ...retryReasons.map((reason) => `- ${reason}`),
            `Return a shorter, complete rewrite. Do not truncate a sentence and do not repeat the failed wording.`,
          ].join("\n")
        : userPrompt;

      let message;
      try {
        message = await anthropic.messages.create({
          model: GENERATION_MODEL,
          max_tokens: 1500,
          system,
          tool_choice: { type: "tool", name: "build_asset_content" },
          tools: [tool],
          messages: [{ role: "user", content: attemptPrompt }],
        });
      } catch (err) {
        console.error("platform generation failed:", err);
        return Response.json({ error: "Generation failed. Try again." }, { status: 502 });
      }

      const toolUse = message.content.find((block) => block.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        return Response.json({ error: "Model returned no structured output." }, { status: 502 });
      }
      const candidate = toolUse.input as {
        fields: Record<string, string>;
        evidence: Evidence[];
      };
      lastCandidateEvidence = Array.isArray(candidate.evidence)
        ? candidate.evidence
        : [];
      structured = Object.fromEntries(
        editableFields.map((key) => [
          key,
          String(candidate.fields?.[key] ?? "")
            .replace(/\r\n?/g, "\n")
            .trim(),
        ])
      );
      const configuredIssues = templateFieldIssues(
        structured,
        editableFields,
        fieldLimits
      );
      const geometryIssues = await templatePlatformFieldFitIssues({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        fields: structured,
      });
      retryReasons = [
        ...editableFields.flatMap((key) =>
          (configuredIssues[key] ?? []).map((issue) => `${key}: ${issue.message}`)
        ),
        ...formatTemplatePlatformFitIssues(geometryIssues),
      ];

      if (!retryReasons.length) {
        out = candidate;
        break;
      }
    }

    if (!out && Object.values(structured).some(Boolean)) {
      structured = await coerceTemplatePlatformFieldsToFit({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        fields: structured,
      });
      const configuredIssues = templateFieldIssues(
        structured,
        editableFields,
        fieldLimits
      );
      const geometryIssues = await templatePlatformFieldFitIssues({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        fields: structured,
      });
      retryReasons = [
        ...editableFields.flatMap((key) =>
          (configuredIssues[key] ?? []).map((issue) => `${key}: ${issue.message}`)
        ),
        ...formatTemplatePlatformFitIssues(geometryIssues),
      ];
      if (!retryReasons.length) {
        out = { fields: structured, evidence: lastCandidateEvidence };
      }
    }

    if (!out) {
      console.error("platform generated copy failed template fit validation:", {
        platformAssignmentId,
        outputSize: outputSizeKey,
        reasons: retryReasons,
      });
      return Response.json(
        {
          error:
            "ContentGate could not produce copy that safely fits this size. Please try again.",
        },
        { status: 422 }
      );
    }

    const rawEvidence = Array.isArray(out.evidence) ? out.evidence : [];
    const evidence = filterApprovedEvidence(
      rawEvidence,
      editableFields,
      approvedEvidenceSources
    );
    const rejectedEvidenceCount = rawEvidence.length - evidence.length;
    const title = `${product.name} · ${assignment.familyName}`;
    const body = flattenFields(structured, editableFields);
    const savedAt = new Date().toISOString();
    const promptContext = {
      ...(replaceContent?.prompt_context &&
      typeof replaceContent.prompt_context === "object"
        ? replaceContent.prompt_context
        : {}),
      language,
      output_size: outputSizeKey,
      revisions,
      platform_assignment_id: assignment.assignmentId,
      template_family_key: assignment.familyKey,
      template_version_id: assignment.versionId,
      template_variant_id: variantRow.id,
      field_limits: fieldLimits,
      generated_fields: structured,
      manually_edited_fields: [],
      compliance_state: "generated",
      evidence_validation: {
        accepted: evidence.length,
        rejected: rejectedEvidenceCount,
      },
      last_generated_at: savedAt,
    };

    const writeQuery = replaceContent
      ? supabase
          .from("generated_content")
          .update({
            structured_fields: structured,
            source_document_ids: sourceDocs.map((d) => d.id),
            citations: evidence,
            title,
            body,
            target_language: language,
            prompt_context: promptContext,
            template_version_id: assignment.versionId,
            template_variant_id: variantRow.id,
            renderer_version: "template-platform-v1",
            status: "draft",
            updated_at: savedAt,
          })
          .eq("id", replaceContent.id)
      : supabase.from("generated_content").insert({
          org_id: profile.org_id,
          created_by: user.id,
          product_id: product.id,
          product_template_id: null,
          template_version_id: assignment.versionId,
          template_variant_id: variantRow.id,
          renderer_version: "template-platform-v1",
          template_id: null,
          structured_fields: structured,
          source_document_ids: sourceDocs.map((d) => d.id),
          citations: evidence,
          title,
          body,
          target_language: language,
          prompt_context: promptContext,
          status: "draft",
        });

    const { data: row, error: writeError } = await writeQuery.select("id").single();

    if (writeError || !row) {
      return Response.json({ error: `Could not save draft: ${writeError?.message}` }, { status: 500 });
    }

    return Response.json({
      contentId: row.id,
      structured_fields: structured,
      outputSize: outputSizeKey,
      evidence,
      title,
      platform: true,
    });
  }

  return Response.json(
    { error: "This older template is read-only. Choose an approved template." },
    { status: 410 }
  );
}
