import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Knowledge Q&A is not configured." }, { status: 503 });
  }
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

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, paragraphs")
    .or(`product_id.eq.${productId},product_id.is.null`);

  const docsText = (docs ?? [])
    .map((doc) => {
      const paras = Array.isArray(doc.paragraphs)
        ? doc.paragraphs
            .map((p: { n?: number; text?: string } | string) =>
              typeof p === "string" ? p : `[¶${p.n ?? "?"}] ${p.text ?? ""}`
            )
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

APPROVED SOURCE DOCUMENTS:
${docsText || "No documents uploaded yet."}

${product.disclaimer_text ? `MANDATORY DISCLAIMER (always applies): ${product.disclaimer_text}` : ""}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (!docsText.trim()) {
    return await saveAndReturnNotFound(
      supabase,
      user.id,
      productId,
      question.trim(),
      "I could not find that information because no approved source documents are available for this product."
    );
  }

  let response;
  try {
    response = await anthropic.messages.create({
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
  } catch (error) {
    console.error("knowledge answer failed:", error);
    return NextResponse.json({ error: "Knowledge search failed. Try again." }, { status: 502 });
  }

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "No answer generated" }, { status: 500 });
  }

  const rawResult = toolUse.input as {
    answer: string;
    citations: { document_title: string; excerpt: string }[];
    not_found: boolean;
  };
  const documentText = new Map(
    (docs ?? []).map((doc) => [
      doc.title,
      ((doc.paragraphs ?? []) as { text?: string }[])
        .map((paragraph) => paragraph.text ?? "")
        .join("\n"),
    ])
  );
  const citations = (rawResult.citations ?? []).filter((citation) => {
    const source = documentText.get(citation.document_title);
    return !!source && source.toLowerCase().includes(citation.excerpt.trim().toLowerCase());
  });
  const unsupported = !rawResult.not_found && citations.length === 0;
  const result = {
    answer: unsupported
      ? "I could not verify an answer in the uploaded source documents."
      : rawResult.answer,
    citations,
    not_found: rawResult.not_found || unsupported,
  };

  // Log the query for usage analytics + audit trail. Best-effort: a logging
  // failure must never block the answer the user came for.
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (profile?.org_id) {
    await supabase.from("knowledge_queries").insert({
      org_id: profile.org_id,
      product_id: productId,
      user_id: user.id,
      question: question.trim(),
      not_found: result.not_found ?? false,
      citation_count: result.citations?.length ?? 0,
      answer: result.answer ?? "",
      citations: result.citations ?? [],
    });
  }

  return NextResponse.json(result);
}

async function saveAndReturnNotFound(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  productId: string,
  question: string,
  answer: string
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();
  if (profile?.org_id) {
    await supabase.from("knowledge_queries").insert({
      org_id: profile.org_id,
      product_id: productId,
      user_id: userId,
      question,
      not_found: true,
      citation_count: 0,
      answer,
      citations: [],
    });
  }
  return NextResponse.json({ answer, citations: [], not_found: true });
}
