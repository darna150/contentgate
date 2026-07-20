import {
  generatedCopyEvidenceIssues,
  type GeneratedFieldEvidence,
} from "./evidence-validation.ts";
import { BACKGROUND_CHOICE_FIELD } from "./template-platform/runtime.ts";

type DocumentParagraph = { n: number; text: string };

export type ApprovedSourceDocument = {
  title: string;
  paragraphs: DocumentParagraph[] | null;
};

// Mirrors the corpus the generate route grounds copy in (approved claims plus
// source-document paragraphs, raw and labeled), except uncapped: validation is
// not a prompt, so a larger corpus only reduces false rejections.
export function buildApprovedEvidenceSources(input: {
  claims: readonly string[];
  documents: readonly ApprovedSourceDocument[];
}) {
  const entries = input.documents.flatMap((doc) =>
    (doc.paragraphs ?? []).map((paragraph) => ({
      label: `${doc.title} ¶${paragraph.n}`,
      text: paragraph.text,
    }))
  );
  return [
    ...input.claims,
    ...entries.map((entry) => entry.text),
    ...entries.map((entry) => `[${entry.label}] ${entry.text}`),
  ];
}

export function contentEvidenceIssues(input: {
  fields: Record<string, string>;
  citations: readonly GeneratedFieldEvidence[];
  approvedSources: readonly string[];
}) {
  const copyFields = Object.fromEntries(
    Object.entries(input.fields).filter(
      ([key]) => key !== BACKGROUND_CHOICE_FIELD
    )
  );
  return generatedCopyEvidenceIssues({
    fields: copyFields,
    evidence: input.citations,
    approvedSources: input.approvedSources,
  });
}

type EvidenceContentRow = {
  product_id: string | null;
  template_version_id: string | null;
  structured_fields: Record<string, unknown> | null;
  citations: unknown;
};

type SupabaseLike = {
  from: (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (columns: string) => any;
  };
};

function asCitations(value: unknown): GeneratedFieldEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is GeneratedFieldEvidence =>
      !!item &&
      typeof item === "object" &&
      typeof (item as GeneratedFieldEvidence).field === "string" &&
      typeof (item as GeneratedFieldEvidence).approved_source === "string"
  );
}

function asFieldRecord(value: Record<string, unknown> | null) {
  if (!value) return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item ?? "")])
  );
}

// Fail-closed lifecycle gate shared by submit, approve, export, and render.
// Returns null when the content's current fields are supported by approved
// evidence, or a human-readable error naming the first problems found.
// Legacy content (no platform template version) predates stored citations and
// is read-only history, so it is exempt.
export async function validateStoredContentEvidence(
  supabase: SupabaseLike,
  contentId: string
): Promise<string | null> {
  const { data: content } = (await supabase
    .from("generated_content")
    .select("product_id, template_version_id, structured_fields, citations")
    .eq("id", contentId)
    .single()) as { data: EvidenceContentRow | null };
  if (!content) return "Content not found.";
  if (!content.template_version_id) return null;
  if (!content.product_id) {
    return "Content is missing its product, so evidence cannot be verified.";
  }

  const [{ data: claims }, { data: docs }] = await Promise.all([
    supabase
      .from("product_claims")
      .select("claim_text")
      .eq("product_id", content.product_id)
      .eq("status", "approved"),
    supabase
      .from("documents")
      .select("title, paragraphs")
      .or(`product_id.eq.${content.product_id},product_id.is.null`),
  ]);

  const approvedSources = buildApprovedEvidenceSources({
    claims: ((claims ?? []) as { claim_text: string }[]).map(
      (claim) => claim.claim_text
    ),
    documents: (docs ?? []) as ApprovedSourceDocument[],
  });

  const issues = contentEvidenceIssues({
    fields: asFieldRecord(content.structured_fields),
    citations: asCitations(content.citations),
    approvedSources,
  });
  if (!issues.length) return null;
  return `Current copy is no longer supported by approved evidence — ${issues.join(" ")}`;
}
