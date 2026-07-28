export type AskConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1_500;
const MAX_HISTORY_CHARS = 6_000;

function normalizeMessage(value: unknown): AskConversationMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as { role?: unknown; content?: unknown };
  if (
    (message.role !== "user" && message.role !== "assistant") ||
    typeof message.content !== "string"
  ) {
    return null;
  }

  const content = message.content.replace(/\s+/g, " ").trim();
  if (!content) return null;
  return {
    role: message.role,
    content: content.slice(0, MAX_MESSAGE_CHARS),
  };
}

export function compactAskConversation(value: unknown) {
  const messages = Array.isArray(value)
    ? value.map(normalizeMessage).filter((message): message is AskConversationMessage => !!message)
    : [];
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  const lines: string[] = [];
  let totalChars = 0;

  for (const message of recent.toReversed()) {
    const line = `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`;
    if (totalChars + line.length > MAX_HISTORY_CHARS) break;
    lines.unshift(line);
    totalChars += line.length;
  }

  return {
    context: lines.join("\n"),
    hasHistory: lines.length > 0,
  };
}
