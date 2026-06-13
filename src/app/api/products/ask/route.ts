import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, question } = await req.json();
  if (!productId || !question?.trim()) {
    return NextResponse.json({ error: "Missing productId or question" }, { status: 400 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, disclaimer_text")
    .eq("id", productId)
    .single();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const [{ data: claims }, { data: docs }] = await Promise.all([
    supabase
      .from("product_claims")
      .select("claim_text")
      .eq("product_id", productId)
      .eq("status", "approved"),
    supabase.from("documents").select("id, title, paragraphs").eq("product_id", productId),
  ]);

  const claimsText = (claims ?? [])
    .map((c, i) => `${i + 1}. ${c.claim_text}`)
    .join("\n");

  const docsText = (docs ?? [])
    .map((doc) => {
      const paras = Array.isArray(doc.paragraphs)
        ? doc.paragraphs
            .map((p: { text?: string } | string) => (typeof p === "string" ? p : (p.text ?? "")))
            .filter(Boolean)
            .join("\n\n")
        : "";
      return `--- ${doc.title} ---\n${paras}`;
    })
    .join("\n\n");

  const system = `You are a product knowledge assistant for ${product.name}.
Your role is to answer questions from field representatives, distributors, and marketing teams.

STRICT RULES:
- Answer ONLY from the approved sources below. Never invent claims, data, or specifications.
- If the answer is not in the approved sources, set not_found to true and say so clearly.
- Be concise, direct, and helpful. Write for someone who needs a quick, reliable answer in the field.
- When citing, quote the exact relevant passage from the source document.

APPROVED CLAIMS FOR ${product.name.toUpperCase()}:
${claimsText || "None on file."}

APPROVED SOURCE DOCUMENTS:
${docsText || "No documents uploaded yet."}

${product.disclaimer_text ? `MANDATORY DISCLAIMER (always applies): ${product.disclaimer_text}` : ""}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    tools: [
      {
        name: "answer_question",
        description: "Answer the user's question with supporting citations from approved sources.",
        input_schema: {
          type: "object" as const,
          properties: {
            answer: {
              type: "string",
              description:
                "A clear, direct answer for a field rep or distributor. Plain language.",
            },
            citations: {
              type: "array",
              description: "Source passages that directly support the answer.",
              items: {
                type: "object",
                properties: {
                  document_title: { type: "string" },
                  excerpt: {
                    type: "string",
                    description: "Exact passage from the source document.",
                  },
                },
                required: ["document_title", "excerpt"],
              },
            },
            not_found: {
              type: "boolean",
              description:
                "True if the question cannot be answered from approved sources.",
            },
          },
          required: ["answer", "citations", "not_found"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "answer_question" },
    messages: [{ role: "user", content: question.trim() }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "No answer generated" }, { status: 500 });
  }

  return NextResponse.json(
    toolUse.input as {
      answer: string;
      citations: { document_title: string; excerpt: string }[];
      not_found: boolean;
    }
  );
}
