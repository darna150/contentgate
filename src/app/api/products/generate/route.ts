import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flattenFields, revisionInstruction, type Evidence } from "@/lib/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  productTemplateId: string;
  language?: string;
  revisions?: string[]; // controlled revision keys, applied as extra instructions
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Generation is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { productTemplateId, language = "English", revisions = [] } =
    (await req.json()) as Body;
  if (!productTemplateId) {
    return Response.json({ error: "Missing product template." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return Response.json({ error: "No profile." }, { status: 401 });

  // RLS scopes all of these to the caller's org.
  const { data: tpl } = await supabase
    .from("product_templates")
    .select("id, product_id, category, variant, editable_fields, generation_instructions")
    .eq("id", productTemplateId)
    .single();
  if (!tpl) return Response.json({ error: "Template not found." }, { status: 404 });

  const [{ data: product }, { data: claims }, { data: docs }] = await Promise.all([
    supabase.from("products").select("id, name, description, disclaimer_text").eq("id", tpl.product_id).single(),
    supabase.from("product_claims").select("claim_text").eq("product_id", tpl.product_id).eq("status", "approved"),
    supabase.from("documents").select("id, title, paragraphs").eq("product_id", tpl.product_id),
  ]);
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });

  const editableFields = (tpl.editable_fields as string[]) ?? [];
  const approvedClaims = (claims ?? []).map((c) => c.claim_text);
  const sourceDocs = docs ?? [];
  const sourceText = sourceDocs
    .flatMap((d) =>
      ((d.paragraphs as { n: number; text: string }[]) ?? []).map(
        (p) => `[${d.title} ¶${p.n}] ${p.text}`
      )
    )
    .join("\n");

  const extraInstructions = revisions
    .map(revisionInstruction)
    .filter(Boolean)
    .join(" ");

  const system = [
    `You write compliant marketing copy for the animal-health product "${product.name}".`,
    `Use ONLY the approved claims and approved source text provided. Never invent claims, figures, dosages, species, or regulatory statements. If a benefit is not supported by an approved claim, do not make it.`,
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
    `TASK: ${tpl.generation_instructions}`,
    extraInstructions ? `\nADDITIONAL DIRECTION: ${extraInstructions}` : ``,
    ``,
    `Produce exactly these fields: ${editableFields.join(", ")}.`,
    `For every field that makes a factual or benefit claim, add an evidence entry naming the approved claim or approved source sentence it rests on.`,
  ].join("\n");

  const fieldProps: Record<string, { type: "string" }> = {};
  for (const f of editableFields) fieldProps[f] = { type: "string" };

  const anthropic = new Anthropic();
  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system,
      tool_choice: { type: "tool", name: "build_asset_content" },
      tools: [
        {
          name: "build_asset_content",
          description: "Return the finished, compliant copy fields and the approved evidence behind each claim.",
          input_schema: {
            type: "object",
            properties: {
              fields: {
                type: "object",
                properties: fieldProps,
                required: editableFields,
              },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    approved_source: { type: "string" },
                  },
                  required: ["field", "approved_source"],
                },
              },
            },
            required: ["fields", "evidence"],
          },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    console.error("structured generation failed:", err);
    return Response.json({ error: "Generation failed. Try again." }, { status: 502 });
  }

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return Response.json({ error: "Model returned no structured output." }, { status: 502 });
  }
  const out = toolUse.input as {
    fields: Record<string, string>;
    evidence: Evidence[];
  };

  // Keep only the requested fields, in order.
  const structured: Record<string, string> = {};
  for (const f of editableFields) structured[f] = (out.fields?.[f] ?? "").toString().trim();
  const evidence = Array.isArray(out.evidence) ? out.evidence : [];

  const title = `${product.name} · ${tpl.variant}`;
  const body = flattenFields(structured, editableFields);

  const { data: row, error } = await supabase
    .from("generated_content")
    .insert({
      org_id: profile.org_id,
      created_by: user.id,
      product_id: product.id,
      product_template_id: tpl.id,
      template_id: null,
      structured_fields: structured,
      source_document_ids: sourceDocs.map((d) => d.id),
      citations: evidence,
      title,
      body,
      target_language: language,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !row) {
    return Response.json({ error: `Could not save draft: ${error?.message}` }, { status: 500 });
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await createAdminClient().from("audit_log").insert({
      org_id: profile.org_id,
      actor_id: user.id,
      action: revisions.length ? "content.revised" : "content.created",
      entity_type: "generated_content",
      entity_id: row.id,
      detail: { product: product.name, variant: tpl.variant, revisions },
    });
  }

  return Response.json({
    contentId: row.id,
    structured_fields: structured,
    evidence,
    title,
  });
}
