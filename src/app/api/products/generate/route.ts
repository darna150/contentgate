import { createClient } from "@/lib/supabase/server";
import { flattenFields, revisionInstruction, type Evidence } from "@/lib/templates";
import {
  meaningfulVariationIssues,
  revisionContractKind,
  revisionLengthIssues,
  semanticRevisionCriterion,
} from "@/lib/revision-contract";
import {
  formatGeneratedCopyQualityIssues,
  generatedCopyQualityIssues,
  repairGeneratedCopyQualityFields,
} from "@/lib/generated-copy-quality";
import { fieldLimitInstruction, templateFieldIssues } from "@/lib/template-fields";
import { graphemeCount } from "@/lib/graphemes";
import { sourceBackedFallbackCandidates } from "@/lib/generation-fallback";
import { isProductLifecycleActive } from "@/lib/product-workspace";
import {
  citationQuote,
  generatedCopyEvidenceIssues,
  resolvePromptGroundingCitation,
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
  getTemplateBundleVariantReferenceFields,
  resolveTemplateBundleRuntimeVariant,
} from "@/lib/template-platform/runtime";
import {
  calibrateTemplatePlatformFieldBudgets,
  coerceTemplatePlatformFieldsToFit,
  formatTemplatePlatformFitIssues,
  templatePlatformFieldFitIssues,
  templatePlatformFitInstructions,
  templatePlatformRequiredFieldIssues,
} from "@/lib/template-platform/fit";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import {
  logTemplatePipelineEvent,
  templatePipelineDuration,
} from "@/lib/template-platform/observability";
import {
  isSyntheticProviderFailureRequest,
  reportProviderIncident,
} from "@/lib/provider-failure";

export const runtime = "nodejs";
// Pro/Fluid Compute budget: generation can include candidate creation,
// targeted repair, evidence entailment verification, and a safe fallback.
export const maxDuration = 300;

const OPENAI_GENERATION_MODEL =
  process.env.OPENAI_GENERATION_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-5.6-terra";
const PLATFORM_GENERATION_ATTEMPTS = Math.max(
  2,
  Number(process.env.PLATFORM_GENERATION_ATTEMPTS ?? "4")
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
  replaceContentUpdatedAt?: string; // optimistic concurrency token from Studio
  sourceContentId?: string; // when adapting another size, preserve the same campaign idea
  campaignId?: string; // explicit campaign; otherwise inherit or use the active product campaign
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
  updated_at: string;
  campaign_id: string | null;
};

type CampaignSourceRow = {
  id: string;
  template_variant_id: string | null;
  structured_fields: Record<string, string> | null;
  prompt_context: Record<string, unknown> | null;
  campaign_id: string | null;
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
  id?: string;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
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
    throw new Error("OpenAI returned a non-object generation payload.");
  }
  const raw = value as { fields?: unknown; evidence?: unknown };
  if (!raw.fields || typeof raw.fields !== "object" || Array.isArray(raw.fields)) {
    throw new Error("OpenAI generation payload is missing fields.");
  }
  if (!Array.isArray(raw.evidence)) {
    throw new Error("OpenAI generation payload is missing evidence.");
  }
  const evidence = raw.evidence.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`OpenAI evidence item ${index + 1} is invalid.`);
    }
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.field !== "string" ||
      typeof candidate.source_id !== "string" ||
      typeof candidate.excerpt !== "string"
    ) {
      throw new Error(`OpenAI evidence item ${index + 1} has an invalid shape.`);
    }
    return {
      field: candidate.field,
      source_id: candidate.source_id,
      excerpt: candidate.excerpt,
      approved_source: "",
    } satisfies Evidence;
  });
  return {
    fields: asStringRecord(raw.fields),
    evidence,
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
}): Promise<{
  copy: GeneratedCopy;
  responseId: string | null;
  usage: OpenAIResponse["usage"] | null;
}> {
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
          type: "json_schema",
          name: "contentgate_generated_copy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              fields: {
                type: "object",
                properties: Object.fromEntries(
                  input.editableFields.map((field) => [field, { type: "string" }])
                ),
                required: input.editableFields,
                additionalProperties: false,
              },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string", enum: input.editableFields },
                    source_id: { type: "string" },
                    excerpt: { type: "string" },
                  },
                  required: ["field", "source_id", "excerpt"],
                  additionalProperties: false,
                },
              },
            },
            required: ["fields", "evidence"],
            additionalProperties: false,
          },
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
  return {
    copy: parseGeneratedCopy(JSON.parse(text)),
    responseId: typeof json.id === "string" ? json.id : null,
    usage: json.usage ?? null,
  };
}

async function evaluateSemanticRevisionWithOpenAI(input: {
  revision: string;
  instruction: string;
  criterion: string;
  language: string;
  editableFields: string[];
  previousFields: Record<string, string>;
  generatedFields: Record<string, string>;
  approvedContext: string;
}) {
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
      max_output_tokens: 500,
      input: [
        {
          role: "system",
          content:
            "You are a strict marketing-copy refinement verifier. Compare the before and after copy and reject cosmetic changes that do not visibly satisfy the requested direction. Do not give the rewrite the benefit of the doubt. Return JSON only.",
        },
        {
          role: "user",
          content: [
            `REFINEMENT: ${input.revision}`,
            `AUTHOR INSTRUCTION: ${input.instruction}`,
            `PASS CRITERION: ${input.criterion}`,
            `LANGUAGE: ${input.language}`,
            `EDITABLE FIELDS: ${input.editableFields.join(", ")}`,
            `BEFORE COPY: ${JSON.stringify(input.previousFields)}`,
            `AFTER COPY: ${JSON.stringify(input.generatedFields)}`,
            `APPROVED EVIDENCE AND BRAND CONTEXT:\n${input.approvedContext.slice(0, 12_000)}`,
            "Return ONLY valid JSON in this shape:",
            JSON.stringify({
              passes: false,
              issues: ["field: concise reason the requested refinement is not visible"],
            }),
          ].join("\n\n"),
        },
      ],
      text: { format: { type: "json_object" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `OpenAI refinement verification failed (${response.status}): ${errorText.slice(0, 240)}`
    );
  }

  const json = (await response.json()) as OpenAIResponse;
  const text = openAIOutputText(json).trim();
  if (!text) throw new Error("OpenAI returned no refinement verification.");
  const parsed = JSON.parse(text) as { passes?: unknown; issues?: unknown };
  if (parsed.passes === true) return [];
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.filter((issue): issue is string => typeof issue === "string" && issue.trim().length > 0)
    : [];
  return issues.length
    ? issues
    : [`generated copy did not visibly satisfy the ${input.revision} refinement`];
}

async function evaluateGeneratedEvidenceSupportWithOpenAI(input: {
  fields: Record<string, string>;
  evidence: Evidence[];
  requiredFields: string[];
  language: string;
}) {
  const activeFields = input.requiredFields.filter((field) =>
    String(input.fields[field] ?? "").trim()
  );
  if (!activeFields.length) return [];
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI evidence support verification is not configured.");
  }
  const evidenceByField = Object.fromEntries(
    activeFields.map((field) => [
      field,
      input.evidence
        .filter((item) => item.field === field)
        .map((item) => ({
          approved_source: item.approved_source,
          cited_excerpt: citationQuote(item),
        })),
    ])
  );
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_GENERATION_MODEL,
      max_output_tokens: 700,
      input: [
        {
          role: "system",
          content:
            "You are a marketing-claim entailment verifier. For each field, evaluate the combined meaning of all cited approved sources. Accept faithful paraphrases, compression, changes in voice, and combinations of claims that are individually supported by those sources; the generated wording does not need to appear verbatim. Generic creative phrasing that introduces no factual proposition is also acceptable. Reject only a material capability, guarantee, comparison, performance claim, quantified claim, or benefit that is not entailed by the cited sources. The cited excerpt is audit evidence; the fuller approved source supplies its context. Do not judge style, originality, or exact wording. Return structured JSON only.",
        },
        {
          role: "user",
          content: [
            `LANGUAGE: ${input.language}`,
            `GENERATED FIELDS: ${JSON.stringify(Object.fromEntries(activeFields.map((field) => [field, input.fields[field] ?? ""])))}`,
            `CITED APPROVED SOURCES: ${JSON.stringify(evidenceByField)}`,
          ].join("\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "contentgate_evidence_support",
          strict: true,
          schema: {
            type: "object",
            properties: {
              verdicts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string", enum: activeFields },
                    supported: { type: "boolean" },
                    reason: { type: "string" },
                  },
                  required: ["field", "supported", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["verdicts"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `OpenAI evidence support verification failed (${response.status}): ${errorText.slice(0, 240)}`
    );
  }
  const json = (await response.json()) as OpenAIResponse;
  const text = openAIOutputText(json).trim();
  if (!text) throw new Error("OpenAI returned no evidence support verification.");
  const parsed = JSON.parse(text) as {
    verdicts?: Array<{ field?: unknown; supported?: unknown; reason?: unknown }>;
  };
  const verdicts = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
  return activeFields.flatMap((field) => {
    const verdict = verdicts.find((item) => item.field === field);
    if (verdict?.supported === true) return [];
    const reason =
      typeof verdict?.reason === "string" && verdict.reason.trim()
        ? verdict.reason.trim()
        : "generated claim was not proven by its cited approved source";
    return [`${field}: ${reason}`];
  });
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
  groundingSources: GroundingSource[]
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
    const resolvedCitation = resolvePromptGroundingCitation({
      sourceId: typeof item.source_id === "string" ? item.source_id : undefined,
      quote,
      sources: groundingSources,
    });
    if (!resolvedCitation) continue;
    resolved.push({
      field: item.field,
      approved_source: resolvedCitation.approvedSource,
      excerpt: resolvedCitation.excerpt,
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
    `For each, add an evidence entry with the source id (e.g. C1 or P2) and an "excerpt" copied WORD-FOR-WORD from that approved source. Use at least four words, or copy the entire source when it is shorter. Do not assert anything that is not directly supported by an approved claim or source sentence.`,
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

function normalizedCopyValue(value: string | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function allGeneratedFieldsUnchanged(input: {
  editableFields: string[];
  generatedFields: Record<string, string>;
  previousFields: Record<string, string>;
}) {
  const comparableFields = input.editableFields.filter(
    (key) => normalizedCopyValue(input.previousFields[key]).length > 0
  );
  return (
    comparableFields.length > 0 &&
    comparableFields.every(
      (key) =>
        normalizedCopyValue(input.generatedFields[key]) ===
        normalizedCopyValue(input.previousFields[key])
    )
  );
}

function deterministicRevisionVariation(input: {
  revision: string | undefined;
  editableFields: string[];
  fields: Record<string, string>;
  previousFields: Record<string, string>;
  fieldLimits: Record<string, { max_chars?: number } | undefined>;
}) {
  const nextFields: Record<string, string> = {};
  for (const key of input.editableFields) {
    const current = String(input.fields[key] ?? "");
    const previous = String(input.previousFields[key] ?? "");
    if (!current || normalizedCopyValue(current) !== normalizedCopyValue(previous)) continue;
    const normalized = current
      .replace(/\s*[\r\n]+\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const words = normalized.replace(/[.!?]+$/g, "").split(" ").filter(Boolean);
    const shortened = normalized.replace(/[.!]+/g, "").trim();
    const rotated = words.length > 1
      ? `${words.slice(1).join(" ")} ${words[0]}`
      : "";
    const candidate = input.revision === "shorter" ? shortened : rotated;
    const limit = input.fieldLimits[key]?.max_chars;
    if (
      candidate &&
      normalizedCopyValue(candidate) !== normalizedCopyValue(current) &&
      (!limit || graphemeCount(candidate) <= limit)
    ) {
      nextFields[key] = candidate;
      break;
    }
  }
  return Object.keys(nextFields).length ? nextFields : null;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const generationRequestId = crypto.randomUUID();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const syntheticProviderFailure = isSyntheticProviderFailureRequest(
    req,
    user.email,
  );

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
    replaceContentUpdatedAt,
    sourceContentId,
    campaignId,
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
          "id, status, created_by, product_id, template_version_id, template_variant_id, prompt_context, structured_fields, updated_at, campaign_id"
        )
        .eq("id", replaceContentId)
        .eq("org_id", profile.org_id)
        .single();
      if (!existingContent) {
        return Response.json({ error: "Draft to regenerate was not found." }, { status: 404 });
      }
      if (!replaceContentUpdatedAt || existingContent.updated_at !== replaceContentUpdatedAt) {
        return Response.json(
          { error: "This draft changed elsewhere. Refresh Studio before generating again." },
          { status: 409 }
        );
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
          "id, template_variant_id, structured_fields, prompt_context, campaign_id, template_variants!generated_content_template_variant_id_fkey(variant_key, label)"
        )
        .eq("id", sourceContentId)
        .eq("org_id", profile.org_id)
        .eq("product_id", assignment.productId)
        .eq("template_version_id", assignment.versionId)
        .in("status", ["draft", "rejected", "in_review", "approved"])
        .maybeSingle();

      // Campaign continuity is an enhancement, not a prerequisite. A source
      // draft can disappear after Studio loaded (for example, another tab
      // archived it). Continue with an independent, grounded generation
      // instead of failing the selected format.
      campaignSource = sourceContent ? (sourceContent as CampaignSourceRow) : null;
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

    let resolvedCampaignId =
      campaignId ?? replaceContent?.campaign_id ?? campaignSource?.campaign_id ?? null;
    if (resolvedCampaignId) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", resolvedCampaignId)
        .eq("org_id", profile.org_id)
        .eq("product_id", product.id)
        .neq("status", "archived")
        .maybeSingle();
      if (!campaign) {
        return Response.json(
          { error: "Campaign not found for this product." },
          { status: 404 }
        );
      }
    } else {
      const { data: activeCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("org_id", profile.org_id)
        .eq("product_id", product.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedCampaignId = activeCampaign?.id ?? null;
    }

    const [{ data: claims }, { data: docs }] = await Promise.all([
      supabase.from("product_claims").select("claim_text").eq("product_id", product.id).eq("status", "approved"),
      supabase
        .from("documents")
        .select("id, title, paragraphs")
        .eq("org_id", profile.org_id)
        .eq("approval_status", "approved")
        .or(`product_id.eq.${product.id},product_id.is.null`),
    ]);

    const aiFields = aiEditableTemplateFields(runtimeVariant.fields);
    const editableFields = aiFields.map((field) => field.key);
    const requiredEditableFields = aiFields
      .filter((field) => field.required !== false)
      .map((field) => field.key);
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
    const assetUrlByPath = Object.fromEntries(
      await createTemplateBundleAssetUrlMap(supabase, profile.org_id, [assignment.manifest])
    );
    let fieldBudgets: Awaited<ReturnType<typeof calibrateTemplatePlatformFieldBudgets>>;
    try {
      fieldBudgets = await calibrateTemplatePlatformFieldBudgets({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        assetUrlByPath,
      });
    } catch (error) {
      logTemplatePipelineEvent({
        event: "template.generate",
        ok: false,
        generationRequestId,
        orgId: profile.org_id,
        userId: user.id,
        platformAssignmentId: assignment.assignmentId,
        familyKey: assignment.familyKey,
        versionName: assignment.versionLabel,
        variantKey: outputSizeKey,
        templateVersionId: assignment.versionId,
        stage: "budget_calibration",
        outcomeCode: "template_font_unavailable",
        reason: error instanceof Error ? error.message : "field budget calibration failed",
        durationMs: templatePipelineDuration(startedAt),
      });
      return Response.json(
        {
          error: "This template cannot be measured safely right now. ContentGate did not generate or save copy.",
          code: "template_font_unavailable",
          requestId: generationRequestId,
        },
        { status: 503 }
      );
    }
    const fieldLimits = Object.fromEntries(
      Object.entries(fieldBudgets).map(([field, budget]) => [
        field,
        {
          max_chars: budget.hardMaxChars,
          max_lines: budget.maxLines,
        },
      ])
    );
    const generationFieldLimits = Object.fromEntries(
      Object.entries(fieldBudgets).map(([field, budget]) => [
        field,
        {
          max_chars: budget.generationTargetChars,
          max_lines: budget.maxLines,
        },
      ])
    );
    const typographyInstructions = templatePlatformFitInstructions({
      manifest: assignment.manifest,
      variantKey: outputSizeKey,
    });
    const defaultCopy = asStringRecord(
      (assignmentRow as TemplatePlatformAssignmentRow).default_payload
    );
    const authoredReferenceCopy = getTemplateBundleVariantReferenceFields(
      assignment.manifest,
      outputSizeKey
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
    const selectedRevision = revisions[0];
    const selectedRevisionKind = revisionContractKind(selectedRevision);
    const selectedSemanticCriterion = semanticRevisionCriterion(selectedRevision);
    const isRegeneration = Boolean(replaceContent);
    const comparisonFields = isRegeneration
      ? previousStructuredFields
      : Object.keys(authoredReferenceCopy).length > 0
        ? authoredReferenceCopy
        : defaultCopy;
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
      `Use sources as factual constraints, not copy to paste. Express supported facts in fresh, natural language that sounds like a thoughtful human brand writer. Favor concrete verbs, varied sentence rhythm, and one clear idea per field. Avoid generic AI marketing language such as "unlock", "elevate", "revolutionary", "seamlessly", "game-changing", and "next-level".`,
      `Never use em dashes or en dashes. Use a period, comma, colon, or parentheses when punctuation is needed.`,
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
      isRegeneration
        ? `\nREGENERATION REQUIREMENT: Produce a visibly different alternate copy draft. Keep the approved facts and campaign idea, but do not return the same wording for any AI-editable field unless the field is a fixed product name.`
        : ``,
      !isRegeneration && Object.keys(authoredReferenceCopy).length > 0
        ? `\nAUTHORED REFERENCE COPY: ${JSON.stringify(authoredReferenceCopy)}\nThis copy is visible in the original design and is a reference only. Produce a genuinely new draft; do not repeat it or make only cosmetic word substitutions.`
        : ``,
      `\nSELECTED OUTPUT SIZE: ${runtimeVariant.variant.label} (${runtimeVariant.variant.width}x${runtimeVariant.variant.height}). Generate copy only for this size and stay inside its field limits.`,
      ``,
      `Produce exactly these AI-editable fields and no other fields: ${editableFields.join(", ")}.`,
      `FIELD LIMITS:`,
      editableFields
        .map((key) => fieldLimitInstruction(key, generationFieldLimits[key]))
        .join("\n"),
      `These are safe generation targets set to 85% of the measured hard capacity. ContentGate separately enforces the full hard limit and real glyph layout before saving.`,
      typographyInstructions.length ? `\nTYPOGRAPHIC FIT RULES:` : ``,
      typographyInstructions.join("\n"),
      typographyInstructions.length
        ? `These rendered-line limits are strict. Prefer shorter, complete wording rather than filling the character allowance.`
        : ``,
      `HUMAN COPY STANDARD: Do not copy source sentences verbatim unless the wording is an explicitly approved campaign line or fixed product name. Make the copy sound authored, not extracted. Use no em dashes or en dashes, and avoid generic AI-marketing phrases such as unlock, elevate, revolutionary, seamless/seamlessly, game-changing, and next-level.`,
      `Every generated field must read like a complete thought. Short fragments are okay for CTAs and headlines, but never end a field with a dangling connector, broken hyphenated word, comma, colon, or dash.`,
      ``,
      `The existing template copy below is a length and tone reference only. Do not repeat unsupported facts from it:`,
      editableFields.map((key) => `${key}: ${comparisonFields[key] ?? ""}`).join("\n"),
      ``,
      `EVIDENCE: for every field that makes a factual or benefit claim, add an evidence entry with { field, source_id, excerpt } where source_id is the id (e.g. C2 or P1) of the approved item it rests on and excerpt is copied WORD-FOR-WORD from that item. Use at least four words, or copy the entire source when it is shorter. The excerpt must appear exactly, verbatim, in the cited approved item. You may reword the field copy freely, but the excerpt proves the claim is grounded. Command/label fields (CTA, button) do not need evidence.`,
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
    let variationIssues: string[] = [];
    let providerFailure: string | null = null;
    let providerIncidentDelivery: unknown = null;
    let truncatedFields: string[] = [];
    let evidenceSupportSignature = "";
    let generationMode = "ai";
    const budgetTelemetry = Object.fromEntries(
      editableFields.map((field) => [
        field,
        {
          hardMaxChars: fieldBudgets[field]?.hardMaxChars ?? 0,
          generationTargetChars: fieldBudgets[field]?.generationTargetChars ?? 0,
        },
      ])
    );

    for (let attempt = 0; attempt < PLATFORM_GENERATION_ATTEMPTS; attempt += 1) {
      const failedFields = new Set(
        [...fitReasons, ...groundingIssues, ...variationIssues]
          .map((reason) => reason.split(":")[0]?.trim())
          .filter((field): field is string => Boolean(field && editableFields.includes(field)))
      );
      const failedDraft = Object.fromEntries(
        [...failedFields].map((field) => [field, generatedFields[field] ?? ""])
      );
      const repairBlocks = [
        fitReasons.length
          ? [
              `REWRITE REQUIRED: the previous draft failed the locked template fit check:`,
              ...fitReasons.map((reason) => `- ${reason}`),
              `FAILED DRAFT FIELDS: ${JSON.stringify(failedDraft)}`,
              `EXACT REPLACEMENT TARGETS:`,
              ...[...failedFields].map((field) =>
                fieldLimitInstruction(field, generationFieldLimits[field])
              ),
              `Rewrite each failed field from the supplied wording. Return a shorter, complete replacement and keep already-valid fields stable.`,
            ].join("\n")
          : ``,
        variationIssues.length
          ? [
              `REWRITE REQUIRED: the previous draft failed the requested refinement:`,
              ...variationIssues.map((reason) => `- ${reason}`),
              selectedRevision === "shorter"
                ? `Every listed field must be strictly shorter than its current copy. Do not compensate by making one field longer while shortening another.`
                : selectedRevision === "longer"
                  ? `Every listed field must be strictly longer than its current copy while staying within its template limit.`
                  : `Return a materially different rewrite for those fields. Keep the approved facts, but change the wording, rhythm, and angle enough that the user can see a real alternate copy option.`,
            ].join("\n")
          : ``,
        groundingIssues.length ? groundingRepairInstruction(groundingIssues) : ``,
      ].filter(Boolean);
      const attemptPrompt = repairBlocks.length
        ? [userPrompt, ``, ...repairBlocks].join("\n")
        : userPrompt;

      if (provider === "fallback" && !syntheticProviderFailure) {
        return Response.json(
          { error: "Generation is temporarily unavailable." },
          { status: 503 }
        );
      }

      try {
        if (syntheticProviderFailure) {
          throw new Error("Synthetic staging provider failure.");
        }
        const providerResult = await generateWithOpenAI({
          system,
          prompt: attemptPrompt,
          editableFields,
        });
        const candidate = providerResult.copy;

        const candidateEvidence = Array.isArray(candidate.evidence)
          ? candidate.evidence
          : [];
        generatedFields = repairGeneratedCopyQualityFields(
          Object.fromEntries(
            editableFields.map((key) => [
              key,
              String(candidate.fields?.[key] ?? "")
                .replace(/\r\n?/g, "\n")
                .trim(),
            ])
          ),
          editableFields
        );
        const unchangedIssues = selectedRevisionKind === "length"
          ? []
          : meaningfulVariationIssues({
              editableFields,
              generatedFields,
              previousFields: comparisonFields,
            });
        const lengthIssues = revisionLengthIssues({
            revision: selectedRevision,
            editableFields,
            generatedFields,
            previousFields: comparisonFields,
          });
        const semanticIssues =
          selectedRevisionKind === "semantic" &&
          selectedRevision &&
          selectedSemanticCriterion &&
          unchangedIssues.length === 0
            ? await evaluateSemanticRevisionWithOpenAI({
                revision: selectedRevision,
                instruction: revisionInstruction(selectedRevision) ?? "",
                criterion: selectedSemanticCriterion,
                language,
                editableFields,
                previousFields: comparisonFields,
                generatedFields,
                approvedContext: [generationProfile, approvedEvidenceBlock]
                  .filter(Boolean)
                  .join("\n\n"),
              })
            : [];
        variationIssues = [...unchangedIssues, ...lengthIssues, ...semanticIssues];
        structured = composeStructuredFieldsForGeneration({
          allFieldKeys: allRuntimeFieldKeys,
          aiFieldKeys: editableFields,
          generatedFields,
          defaultFields: defaultCopy,
          previousFields: previousStructuredFields,
        });
        const configuredIssues = templatePlatformRequiredFieldIssues(
          assignment.manifest,
          outputSizeKey,
          structured
        );
        const editableContractIssues = templateFieldIssues(
          structured,
          editableFields,
          fieldLimits,
          requiredEditableFields
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
          ...editableFields.flatMap((key) =>
            (editableContractIssues[key] ?? []).map(
              (issue) => `${key}: ${issue.message}`
            )
          ),
          ...formatTemplatePlatformFitIssues(geometryIssues),
          ...formatGeneratedCopyQualityIssues(qualityIssues),
        ];

        verifiedEvidence = resolveApprovedEvidence(
          candidateEvidence,
          editableFields,
          groundingSources
        );
        rawEvidenceCount = candidateEvidence.length;
        groundingIssues = generatedCopyEvidenceIssues({
          fields: evidenceScopedFields(structured, evidenceRequiredFields),
          evidence: verifiedEvidence,
          approvedSources: approvedSourceTexts,
        });
        if (!fitReasons.length && !variationIssues.length && !groundingIssues.length) {
          groundingIssues = await evaluateGeneratedEvidenceSupportWithOpenAI({
            fields: structured,
            evidence: verifiedEvidence,
            requiredFields: evidenceRequiredFields,
            language,
          });
          if (!groundingIssues.length) {
            evidenceSupportSignature = JSON.stringify({
              fields: Object.fromEntries(
                evidenceRequiredFields.map((field) => [field, structured[field] ?? ""])
              ),
              evidence: verifiedEvidence,
            });
          }
        }

        logTemplatePipelineEvent({
          event: "template.generate",
          ok: !fitReasons.length && !groundingIssues.length && !variationIssues.length,
          generationRequestId,
          orgId: profile.org_id,
          userId: user.id,
          productId: product.id,
          platformAssignmentId: assignment.assignmentId,
          familyKey: assignment.familyKey,
          versionName: assignment.versionLabel,
          variantKey: outputSizeKey,
          templateVersionId: assignment.versionId,
          stage: "candidate_validation",
          outcomeCode: !fitReasons.length && !groundingIssues.length && !variationIssues.length
            ? "candidate_accepted"
            : "candidate_repair_required",
          attempt: attempt + 1,
          model: OPENAI_GENERATION_MODEL,
          provider,
          providerResponseId: providerResult.responseId ?? undefined,
          inputTokens: providerResult.usage?.input_tokens,
          outputTokens: providerResult.usage?.output_tokens,
          fieldBudgets: Object.fromEntries(
            editableFields.map((field) => [
              field,
              {
                ...budgetTelemetry[field],
                actualChars: graphemeCount(generatedFields[field] ?? ""),
              },
            ])
          ),
          reason: [...fitReasons, ...groundingIssues, ...variationIssues].join(" | ").slice(0, 1_000),
          durationMs: templatePipelineDuration(startedAt),
        });

        if (!fitReasons.length && !groundingIssues.length && !variationIssues.length) {
          out = { fields: structured, evidence: verifiedEvidence };
          break;
        }
      } catch (err) {
        console.warn("platform generation provider attempt failed; retrying:", {
          platformAssignmentId,
          outputSize: outputSizeKey,
          attempt: attempt + 1,
          error: err instanceof Error ? err.message : "provider request failed",
        });
        providerFailure = err instanceof Error ? err.message : "provider request failed";
        logTemplatePipelineEvent({
          event: "template.generate",
          ok: false,
          generationRequestId,
          orgId: profile.org_id,
          userId: user.id,
          productId: product.id,
          platformAssignmentId: assignment.assignmentId,
          familyKey: assignment.familyKey,
          versionName: assignment.versionLabel,
          variantKey: outputSizeKey,
          templateVersionId: assignment.versionId,
          stage: "provider",
          outcomeCode: "provider_attempt_failed",
          attempt: attempt + 1,
          model: OPENAI_GENERATION_MODEL,
          provider,
          reason: providerFailure,
          durationMs: templatePipelineDuration(startedAt),
        });
        // A malformed response, transient provider failure, or failed
        // semantic-verifier call should consume one internal attempt, not
        // become a user-visible dead end on the first occurrence.
        continue;
      }
    }

    if (
      !out &&
      providerFailure &&
      !fitReasons.length &&
      !groundingIssues.length &&
      !variationIssues.length
    ) {
      console.error("platform generation provider exhausted retries:", {
        platformAssignmentId,
        outputSize: outputSizeKey,
        error: providerFailure,
      });
      providerIncidentDelivery = await reportProviderIncident({
        severity: "P1",
        service: "contentgate-generation",
        summary: "Generation provider retries exhausted",
        occurredAt: new Date().toISOString(),
        environment: process.env.CONTENTGATE_ENVIRONMENT ?? "unknown",
        deployment: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        details: {
          route: "/api/products/generate",
          code: "provider_unavailable",
          attempts: PLATFORM_GENERATION_ATTEMPTS,
          output_size: outputSizeKey,
          synthetic: syntheticProviderFailure,
        },
      });
    }

    if (
      !out &&
      selectedRevisionKind !== "semantic" &&
      variationIssues.length &&
      !fitReasons.length &&
      !groundingIssues.length
    ) {
      const deterministicFields = deterministicRevisionVariation({
        revision: selectedRevision,
        editableFields,
        fields: structured,
        previousFields: previousStructuredFields,
        fieldLimits,
      });
      if (deterministicFields) {
        structured = { ...structured, ...deterministicFields };
        generatedFields = { ...generatedFields, ...deterministicFields };
        out = { fields: structured, evidence: verifiedEvidence };
      }
    }

    // The model has already had several opportunities to rewrite a too-long
    // field. For the remaining fit-only case, make one deterministic,
    // template-aware shortening pass before failing the author. The result
    // still goes through the same quality, geometry, and evidence gates below;
    // it is never persisted merely because it is shorter.
    if (
      !out &&
      selectedRevisionKind !== "semantic" &&
      fitReasons.length &&
      !groundingIssues.length &&
      !variationIssues.length
    ) {
      const coerced = await coerceTemplatePlatformFieldsToFit({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        fields: structured,
        assetUrlByPath,
      });
      const coercedGeometryIssues = await templatePlatformFieldFitIssues({
        manifest: assignment.manifest,
        variantKey: outputSizeKey,
        fields: coerced.fields,
        assetUrlByPath,
      });
      const coercedQualityIssues = generatedCopyQualityIssues(
        coerced.fields,
        editableFields
      );
      const coercedEvidenceIssues = generatedCopyEvidenceIssues({
        fields: evidenceScopedFields(coerced.fields, evidenceRequiredFields),
        evidence: verifiedEvidence,
        approvedSources: approvedSourceTexts,
      });
      const coercedConfiguredIssues = templatePlatformRequiredFieldIssues(
        assignment.manifest,
        outputSizeKey,
        coerced.fields
      );
      const coercedEditableContractIssues = templateFieldIssues(
        coerced.fields,
        editableFields,
        fieldLimits,
        requiredEditableFields
      );
      const coercedReasons = [
        ...editableFields.flatMap((key) =>
          (coercedConfiguredIssues[key] ?? []).map((issue) => `${key}: ${issue.message}`)
        ),
        ...editableFields.flatMap((key) =>
          (coercedEditableContractIssues[key] ?? []).map(
            (issue) => `${key}: ${issue.message}`
          )
        ),
        ...formatTemplatePlatformFitIssues(coercedGeometryIssues),
        ...formatGeneratedCopyQualityIssues(coercedQualityIssues),
        ...coercedEvidenceIssues,
      ];

      if (!coercedReasons.length) {
        structured = coerced.fields;
        truncatedFields = coerced.truncatedFields;
        generatedFields = Object.fromEntries(
          editableFields.map((key) => [key, coerced.fields[key] ?? ""])
        );
        out = { fields: structured, evidence: verifiedEvidence };
      }
    }

    // A normal generation request must still produce an editable, compliant
    // draft when the provider or its candidate-repair loop is exhausted. Build
    // a conservative extractive fallback from approved sources, clear optional
    // AI fields, and run the exact same hard contract + real-font layout gates.
    if (!out && selectedRevisionKind !== "semantic") {
      const fallbackCandidates = sourceBackedFallbackCandidates({
        editableFields,
        requiredFields: requiredEditableFields,
        sources: groundingSources,
      });
      for (const fallbackCandidate of fallbackCandidates) {
        const fallbackStructured = composeStructuredFieldsForGeneration({
          allFieldKeys: allRuntimeFieldKeys,
          aiFieldKeys: editableFields,
          generatedFields: fallbackCandidate.fields,
          defaultFields: defaultCopy,
          previousFields: previousStructuredFields,
        });
        const coerced = await coerceTemplatePlatformFieldsToFit({
          manifest: assignment.manifest,
          variantKey: outputSizeKey,
          fields: fallbackStructured,
          assetUrlByPath,
        });
        const fallbackConfiguredIssues = templatePlatformRequiredFieldIssues(
          assignment.manifest,
          outputSizeKey,
          coerced.fields
        );
        const fallbackContractIssues = templateFieldIssues(
          coerced.fields,
          editableFields,
          fieldLimits,
          requiredEditableFields
        );
        const fallbackGeometryIssues = await templatePlatformFieldFitIssues({
          manifest: assignment.manifest,
          variantKey: outputSizeKey,
          fields: coerced.fields,
          assetUrlByPath,
        });
        const fallbackQualityIssues = generatedCopyQualityIssues(
          coerced.fields,
          editableFields
        );
        const fallbackEvidenceIssues = generatedCopyEvidenceIssues({
          fields: evidenceScopedFields(coerced.fields, evidenceRequiredFields),
          evidence: fallbackCandidate.evidence,
          approvedSources: approvedSourceTexts,
        });
        const fallbackVariationIssues = isRegeneration && selectedRevisionKind !== "length"
          ? meaningfulVariationIssues({
              editableFields,
              generatedFields: coerced.fields,
              previousFields: comparisonFields,
            })
          : [];
        const fallbackReasons = [
          ...editableFields.flatMap((field) =>
            (fallbackConfiguredIssues[field] ?? []).map((issue) => `${field}: ${issue.message}`)
          ),
          ...editableFields.flatMap((field) =>
            (fallbackContractIssues[field] ?? []).map((issue) => `${field}: ${issue.message}`)
          ),
          ...formatTemplatePlatformFitIssues(fallbackGeometryIssues),
          ...formatGeneratedCopyQualityIssues(fallbackQualityIssues),
          ...fallbackEvidenceIssues,
          ...fallbackVariationIssues,
        ];
        if (fallbackReasons.length) continue;

        structured = coerced.fields;
        generatedFields = Object.fromEntries(
          editableFields.map((field) => [field, coerced.fields[field] ?? ""])
        );
        verifiedEvidence = fallbackCandidate.evidence;
        truncatedFields = coerced.truncatedFields;
        groundingIssues = [];
        fitReasons = [];
        variationIssues = [];
        generationMode = "safe_fallback";
        out = { fields: structured, evidence: fallbackCandidate.evidence };
        logTemplatePipelineEvent({
          event: "template.generate",
          ok: true,
          generationRequestId,
          orgId: profile.org_id,
          userId: user.id,
          productId: product.id,
          platformAssignmentId: assignment.assignmentId,
          familyKey: assignment.familyKey,
          versionName: assignment.versionLabel,
          variantKey: outputSizeKey,
          templateVersionId: assignment.versionId,
          stage: "safe_fallback",
          outcomeCode: providerFailure ? "provider_fallback_accepted" : "contract_fallback_accepted",
          model: OPENAI_GENERATION_MODEL,
          provider,
          fieldBudgets: Object.fromEntries(
            editableFields.map((field) => [
              field,
              {
                ...budgetTelemetry[field],
                actualChars: graphemeCount(generatedFields[field] ?? ""),
              },
            ])
          ),
          durationMs: templatePipelineDuration(startedAt),
        });
        break;
      }
    }

    if (!out) {
      logTemplatePipelineEvent({
        event: "template.generate",
        ok: false,
        generationRequestId,
        orgId: profile.org_id,
        userId: user.id,
        productId: product.id,
        platformAssignmentId: assignment.assignmentId,
        familyKey: assignment.familyKey,
        versionName: assignment.versionLabel,
        variantKey: outputSizeKey,
        templateVersionId: assignment.versionId,
        stage: "terminal_validation",
        outcomeCode: providerFailure
          ? "provider_and_fallback_exhausted"
          : fitReasons.length
            ? "fit_and_fallback_exhausted"
            : variationIssues.length
              ? "variation_and_fallback_exhausted"
              : "evidence_and_fallback_exhausted",
        model: OPENAI_GENERATION_MODEL,
        provider,
        fieldBudgets: budgetTelemetry,
        reason: [...fitReasons, ...variationIssues, ...groundingIssues].join(" | ").slice(0, 1_000),
        durationMs: templatePipelineDuration(startedAt),
      });
      if (providerFailure && !fitReasons.length && !variationIssues.length && !groundingIssues.length) {
        return Response.json(
          {
            error: "Generation service is temporarily unavailable and no validated fallback could be produced.",
            code: "provider_unavailable",
            requestId: generationRequestId,
            retryAfterSeconds: 3,
            ...(syntheticProviderFailure
              ? {
                  validation: {
                    attempts: PLATFORM_GENERATION_ATTEMPTS,
                    incidentDelivery: providerIncidentDelivery,
                  },
                }
              : {}),
          },
          { status: 503, headers: { "Retry-After": "3" } }
        );
      }
      if (fitReasons.length) {
        console.warn("platform generated copy failed template fit validation:", {
          platformAssignmentId,
          outputSize: outputSizeKey,
          reasons: fitReasons,
        });
        return Response.json(
          {
            error:
              "ContentGate could not produce copy that safely fits this size. Please try again.",
            code: "generation_fit_exhausted",
            requestId: generationRequestId,
          },
          { status: 422 }
        );
      }
      if (variationIssues.length) {
        console.warn("platform generated copy failed variation validation:", {
          platformAssignmentId,
          outputSize: outputSizeKey,
          reasons: variationIssues,
        });
        return Response.json(
          {
            error:
              "ContentGate could not produce a meaningfully different alternate. Please try Generate again.",
            code: "generation_variation_exhausted",
            requestId: generationRequestId,
          },
          { status: 422 }
        );
      }
      const ungroundedFields = groundingIssues
        .map((issue) => issue.split(":")[0]?.trim())
        .filter(Boolean);
      console.warn("platform generated copy failed evidence validation:", {
        platformAssignmentId,
        outputSize: outputSizeKey,
        reasons: groundingIssues,
      });
      return Response.json(
        {
          error: ungroundedFields.length
            ? `ContentGate could not verify the source citations for ${ungroundedFields.join(", ")}. Please try Generate again.`
            : "ContentGate could not verify that every generated claim is grounded in approved sources.",
          code: "generation_evidence_exhausted",
          requestId: generationRequestId,
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
    const visibleGeneratedFields = Object.fromEntries(
      editableFields.map((key) => [key, structured[key] ?? ""])
    );
    if (
      isRegeneration &&
      allGeneratedFieldsUnchanged({
        editableFields,
        generatedFields: visibleGeneratedFields,
        previousFields: previousStructuredFields,
      })
    ) {
      const deterministicFields = deterministicRevisionVariation({
        revision: selectedRevision,
        editableFields,
        fields: visibleGeneratedFields,
        previousFields: previousStructuredFields,
        fieldLimits,
      });
      if (!deterministicFields) {
        return Response.json(
          {
            error:
              "ContentGate could not produce a meaningfully different alternate. Please try Generate again.",
          },
          { status: 422 }
        );
      }
      structured = { ...structured, ...deterministicFields };
      generatedFields = { ...generatedFields, ...deterministicFields };
    }

    // This is the final persistence gate. Asset-choice inheritance and the
    // deterministic refinement fallback happen after the model-attempt loop,
    // so validate the exact fields that will be saved rather than trusting an
    // earlier candidate check.
    const finalGeometryIssues = await templatePlatformFieldFitIssues({
      manifest: assignment.manifest,
      variantKey: outputSizeKey,
      fields: structured,
      assetUrlByPath,
    });
    const finalGeometryReasons = formatTemplatePlatformFitIssues(finalGeometryIssues);
    const finalConfiguredIssues = templatePlatformRequiredFieldIssues(
      assignment.manifest,
      outputSizeKey,
      structured
    );
    const finalEditableContractIssues = templateFieldIssues(
      structured,
      editableFields,
      fieldLimits,
      requiredEditableFields
    );
    const finalConfiguredReasons = [
      ...editableFields.flatMap((key) =>
        (finalConfiguredIssues[key] ?? []).map((issue) => `${key}: ${issue.message}`)
      ),
      ...editableFields.flatMap((key) =>
        (finalEditableContractIssues[key] ?? []).map(
          (issue) => `${key}: ${issue.message}`
        )
      ),
    ];
    const finalQualityReasons = formatGeneratedCopyQualityIssues(
      generatedCopyQualityIssues(structured, editableFields)
    );
    const finalGroundingIssues = generatedCopyEvidenceIssues({
      fields: evidenceScopedFields(structured, evidenceRequiredFields),
      evidence,
      approvedSources: approvedSourceTexts,
    });
    const finalEvidenceSignature = JSON.stringify({
      fields: Object.fromEntries(
        evidenceRequiredFields.map((field) => [field, structured[field] ?? ""])
      ),
      evidence,
    });
    let finalSemanticGroundingIssues: string[] = [];
    if (
      generationMode === "ai" &&
      !finalGroundingIssues.length &&
      evidenceSupportSignature !== finalEvidenceSignature
    ) {
      try {
        finalSemanticGroundingIssues = await evaluateGeneratedEvidenceSupportWithOpenAI({
          fields: structured,
          evidence,
          requiredFields: evidenceRequiredFields,
          language,
        });
      } catch (error) {
        finalSemanticGroundingIssues = [
          `evidence: final support verification was unavailable (${error instanceof Error ? error.message : "provider failure"})`,
        ];
      }
    }
    const finalVariationIssues = selectedRevisionKind === "length"
      ? []
      : meaningfulVariationIssues({
          editableFields,
          generatedFields: structured,
          previousFields: comparisonFields,
        });
    const finalRevisionIssues = revisionLengthIssues({
      revision: selectedRevision,
      editableFields,
      generatedFields: structured,
      previousFields: comparisonFields,
    });
    if (finalVariationIssues.length || finalRevisionIssues.length || finalConfiguredReasons.length || finalGeometryReasons.length || finalQualityReasons.length || finalGroundingIssues.length || finalSemanticGroundingIssues.length) {
      const reasons = [
        ...finalVariationIssues,
        ...finalRevisionIssues,
        ...finalConfiguredReasons,
        ...finalGeometryReasons,
        ...finalQualityReasons,
        ...finalGroundingIssues,
        ...finalSemanticGroundingIssues,
      ];
      console.warn("platform generation final contract validation failed:", {
        platformAssignmentId,
        outputSize: outputSizeKey,
        reasons,
      });
      const finalOutcomeCode =
        finalVariationIssues.length || finalRevisionIssues.length
          ? "generation_variation_exhausted"
          : finalGroundingIssues.length || finalSemanticGroundingIssues.length
            ? "generation_evidence_exhausted"
            : "generation_fit_exhausted";
      logTemplatePipelineEvent({
        event: "template.generate",
        ok: false,
        generationRequestId,
        orgId: profile.org_id,
        userId: user.id,
        productId: product.id,
        platformAssignmentId: assignment.assignmentId,
        familyKey: assignment.familyKey,
        versionName: assignment.versionLabel,
        variantKey: outputSizeKey,
        templateVersionId: assignment.versionId,
        stage: "final_contract",
        outcomeCode: finalOutcomeCode,
        model: OPENAI_GENERATION_MODEL,
        provider,
        fieldBudgets: Object.fromEntries(
          editableFields.map((field) => [
            field,
            {
              ...budgetTelemetry[field],
              actualChars: graphemeCount(structured[field] ?? ""),
            },
          ])
        ),
        reason: reasons.join(" | ").slice(0, 1_000),
        durationMs: templatePipelineDuration(startedAt),
      });
      return Response.json(
        {
          error: finalRevisionIssues.length
            ? `ContentGate could not make the copy ${selectedRevision} overall while preserving the approved meaning. Please try again.`
            : finalVariationIssues.length
              ? "ContentGate could not produce a meaningfully different alternate. Please try Generate again."
              : finalGroundingIssues.length || finalSemanticGroundingIssues.length
                ? "ContentGate could not prove that every generated claim is supported by its approved source."
                : "ContentGate could not produce copy that safely fits this size. Please try again.",
          code: finalOutcomeCode,
          requestId: generationRequestId,
          reasons,
        },
        { status: 422 }
      );
    }
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
      campaign_id: resolvedCampaignId,
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
            campaign_id: resolvedCampaignId,
            renderer_version: "template-platform-v1",
            status: "draft",
            updated_at: savedAt,
          })
          .eq("id", replaceContent.id)
          .eq("updated_at", replaceContent.updated_at)
      : supabase.from("generated_content").insert({
          org_id: profile.org_id,
          created_by: user.id,
          product_id: product.id,
          product_template_id: null,
          template_version_id: assignment.versionId,
          template_variant_id: variantRow.id,
          campaign_id: resolvedCampaignId,
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

    const { data: row, error: writeError } = await writeQuery
      .select("id, updated_at")
      .single();

    if (writeError || !row) {
      if (
        !row &&
        replaceContent &&
        (!writeError || writeError.code === "PGRST116")
      ) {
        return Response.json(
          { error: "This draft changed while generation was running. Refresh Studio before trying again." },
          { status: 409 }
        );
      }
      return Response.json({ error: `Could not save draft: ${writeError?.message}` }, { status: 500 });
    }
    logTemplatePipelineEvent({
      event: "template.generate",
      ok: true,
      generationRequestId,
      orgId: profile.org_id,
      userId: user.id,
      productId: product.id,
      platformAssignmentId: assignment.assignmentId,
      familyKey: assignment.familyKey,
      versionName: assignment.versionLabel,
      variantKey: outputSizeKey,
      templateVersionId: assignment.versionId,
      durationMs: templatePipelineDuration(startedAt),
      stage: "persistence",
      outcomeCode: generationMode === "safe_fallback" ? "fallback_saved" : "candidate_saved",
      model: OPENAI_GENERATION_MODEL,
      provider,
      fieldBudgets: Object.fromEntries(
        editableFields.map((field) => [
          field,
          {
            ...budgetTelemetry[field],
            actualChars: graphemeCount(structured[field] ?? ""),
          },
        ])
      ),
    });

    return Response.json({
      contentId: row.id,
      updatedAt: row.updated_at,
      structured_fields: structured,
      outputSize: outputSizeKey,
      campaignRootContentId: campaignRootContentId ?? row.id,
      evidence,
      title,
      platform: true,
      requestId: generationRequestId,
      generationMode,
      fallbackUsed: generationMode === "safe_fallback",
      fieldLimits,
      truncatedFields,
    });
  }

  return Response.json(
    { error: "This older template is read-only. Choose an approved template." },
    { status: 410 }
  );
}
