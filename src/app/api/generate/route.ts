import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/generation";
import type { Paragraph } from "@/lib/paragraphs";
import { consumeApiRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("Generation is not configured (missing API key).", { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const rateLimit = await consumeApiRateLimit(supabase, "legacy.generate");
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  } catch (error) {
    console.error("legacy generation rate limit failed:", error);
    return new Response("Generation is temporarily unavailable.", { status: 503 });
  }

  const body = (await req.json()) as {
    templateId?: string;
    documentIds?: string[];
    audience?: string;
    language?: string;
    tone?: string;
    keyMessage?: string;
  };
  const { templateId, documentIds, audience, language, tone, keyMessage } = body;

  if (!templateId || !documentIds?.length) {
    return new Response("Pick a template and at least one source document.", { status: 400 });
  }

  // RLS scopes every read to the caller's org — a foreign id simply returns nothing.
  const [{ data: template }, { data: docs }, { data: profile }] = await Promise.all([
    supabase.from("templates").select("id, name, prompt_body").eq("id", templateId).single(),
    supabase
      .from("documents")
      .select("id, title, paragraphs")
      .in("id", documentIds),
    supabase
      .from("profiles")
      .select("organizations(industry)")
      .eq("id", user.id)
      .single(),
  ]);

  if (!template) return new Response("Template not found.", { status: 404 });
  if (!docs || docs.length === 0) {
    return new Response("None of the selected documents were found.", { status: 404 });
  }

  const org = Array.isArray(profile?.organizations)
    ? profile?.organizations[0]
    : profile?.organizations;

  const brief = {
    promptBody: template.prompt_body,
    audience: audience?.trim() || undefined,
    language: language?.trim() || "English",
    tone: tone?.trim() || undefined,
    keyMessage: keyMessage?.trim() || undefined,
    industry: org?.industry ?? null,
  };

  const sourceDocs = docs.map((d) => ({
    id: d.id,
    title: d.title,
    paragraphs: (d.paragraphs ?? []) as Paragraph[],
  }));

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 2048,
          system: buildSystemPrompt(brief),
          messages: [{ role: "user", content: buildUserPrompt(sourceDocs, brief) }],
        });
        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
