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
import { NextResponse } from "next/server";
import { consumeApiRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const OPENAI_ASK_MODEL =
  process.env.OPENAI_ASK_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-5.6-sol";
const OPENAI_ASK_REASONING = process.env.OPENAI_ASK_REASONING ?? "medium";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

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

function parseKnowledgeAnswer(value: unknown): {
  answer: string;
  citations: RawKnowledgeCitation[];
  not_found: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { answer: "", citations: [], not_found: true };
  }
  const raw = value as { answer?: unknown; citations?: unknown; not_found?: unknown };
  return {
    answer: typeof raw.answer === "string" ? raw.answer : "",
    citations: Array.isArray(raw.citations) ? (raw.citations as RawKnowledgeCitation[]) : [],
    not_found: raw.not_found === true,
  };
}

async function answerWithOpenAI(input: {
  system: string;
  question: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI Ask is not configured.");
  }

  const body: Record<string, unknown> = {
    model: OPENAI_ASK_MODEL,
    max_output_tokens: 1024,
    input: [
      { role: "system", content: input.system },
      {
        role: "user",
        content: [
          input.question,
          "",
          "Return ONLY valid JSON matching this exact shape:",
          JSON.stringify({
            answer: "Direct answer grounded only in the retrieved approved source paragraphs.",
            citations: [
              {
                document_id: "exact document_id from a retrieved paragraph",
                paragraph_n: 1,
                excerpt: "exact supporting passage copied from that paragraph",
              },
            ],
            not_found: false,
          }),
          "If the sources do not answer the question, return not_found true and an empty citations array.",
          "Do not wrap the JSON in Markdown.",
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_object",
      },
    },
  };

  if (OPENAI_ASK_REASONING !== "none") {
    body.reasoning = { effort: OPENAI_ASK_REASONING };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI Ask failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const json = (await response.json()) as OpenAIResponse;
  const text = openAIOutputText(json).trim();
  if (!text) throw new Error("OpenAI returned no Ask text output.");
  return parseKnowledgeAnswer(JSON.parse(text));
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

  if (evidence.length === 0) {
    return await saveAndReturnNotFound(
      supabase,
      user.id,
      productId,
      question,
      "I could not verify an answer in the approved source documents."
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(buildExtractiveKnowledgeAnswer(question, evidence));
  }

  let rawResult: {
    answer: string;
    citations: RawKnowledgeCitation[];
    not_found: boolean;
  };
  try {
    rawResult = await answerWithOpenAI({
      system,
      question,
    });
  } catch (error) {
    console.error("knowledge answer failed:", error);
    return NextResponse.json(buildExtractiveKnowledgeAnswer(question, evidence));
  }

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
