import { createClient } from "@/lib/supabase/server";
import {
  buildExtractiveKnowledgeAnswer,
  buildKnowledgeContext,
  finalizeKnowledgeAnswer,
  normalizeRetrievedParagraphs,
  rankKnowledgeEvidence,
  verifyKnowledgeCitations,
  type RetrievedKnowledgeParagraph,
  type RawKnowledgeCitation,
} from "@/lib/knowledge-reliability";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { consumeApiRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type DocumentParagraphRow = {
  id: string;
  title: string | null;
  paragraphs: unknown;
};

function fallbackParagraphRowsFromDocuments(
  documents: readonly DocumentParagraphRow[]
): RetrievedKnowledgeParagraph[] {
  return normalizeRetrievedParagraphs(
    documents.flatMap((document) => {
      const paragraphs = Array.isArray(document.paragraphs)
        ? document.paragraphs
        : [];
      return paragraphs.map((paragraph, index) => {
        if (paragraph && typeof paragraph === "object" && !Array.isArray(paragraph)) {
          const item = paragraph as { n?: unknown; text?: unknown };
          return {
            document_id: document.id,
            document_title: document.title ?? "Approved source",
            paragraph_n: Number(item.n ?? index + 1),
            paragraph_text: typeof item.text === "string" ? item.text : "",
          };
        }
        return {
          document_id: document.id,
          document_title: document.title ?? "Approved source",
          paragraph_n: index + 1,
          paragraph_text: typeof paragraph === "string" ? paragraph : "",
        };
      });
    })
  );
}

async function fallbackSearchApprovedKnowledge(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  question: string
) {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, paragraphs")
    .eq("product_id", productId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("knowledge fallback retrieval failed:", error);
    return [];
  }

  return rankKnowledgeEvidence(
    question,
    fallbackParagraphRowsFromDocuments((data ?? []) as DocumentParagraphRow[]),
    12
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rateLimit = await consumeApiRateLimit(supabase, "knowledge.ask");
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  } catch (error) {
    console.error("knowledge rate limit failed:", error);
    return NextResponse.json({ error: "Knowledge Q&A is temporarily unavailable." }, { status: 503 });
  }

  let payload: { productId?: unknown; question?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const productId =
    typeof payload.productId === "string" ? payload.productId : "";
  const question =
    typeof payload.question === "string" ? payload.question.trim() : "";
  if (!productId || !question) {
    return NextResponse.json({ error: "Missing productId or question" }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Question is too long" }, { status: 400 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, disclaimer_text")
    .eq("id", productId)
    .eq("status", "active")
    .single();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const { data: retrievalRows, error: retrievalError } = await supabase.rpc(
    "search_product_knowledge",
    {
      p_product_id: productId,
      p_query: question,
      p_limit: 12,
    }
  );
  let evidence = normalizeRetrievedParagraphs(retrievalRows ?? []);
  if (retrievalError) {
    console.error("knowledge retrieval failed:", retrievalError);
    evidence = await fallbackSearchApprovedKnowledge(supabase, productId, question);
  }

  const approvedContext = buildKnowledgeContext(evidence);

  const system = `You are a product knowledge assistant for ${product.name}.
Your role is to answer questions from brand, content, regional, and local marketing teams.

STRICT RULES:
- Answer ONLY from the approved sources below. Never invent claims, data, or specifications.
- If the answer is not in the approved sources, set not_found to true and say so clearly.
- Be concise, direct, and helpful. Write for someone creating localized brand content.
- Cite every supported answer using the exact document_id and paragraph number shown below.
- The citation excerpt must be an exact passage from that paragraph.

RETRIEVED APPROVED SOURCE PARAGRAPHS:
${approvedContext || "No matching approved source paragraphs were found."}

${product.disclaimer_text ? `MANDATORY DISCLAIMER (always applies): ${product.disclaimer_text}` : ""}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (evidence.length === 0) {
    return await saveAndReturnNotFound(
      supabase,
      user.id,
      productId,
      question,
      "I could not verify an answer in the approved source documents."
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(buildExtractiveKnowledgeAnswer(question, evidence));
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
                "A clear, direct answer for a brand, content, regional, or local marketing teammate. Plain language.",
            },
            citations: {
              type: "array",
              description: "Source passages that directly support the answer.",
              items: {
                type: "object",
                properties: {
                  excerpt: {
                    type: "string",
                    description: "Exact passage from the source document.",
                  },
                  document_id: {
                    type: "string",
                    description: "Exact document_id from the retrieved paragraph label.",
                  },
                  paragraph_n: {
                    type: "integer",
                    description: "Exact paragraph number from the retrieved paragraph label.",
                  },
                },
                required: ["document_id", "paragraph_n", "excerpt"],
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
      messages: [{ role: "user", content: question }],
    });
  } catch (error) {
    console.error("knowledge answer failed:", error);
    return NextResponse.json(buildExtractiveKnowledgeAnswer(question, evidence));
  }

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "No answer generated" }, { status: 500 });
  }

  const rawResult = toolUse.input as {
    answer: string;
    citations: RawKnowledgeCitation[];
    not_found: boolean;
  };
  const citations = verifyKnowledgeCitations(rawResult.citations ?? [], evidence);
  const result = finalizeKnowledgeAnswer({
    answer: rawResult.answer,
    notFound: rawResult.not_found,
    citations,
  });

  // Log the query for usage analytics + audit trail. Best-effort: a logging
  // failure must never block the answer the user came for.
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (profile?.org_id) {
      const { error: logError } = await supabase.from("knowledge_queries").insert({
        org_id: profile.org_id,
        product_id: productId,
        user_id: user.id,
        question,
        not_found: result.not_found ?? false,
        citation_count: result.citations?.length ?? 0,
        answer: result.answer ?? "",
        citations: result.citations ?? [],
      });
      if (logError) console.warn("knowledge query audit log failed:", logError);
    }
  } catch (logError) {
    console.warn("knowledge query audit log failed:", logError);
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
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .single();
    if (profile?.org_id) {
      const { error: logError } = await supabase.from("knowledge_queries").insert({
        org_id: profile.org_id,
        product_id: productId,
        user_id: userId,
        question,
        not_found: true,
        citation_count: 0,
        answer,
        citations: [],
      });
      if (logError) console.warn("knowledge query audit log failed:", logError);
    }
  } catch (logError) {
    console.warn("knowledge query audit log failed:", logError);
  }
  return NextResponse.json({ answer, citations: [], not_found: true });
}
