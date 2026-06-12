import type { Paragraph } from "@/lib/paragraphs";

export type SourceDoc = {
  id: string;
  title: string;
  paragraphs: Paragraph[];
};

export type Brief = {
  promptBody: string;
  audience?: string;
  language: string;
  tone?: string;
  keyMessage?: string;
  industry?: string | null;
};

// Prompt shape from PLAN.md Appendix B: numbered paragraphs so the model
// (and later, citations) can point at exact source locations.
export function buildSystemPrompt(brief: Brief): string {
  const who = brief.industry
    ? `You create marketing content for businesses in the ${brief.industry} industry.`
    : `You create marketing content for businesses.`;
  return [
    who,
    `Use ONLY the provided source documents. If required information is not in the sources, state that it is missing — never invent product claims, statistics, usage directions, or regulatory statements.`,
    `Write in ${brief.language}.`,
    brief.tone ? `Tone: ${brief.tone.toLowerCase()}.` : null,
    `Return only the content itself — no preamble, no commentary about the sources.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildUserPrompt(docs: SourceDoc[], brief: Brief): string {
  const sources = docs
    .flatMap((doc) =>
      doc.paragraphs.map((p) => `[doc:${doc.id} "${doc.title}" ¶${p.n}] ${p.text}`)
    )
    .join("\n");

  const lines = [
    `SOURCES:`,
    sources,
    ``,
    `TASK: ${brief.promptBody}`,
  ];
  if (brief.audience) lines.push(`AUDIENCE: ${brief.audience}`);
  if (brief.keyMessage) lines.push(`KEY MESSAGE TO EMPHASIZE: ${brief.keyMessage}`);
  lines.push(`Write in ${brief.language}.`);
  return lines.join("\n");
}
