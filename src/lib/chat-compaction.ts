// Chat context compaction — summarizes old messages to keep context manageable
// Inspired by Claude Code's services/compact/ system
//
// WHY: Long chat sessions accumulate messages that eventually exceed context
// limits or become expensive. This module compacts older messages into a
// single summary while keeping recent messages intact so the AI still has
// immediate conversational context.

const MAX_MESSAGES_BEFORE_COMPACT = 20;
const MESSAGES_TO_KEEP = 6; // Keep the most recent messages intact

export type CompactableChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Returns true when the conversation is long enough to benefit from compaction.
 */
export function shouldCompact(messages: CompactableChatMessage[]): boolean {
  return messages.length > MAX_MESSAGES_BEFORE_COMPACT;
}

/**
 * Compact a long conversation history into [summary] + [recent messages].
 * If the conversation is short enough, returns it unchanged.
 */
export function compactMessages(
  messages: CompactableChatMessage[],
): CompactableChatMessage[] {
  if (!shouldCompact(messages)) return messages;

  const oldMessages = messages.slice(0, -MESSAGES_TO_KEEP);
  const recentMessages = messages.slice(-MESSAGES_TO_KEEP);

  const summary = createSummary(oldMessages);

  // Return: [summary as assistant context message] + [recent messages]
  return [
    {
      role: "assistant" as const,
      content: `[Previous conversation summary: ${summary}]`,
    },
    ...recentMessages,
  ];
}

/**
 * Build a concise summary from a set of older messages.
 * Extracts user topics and assistant actions to preserve context.
 */
function createSummary(messages: CompactableChatMessage[]): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  const assistantActions = messages
    .filter((m) => m.role === "assistant")
    .map((m) => {
      const actions: string[] = [];
      const content = m.content.toLowerCase();
      if (content.includes("image")) actions.push("created images");
      if (content.includes("video")) actions.push("created videos");
      if (content.includes("copy")) actions.push("generated copy");
      if (content.includes("schedule")) actions.push("scheduled posts");
      if (content.includes("publish")) actions.push("published content");
      if (content.includes("analytics")) actions.push("reviewed analytics");
      if (content.includes("campaign")) actions.push("planned campaigns");
      if (content.includes("brand")) actions.push("discussed branding");
      if (content.includes("audience")) actions.push("analyzed audience");
      return actions;
    })
    .flat();

  const uniqueActions = [...new Set(assistantActions)];

  // Keep the last 5 user messages for topic coverage (truncated for brevity)
  const topicSummary = userMessages
    .slice(-5)
    .map((m) => m.slice(0, 100))
    .join("; ");

  const actionsSummary =
    uniqueActions.join(", ") || "general conversation";

  return `User discussed: ${topicSummary}. Actions taken: ${actionsSummary}. Total messages summarized: ${messages.length}.`;
}
