import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApprovedEvidenceSources,
  contentEvidenceIssues,
  validateStoredContentEvidence,
} from "./evidence-lifecycle.ts";

const claim =
  "FleaShield Duo protects dogs against fleas and ticks for a full month per approved dose.";
const paragraph =
  "Field studies confirm FleaShield Duo delivers month-long protection against fleas and ticks in dogs when applied as directed.";

const approvedSources = buildApprovedEvidenceSources({
  claims: [claim],
  documents: [
    {
      title: "FleaShield Claims Sheet",
      paragraphs: [{ n: 1, text: paragraph }],
    },
  ],
});

test("builds claims plus raw and labeled paragraph sources", () => {
  assert.equal(approvedSources.length, 3);
  assert.equal(approvedSources[0], claim);
  assert.equal(approvedSources[1], paragraph);
  assert.match(approvedSources[2], /^\[FleaShield Claims Sheet ¶1\]/);
});

test("supported copy with matching citation passes", () => {
  const issues = contentEvidenceIssues({
    fields: {
      headline: "FleaShield Duo protects dogs against fleas and ticks",
    },
    citations: [{ field: "headline", approved_source: claim }],
    approvedSources,
  });
  assert.deepEqual(issues, []);
});

test("content whose citation is no longer backed by approved sources is rejected", () => {
  // Source drift: the claim/paragraph the citation quoted was later un-approved
  // or edited, so the stored excerpt is no longer verbatim in the corpus.
  const issues = contentEvidenceIssues({
    fields: {
      headline: "FleaShield Duo protects dogs against fleas and ticks",
    },
    citations: [
      {
        field: "headline",
        approved_source: claim,
        excerpt: "protects dogs against fleas and ticks",
      },
    ],
    approvedSources: ["An unrelated approved claim about packaging and storage."],
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0], /headline/);
});

test("substantive field without any citation is rejected", () => {
  const issues = contentEvidenceIssues({
    fields: {
      headline: "FleaShield Duo protects dogs against fleas and ticks",
    },
    citations: [],
    approvedSources,
  });
  assert.deepEqual(issues, ["headline: missing approved evidence."]);
});

test("citation pointing at a source that is not approved is rejected", () => {
  const issues = contentEvidenceIssues({
    fields: {
      headline: "FleaShield Duo protects dogs against fleas and ticks",
    },
    citations: [
      {
        field: "headline",
        approved_source:
          "An internal draft says FleaShield Duo protects dogs against fleas and ticks",
      },
    ],
    approvedSources,
  });
  assert.equal(issues.length, 1);
});

test("low-risk CTA fields stay editable without evidence", () => {
  const issues = contentEvidenceIssues({
    fields: { cta: "Ask your veterinarian about FleaShield Duo today" },
    citations: [],
    approvedSources,
  });
  assert.deepEqual(issues, []);
});

test("template control fields are layout metadata, not copy", () => {
  const issues = contentEvidenceIssues({
    fields: {
      __backgroundAssetKey: "background-options/mint-glow",
      __productVariantKey: "nimbus-1",
    },
    citations: [],
    approvedSources,
  });
  assert.deepEqual(issues, []);
});

function stubSupabase(data: {
  content: Record<string, unknown> | null;
  claims?: { claim_text: string }[];
  docs?: { title: string; paragraphs: { n: number; text: string }[] }[];
}) {
  return {
    from(table: string) {
      const rows =
        table === "generated_content"
          ? data.content
          : table === "product_claims"
            ? (data.claims ?? [])
            : (data.docs ?? []);
      const result = Promise.resolve({ data: rows });
      const chain = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        single: () => Promise.resolve({ data: data.content }),
        then: result.then.bind(result),
      };
      return chain;
    },
  };
}

test("lifecycle validator passes supported platform content", async () => {
  const supabase = stubSupabase({
    content: {
      product_id: "prod-1",
      template_version_id: "ver-1",
      structured_fields: {
        headline: "FleaShield Duo protects dogs against fleas and ticks",
      },
      citations: [{ field: "headline", approved_source: claim }],
    },
    claims: [{ claim_text: claim }],
    docs: [],
  });
  assert.equal(await validateStoredContentEvidence(supabase, "content-1"), null);
});

test("lifecycle validator rejects content after its source is un-approved", async () => {
  // The citation quoted the original claim, but that claim is no longer among
  // the product's approved sources, so the stored excerpt cannot be verified.
  const supabase = stubSupabase({
    content: {
      product_id: "prod-1",
      template_version_id: "ver-1",
      structured_fields: {
        headline: "FleaShield Duo protects dogs against fleas and ticks",
      },
      citations: [
        {
          field: "headline",
          approved_source: claim,
          excerpt: "protects dogs against fleas and ticks",
        },
      ],
    },
    claims: [{ claim_text: "A completely different approved claim about storage." }],
    docs: [],
  });
  const error = await validateStoredContentEvidence(supabase, "content-1");
  assert.ok(error);
  assert.match(error, /no longer supported by approved evidence/);
});

test("lifecycle validator exempts legacy content without a platform version", async () => {
  const supabase = stubSupabase({
    content: {
      product_id: "prod-1",
      template_version_id: null,
      structured_fields: { headline: "Anything historical" },
      citations: [],
    },
  });
  assert.equal(await validateStoredContentEvidence(supabase, "content-1"), null);
});
