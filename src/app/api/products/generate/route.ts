import { createClient } from "@/lib/supabase/server";
import { flattenFields, revisionInstruction, type Evidence } from "@/lib/templates";
import {
  formatGeneratedCopyQualityIssues,
  generatedCopyQualityIssues,
} from "@/lib/generated-copy-quality";
import {
  fieldLimitInstruction,
  templateFieldIssues,
} from "@/lib/template-fields";
import { isProductLifecycleActive } from "@/lib/product-workspace";
import {
  citationQuote,
  findGroundingSource,
  generatedCopyEvidenceIssues,
} from "@/lib/evidence-validation";
import {
  aiEditableTemplateFields,
  composeStructuredFieldsForGeneration,
  localeIsAllowedForGeneration,
  requiredEvidenceFieldKeys,
} from "@/lib/generation-evidence";
import { resolveTemplateAssetChoiceValues } from "@/lib/template-platform/asset-choice-values";
import { consumeApiRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  normalizeTemplatePlatformAssignment,
  type TemplatePlatformAssignmentRow,
} from "@/lib/template-platform/assignments";
import {
  BACKGROUND_CHOICE_FIELD,
  getTemplateBundleVariantAssetChoiceFields,
  getTemplateBundleVariantFieldLimits,
  resolveTemplateBundleRuntimeVariant,
} from "@/lib/template-platform/runtime";
import {
  coerceTemplatePlatformFieldsToFit,
  formatTemplatePlatformFitIssues,
  templatePlatformFieldFitIssues,
  templatePlatformFitInstructions,
} from "@/lib/template-platform/fit";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import {
  logTemplatePipelineEvent,
  templatePipelineDuration,
} from "@/lib/template-platform/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_GENERATION_MODEL =
  process.env.OPENAI_GENERATION_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-5.6-terra";
const PLATFORM_GENERATION_ATTEMPTS = Math.max(
  1,
  Number(process.env.PLATFORM_GENERATION_ATTEMPTS ?? "2")
);
const MAX_GENERATION_SOURCE_PARAGRAPHS = 24;

type Body = {
  productTemplateId?: string;
  platformAssignmentId?: string;
  language?: string;
  outputSize?: string;
  backgroundChoice?: string;
  productVariantChoice?: string;
  assetChoices?: Record<string, unknown>;
  revisions?: string[]; // controlled revision keys, applied as extra instructions
  replaceContentId?: string; // when revising, update this draft in place
  sourceContentId?: string; // when adapting another size, preserve the same campaign idea
};

const SUPPORTED_GENERATION_LANGUAGES = new Set([
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
  structured_fields: Record<string, string> | null;
};

type CampaignSourceRow = {
  id: string;
  template_variant_id: string | null;
  structured_fields: Record<string, string> | null;
  prompt_context: Record<string, unknown> | null;
  template_variants:
    | { variant_key: string; label: string | null }
    | { variant_key: string; label: string | null }[]
    | null;
};

type GeneratedCopy = {
  fields: Record<string, string>;
  evidence: Evidence[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function selectedProvider() {
  if (process.env.OPENAI_API_KEY) return "openai";
  return "fallback";
}

function parseGeneratedCopy(value: unknown): GeneratedCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { fields: {}, evidence: [] };
  }
  const raw = value as { fields?: unknown; evidence?: unknown };
  return {
    fields: asStringRecord(raw.fields),
    evidence: Array.isArray(raw.evidence) ? (raw.evidence as Evidence[]) : [],
  };
}

function openAIOutputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string") return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text)
      .join("\n") ?? ""
  );
}

async function generateWithOpenAI(input: {
  system: string;
  prompt: string;
  editableFields: string[];
}): Promise<GeneratedCopy> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI generation is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_GENERATION_MODEL,
      max_output_tokens: 1500,
      input: [
        {
          role: "system",
          content: input.system,
        },
        {
          role: "user",
          content: [
            input.prompt,
            "",
            "Return ONLY valid JSON matching this shape:",
            JSON.stringify({
              fields: Object.fromEntries(input.editableFields.map((field) => [field, ""])),
              evidence: [
                { field: input.editableFields[0] ?? "field", source_id: "C1", excerpt: "" },
              ],
            }),
            "Do not wrap it in Markdown.",
          ].join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `OpenAI generation failed (${response.status}): ${errorText.slice(0, 240)}`
    );
  }

  const json = (await response.json()) as OpenAIResponse;
  const text = openAIOutputText(json).trim();
  if (!text) throw new Error("OpenAI returned no text output.");
  return parseGeneratedCopy(JSON.parse(text));
}

type GroundingSource = { id: string; label: string; text: string };

// Assign stable, prompt-local ids to every approved claim and source paragraph
// so the model can cite exactly which one backs each field.
function buildGroundingSources(
  claims: readonly string[],
  paragraphs: readonly SourceEntry[]
): GroundingSource[] {
  return [
    ...claims.map((text, i) => ({
      id: `C${i + 1}`,
      label: `Approved claim ${i + 1}`,
      text,
    })),
    ...paragraphs.map((entry, i) => ({
      id: `P${i + 1}`,
      label: entry.label,
      text: entry.text,
    })),
  ];
}

// Resolve each model citation to a real approved source and keep only those
// whose quote appears verbatim in an approved source. The stored citation
// carries the verbatim excerpt (the verification key) plus the fuller source
// text for display; ids are prompt-local and not persisted.
function resolveApprovedEvidence(
  evidence: Evidence[],
  editableFields: string[],
  approvedSourceTexts: string[]
): Evidence[] {
  const validFields = new Set(editableFields);
  const resolved: Evidence[] = [];
  for (const item of evidence) {
    if (!item || typeof item.field !== "string" || !validFields.has(item.field)) {
      continue;
    }
    const quote = citationQuote({
      field: item.field,
      approved_source:
        typeof item.approved_source === "string" ? item.approved_source : "",
      excerpt: typeof item.excerpt === "string" ? item.excerpt : undefined,
    });
    const source = findGroundingSource(quote, approvedSourceTexts);
    if (!source) continue;
    resolved.push({
      field: item.field,
      approved_source: source,
      excerpt: quote,
    });
  }
  return resolved;
}

// Human-readable repair block appended to the next attempt when some field is
// not yet backed by a verbatim approved quote.
function groundingRepairInstruction(issues: string[]): string {
  const fields = issues
    .map((issue) => issue.split(":")[0]?.trim())
    .filter(Boolean);
  return [
    `GROUNDING REQUIRED: every field that makes a factual or benefit claim must be backed by evidence.`,
    fields.length
      ? `Fix these fields: ${fields.join(", ")}.`
      : ``,
    `For each, add an evidence entry with the source id (e.g. C1 or P2) and an "excerpt" copied WORD-FOR-WORD from that approved source. Do not assert anything that is not directly supported by an approved claim or source sentence.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function evidenceScopedFields(
  fields: Record<string, string>,
  evidenceRequiredFields: readonly string[]
) {
  return Object.fromEntries(
    evidenceRequiredFields.map((field) => [field, fields[field] ?? ""])
  );
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, String(child ?? "")])
  );
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function campaignSourceFields(row: CampaignSourceRow | ReplaceContentRow | null) {
  if (!row) return {};
  const campaignFields =
    row.prompt_context && typeof row.prompt_context === "object"
      ? asStringRecord(row.prompt_context.campaign_source_fields)
      : {};
  const generatedFields =
    row.prompt_context && typeof row.prompt_context === "object"
      ? asStringRecord(row.prompt_context.generated_fields)
      : {};
  const structuredFields = asStringRecord(row.structured_fields);
  if (Object.keys(campaignFields).length) return campaignFields;
  return Object.keys(generatedFields).length ? generatedFields : structuredFields;
}

function formatCampaignSource(input: {
  fields: Record<string, string>;
  sourceSizeLabel?: string | null;
}) {
  const entries = Object.entries(input.fields)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0);
  if (!entries.length) return "";
  return [
    `SOURCE CAMPAIGN IDEA${input.sourceSizeLabel ? ` (${input.sourceSizeLabel})` : ""}:`,
    ...entries.map(([key, value]) => `${key}: ${value}`),
  ].join("\n");
}

export async function POST(req: Request) {
  const startedAt = Date.now();
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
    backgroundChoice,
    productVariantChoice,
    assetChoices,
    revisions = [],
    replaceContentId,
    sourceContentId,
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
  if (!SUPPORTED_GENERATION_LANGUAGES.has(language)) {
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
    const outputSizeKey = typeof outputSize === "string" ? outputSize : null;
    if (!outputSizeKey) {
      return Response.json(
        { error: "Choose an output size before generating this template." },
        { status: 400 }
      );
    }

    const { data: assignmentRow } = await supabase
      .from("product_template_assignments")
      .select(
        "id, product_id, status, default_variant_key, generation_profile, default_payload, allowed_locales, template_families!product_template_assignments_template_family_id_fkey(id, family_key, name), template_versions!product_template_assignments_template_version_id_fkey(id, version_label, status, manifest)"
      )
      .eq("id", platformAssignmentId)
      .eq("org_id", profile.org_id)
      .single();
    if (!assignmentRow) {
      return Response.json({ error: "Template not found." }, { status: 404 });
    }
    const normalizedAssignment = normalizeTemplatePlatformAssignment(
      assignmentRow as TemplatePlatformAssignmentRow
    );
    if (!normalizedAssignment) {
      return Response.json(
        { error: "This template is not ready for content generation." },
        { status: 409 }
      );
    }
    const assignment = normalizedAssignment;
    const runtimeVariant = resolveTemplateBundleRuntimeVariant(
      assignment.manifest,
      outputSizeKey
    );
    if (!runtimeVariant) {
      return Response.json({ error: "Unsupported output size for this template." }, { status: 400 });
    }
    const allowedLocales = Array.isArray(
      (assignmentRow as TemplatePlatformAssignmentRow).allowed_locales
    )
      ? ((assignmentRow as TemplatePlatformAssignmentRow).allowed_locales as unknown[]).filter(
          (locale): locale is string => typeof locale === "string" && locale.length > 0
        )
      : ["en"];
    if (
      !SUPPORTED_GENERATION_LANGUAGES.has(language) ||
      !localeIsAllowedForGeneration({ language, allowedLocales })
    ) {
      return Response.json(
        { error: "This template is not approved for the selected language." },
        { status: 400 }
      );
    }

    let { data: variantRow } = await supabase
      .from("template_variants")
      .select("id")
      .eq("template_version_id", assignment.versionId)
      .eq("variant_key", outputSizeKey)
      .maybeSingle();
    if (!variantRow) {
      const fallbackVariant = await supabase
        .from("template_variants")
        .select("id")
        .eq("template_version_id", assignment.versionId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!fallbackVariant.data) {
        return Response.json({ error: "Template variant not found." }, { status: 409 });
      }
      variantRow = fallbackVariant.data;
    }

    let replaceContent: ReplaceContentRow | null = null;
    if (replaceContentId) {
      const { data: existingContent } = await supabase
        .from("generated_content")
        .select(
          "id, status, created_by, product_id, template_version_id, template_variant_id, prompt_context, structured_fields"
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
        (existingContent.template_variant_id !== variantRow.id &&
          existingContent.prompt_context?.output_size !== outputSizeKey)
      ) {
        return Response.json(
          { error: "This draft belongs to a different template or output size." },
          { status: 409 }
        );
      }
      replaceContent = existingContent as ReplaceContentRow;
    }

    let campaignSource: CampaignSourceRow | null = null;
    if (sourceContentId && sourceContentId !== replaceContentId) {
      const { data: sourceContent } = await supabase
        .from("generated_content")
        .select(
          "id, template_variant_id, structured_fields, prompt_context, template_variants!generated_content_template_variant_id_fkey(variant_key, label)"
        )
        .eq("id", sourceContentId)
        .eq("org_id", profile.org_id)
        .eq("product_id", assignment.productId)
        .eq("template_version_id", assignment.versionId)
        .in("status", ["draft", "rejected", "in_review", "approved"])
        .maybeSingle();

      if (!sourceContent) {
        return Response.json({ error: "Source draft was not found." }, { status: 404 });
      }
      campaignSource = sourceContent as CampaignSourceRow;
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, name, description, disclaimer_text, status")
      .eq("id", assignment.productId)
      .eq("org_id", profile.org_id)
      .single();
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    if (!isProductLifecycleActive(product.status)) {
      return Response.json(
        { error: "Content can only be generated for an active product." },
        { status: 409 }
      );
    }
    const productDisplayName = product.name;

    const [{ data: claims }, { data: docs }] = await Promise.all([
      supabase.from("product_claims").select("claim_text").eq("product_id", product.id).eq("status", "approved"),
      supabase
        .from("documents")
        .select("id, title, paragraphs")
        .eq("product_id", product.id)
        .eq("org_id", profile.org_id),
    ]);

    const aiFields = aiEditableTemplateFields(runtimeVariant.fields);
    const editableFields = aiFields.map((field) => field.key);
    const assetChoiceFields = getTemplateBundleVariantAssetChoiceFields(
      assignment.manifest,
      outputSizeKey
    );
    const assetChoiceFieldKeys = assetChoiceFields.map((field) => field.key);
    const allRuntimeFieldKeys = [
      ...runtimeVariant.fields.map((field) => field.key),
      ...assetChoiceFieldKeys,
    ];
    const evidenceRequiredFields = requiredEvidenceFieldKeys(runtimeVariant.fields);
    if (editableFields.length === 0) {
      return Response.json(
        { error: "This template has no AI-editable copy fields." },
        { status: 409 }
      );
    }
    const requiredFields = runtimeVariant.fields
      .filter((field) => field.source === "ai" && field.required !== false)
      .map((field) => field.key);
    const fieldLimits = getTemplateBundleVariantFieldLimits(
      assignment.manifest,
      outputSizeKey
    );
    const assetUrlByPath = Object.fromEntries(
      await createTemplateBundleAssetUrlMap(supabase, profile.org_id, [assignment.manifest])
    );
    const typographyInstructions = templatePlatformFitInstructions({
      manifest: assignment.manifest,
      variantKey: outputSizeKey,
    });
    const defaultCopy = asStringRecord(
      (assignmentRow as TemplatePlatformAssignmentRow).default_payload
    );
    const previousStructuredFields = asStringRecord(replaceContent?.structured_fields);
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
    const groundingSources = buildGroundingSources(approvedClaims, sourceEntries);
    // The raw source strings a cited quote is verified against (verbatim
    // containment). Labeled/id'd variants are for the prompt only.
    const approvedSourceTexts = groundingSources.map((source) => source.text);
    if (approvedSourceTexts.length === 0) {
      return Response.json(
        {
          error:
            "Add an approved claim or source document before generating compliant content.",
        },
        { status: 409 }
      );
    }
    const approvedEvidenceBlock = groundingSources
      .map((source) => `[${source.id}] (${source.label}) ${source.text}`)
      .join("\n");
    const extraInstructions = revisions
      .map(revisionInstruction)
      .filter(Boolean)
      .join(" ");
    const generationProfile =
      (assignmentRow as TemplatePlatformAssignmentRow).generation_profile &&
      typeof (assignmentRow as TemplatePlatformAssignmentRow).generation_profile === "object"
        ? JSON.stringify((assignmentRow as TemplatePlatformAssignmentRow).generation_profile)
        : "";
    const campaignSourceVariant = one(campaignSource?.template_variants);
    const campaignSourcePrompt = formatCampaignSource({
      fields: campaignSourceFields(campaignSource),
      sourceSizeLabel: campaignSourceVariant?.label ?? campaignSourceVariant?.variant_key,
    });
    const replaceSourcePrompt = formatCampaignSource({
      fields: campaignSourceFields(replaceContent),
    });
    const continuityPrompt = campaignSourcePrompt || replaceSourcePrompt;

    const system = [
      `You write compliant brand-content and localized marketing copy for "${productDisplayName}".`,
      `Use ONLY the approved claims and approved source text provided. Never invent features, integrations, pricing, customer guarantees, legal claims, or workflow capabilities. If a benefit is not supported by an approved claim or source, do not make it.`,
      `Write in ${language}.`,
      `Return structured content only in the requested machine-readable format.`,
    ].join(" ");

    const userPrompt = [
      `APPROVED EVIDENCE — the only facts you may use. Each item has an id (C… = approved claim, P… = approved source paragraph):`,
      approvedEvidenceBlock,
      ``,
      `TASK: Create copy for ${assignment.familyName}.`,
      generationProfile ? `GENERATION PROFILE: ${generationProfile}` : ``,
      continuityPrompt
        ? [
            ``,
            continuityPrompt,
            `This new output must be part of the same campaign idea. Preserve the same core message, CTA intent, tone, offer/benefit angle, and approved evidence. Adapt only the wording and length needed for the selected output size. Do not introduce a different campaign concept unless the additional direction explicitly asks for one.`,
          ].join("\n")
        : ``,
      extraInstructions ? `\nADDITIONAL DIRECTION: ${extraInstructions}` : ``,
      `\nSELECTED OUTPUT SIZE: ${runtimeVariant.variant.label} (${runtimeVariant.variant.width}x${runtimeVariant.variant.height}). Generate copy only for this size and stay inside its field limits.`,
      ``,
      `Produce exactly these AI-editable fields and no other fields: ${editableFields.join(", ")}.`,
      `FIELD LIMITS:`,
      editableFields.map((key) => fieldLimitInstruction(key, fieldLimits[key])).join("\n"),
      typographyInstructions.length ? `\nTYPOGRAPHIC FIT RULES:` : ``,
      typographyInstructions.join("\n"),
      typographyInstructions.length
        ? `These rendered-line limits are strict. Prefer shorter, complete wording rather than filling the character allowance.`
        : ``,
      `Every generated field must read like a complete thought. Short fragments are okay for CTAs and headlines, but never end a field with a dangling connector, broken hyphenated word, comma, colon, or dash.`,
      ``,
      `The existing template copy below is a length and tone reference only. Do not repeat unsupported facts from it:`,
      editableFields.map((key) => `${key}: ${defaultCopy[key] ?? ""}`).join("\n"),
      ``,
      `EVIDENCE: for every field that makes a factual or benefit claim, add an evidence entry with { field, source_id, excerpt } where source_id is the id (e.g. C2 or P1) of the approved item it rests on and excerpt is a short phrase copied WORD-FOR-WORD from that item. The excerpt must appear exactly, verbatim, in the cited approved item. You may reword the field copy freely, but the excerpt proves the claim is grounded. Command/label fields (CTA, button) do not need evidence.`,
    ].join("\n");

    try {
      const rateLimit = await consumeApiRateLimit(supabase, "content.generate");
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
    } catch (error) {
      console.error("content generation rate limit failed:", error);
      return Response.json({ error: "Generation is temporarily unavailable." }, { status: 503 });
    }

    const provider = selectedProvider();
    let out: { fields: Record<string, string>; evidence: Evidence[] } | null = null;
    let generatedFields: Record<string, string> = {};
    let structured: Record<string, string> = {};
    let verifiedEvidence: Evidence[] = [];
    let rawEvidenceCount = 0;
    let fitReasons: string[] = [];
    let groundingIssues: string[] = [];
    const generationMode = "ai";

    for (let attempt = 0; attempt < PLATFORM_GENERATION_ATTEMPTS; attempt += 1) {
      const repairBlocks = [
        fitReasons.length
          ? [
              `REWRITE REQUIRED: the previous draft failed the locked template fit check:`,
              ...fitReasons.map((reason) => `- ${reason}`),
              `Return a shorter, complete rewrite. Do not truncate a sentence and do not repeat the failed wording.`,
            ].join("\n")
          : ``,
        groundingIssues.length ? groundingRepairInstruction(groundingIssues) : ``,
      ].filter(Boolean);
      const attemptPrompt = repairBlocks.length
        ? [userPrompt, ``, ...repairBlocks].join("\n")
        : userPrompt;

      if (provider === "fallback") {
        return Response.json(
          { error: "Generation is temporarily unavailable." },
          { status: 503 }
        );
      }

      try {
        const candidate = await generateWithOpenAI({
          system,
          prompt: attemptPrompt,
          editableFields,
        });

        const candidateEvidence = Array.isArray(candidate.evidence)
          ? candidate.evidence
          : [];
        generatedFields = Object.fromEntries(
          editableFields.map((key) => [
            key,
            String(candidate.fields?.[key] ?? "")
              .replace(/\r\n?/g, "\n")
              .trim(),
          ])
        );
        structured = composeStructuredFieldsForGeneration({
          allFieldKeys: allRuntimeFieldKeys,
          aiFieldKeys: editableFields,
          generatedFields,
          defaultFields: defaultCopy,
          previousFields: previousStructuredFields,
        });
        const configuredIssues = templateFieldIssues(
          generatedFields,
          editableFields,
          fieldLimits,
          requiredFields
        );
        const geometryIssues = await templatePlatformFieldFitIssues({
          manifest: assignment.manifest,
          variantKey: outputSizeKey,
          fields: structured,
          assetUrlByPath,
        });
        const qualityIssues = generatedCopyQualityIssues(structured, editableFields);
        fitReasons = [
          ...editableFields.flatMap((key) =>
            (configuredIssues[key] ?? []).map((issue) => `${key}: ${issue.message}`)
          ),
          ...formatTemplatePlatformFitIssues(geometryIssues),
          ...formatGeneratedCopyQualityIssues(qualityIssues),
        ];

        verifiedEvidence = resolveApprovedEvidence(
          candidateEvidence,
          editableFields,
          approvedSourceTexts
        );
        rawEvidenceCount = candidateEvidence.length;
        groundingIssues = generatedCopyEvidenceIssues({
          fields: evidenceScopedFields(structured, evidenceRequiredFields),
          evidence: verifiedEvidence,
          approvedSources: approvedSourceTexts,
        });

        if (!fitReasons.length && !groundingIssues.length) {
          out = { fields: structured, evidence: verifiedEvidence };
          break;
        }
      } catch (err) {
        console.error("platform generation provider failed:", err);
        return Response.json(
          { error: "Generation is temporarily unavailable. Please try again." },
          { status: 503 }
        );
      }
    }

    let coercedTruncatedFields: string[] = [];
    // Fit-only coercion fallback: shrink/trim to satisfy the geometry gate.
    // Only attempt when grounding already passed — coercion cannot fix an
    // ungrounded claim, and it only removes words, so the verified citations
    // from the last attempt still hold.
    if (!out && !groundingIssues.length && Object.values(structured).some(Boolean)) {
      const coerceResult = await coerceTemplatePlatformFieldsToFit({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        fields: generatedFields,
        assetUrlByPath,
      });
      structured = coerceResult.fields;
      coercedTruncatedFields = coerceResult.truncatedFields;
      const configuredIssues = templateFieldIssues(
        structured,
        editableFields,
        fieldLimits,
        requiredFields
      );
      const geometryIssues = await templatePlatformFieldFitIssues({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        fields: structured,
        assetUrlByPath,
      });
      const qualityIssues = generatedCopyQualityIssues(structured, editableFields);
      fitReasons = [
        ...editableFields.flatMap((key) =>
          (configuredIssues[key] ?? []).map((issue) => `${key}: ${issue.message}`)
        ),
        ...formatTemplatePlatformFitIssues(geometryIssues),
        ...formatGeneratedCopyQualityIssues(qualityIssues),
      ];
      groundingIssues = generatedCopyEvidenceIssues({
        fields: evidenceScopedFields(structured, evidenceRequiredFields),
        evidence: verifiedEvidence,
        approvedSources: approvedSourceTexts,
      });
      if (!fitReasons.length && !groundingIssues.length) {
        out = { fields: structured, evidence: verifiedEvidence };
      }
    }

    if (!out) {
      if (fitReasons.length) {
        console.error("platform generated copy failed template fit validation:", {
          platformAssignmentId,
          outputSize: outputSizeKey,
          reasons: fitReasons,
        });
        return Response.json(
          {
            error:
              "ContentGate could not produce copy that safely fits this size. Please try again.",
          },
          { status: 422 }
        );
      }
      const ungroundedFields = groundingIssues
        .map((issue) => issue.split(":")[0]?.trim())
        .filter(Boolean);
      console.error("platform generated copy failed evidence validation:", {
        platformAssignmentId,
        outputSize: outputSizeKey,
        reasons: groundingIssues,
      });
      return Response.json(
        {
          error: ungroundedFields.length
            ? `ContentGate could not ground ${ungroundedFields.join(", ")} in an approved claim or source. Add an approved claim or source that supports this copy, then try again.`
            : "ContentGate could not verify that every generated claim is grounded in approved sources.",
        },
        { status: 422 }
      );
    }

    const evidence = out.evidence;
    const rejectedEvidenceCount = Math.max(0, rawEvidenceCount - evidence.length);
    const inheritedBackgroundChoice =
      (typeof backgroundChoice === "string" && backgroundChoice.length > 0
        ? backgroundChoice
        : null) ??
      asStringRecord(replaceContent?.structured_fields)[BACKGROUND_CHOICE_FIELD] ??
      asStringRecord(campaignSource?.structured_fields)[BACKGROUND_CHOICE_FIELD];
    if (inheritedBackgroundChoice) {
      structured[BACKGROUND_CHOICE_FIELD] = inheritedBackgroundChoice;
    }
    structured = {
      ...structured,
      ...resolveTemplateAssetChoiceValues({
        fields: assetChoiceFields,
        requestedChoices: assetChoices,
        legacyProductVariantChoice: productVariantChoice,
        replaceFields: asStringRecord(replaceContent?.structured_fields),
        campaignSourceFields: asStringRecord(campaignSource?.structured_fields),
        defaultCopy,
      }),
    };
    const title = `${productDisplayName} · ${assignment.familyName}`;
    const body = flattenFields(structured, editableFields);
    const savedAt = new Date().toISOString();
    const sourcePromptContext =
      campaignSource?.prompt_context && typeof campaignSource.prompt_context === "object"
        ? campaignSource.prompt_context
        : null;
    const existingCampaignRoot =
      typeof sourcePromptContext?.campaign_root_content_id === "string"
        ? sourcePromptContext.campaign_root_content_id
        : typeof replaceContent?.prompt_context?.campaign_root_content_id === "string"
          ? replaceContent.prompt_context.campaign_root_content_id
          : null;
    const campaignRootContentId =
      existingCampaignRoot ?? campaignSource?.id ?? replaceContent?.id ?? null;
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
      campaign_root_content_id: campaignRootContentId,
      campaign_source_content_id: campaignSource?.id ?? replaceContent?.id ?? null,
      campaign_source_fields: continuityPrompt
        ? campaignSourceFields(campaignSource ?? replaceContent)
        : structured,
      field_limits: fieldLimits,
      generated_fields: generatedFields,
      manually_edited_fields: [],
      compliance_state: "generated",
      ai_provider: provider,
      ai_model: OPENAI_GENERATION_MODEL,
      generation_mode: generationMode,
      evidence_validation: {
        accepted: evidence.length,
        rejected: rejectedEvidenceCount,
        warnings: groundingIssues,
        required_fields: evidenceRequiredFields,
        enforcement: "fail_closed",
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
    logTemplatePipelineEvent({
      event: "template.generate",
      ok: true,
      orgId: profile.org_id,
      userId: user.id,
      productId: product.id,
      platformAssignmentId: assignment.assignmentId,
      familyKey: assignment.familyKey,
      versionName: assignment.versionLabel,
      variantKey: outputSizeKey,
      templateVersionId: assignment.versionId,
      durationMs: templatePipelineDuration(startedAt),
    });

    return Response.json({
      contentId: row.id,
      structured_fields: structured,
      outputSize: outputSizeKey,
      campaignRootContentId: campaignRootContentId ?? row.id,
      evidence,
      title,
      platform: true,
      truncatedFields: coercedTruncatedFields,
    });
  }

  return Response.json(
    { error: "This older template is read-only. Choose an approved template." },
    { status: 410 }
  );
}
