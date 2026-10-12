/**
 * What one conversation may hold and what one message may carry, shared by the
 * Convex functions that store the chat and by the app that sends it.
 *
 * Each limit is said where it bites: the composer counts characters toward
 * `userMessageChars`, the chat route refuses a turn in a full conversation with
 * a sentence that says so, and the history panel says when it lists only the
 * newest conversations. Retention (90 days, scheduledJobs) bounds the rest.
 */
export const CHAT_LIMITS = {
  /** Messages one conversation holds; past it the chat asks for a new one. */
  messagesPerConversation: 400,
  /** Characters a person may type in one message (the composer's own limit). */
  userMessageChars: 8_000,
  /** Characters kept of one assistant reply. */
  assistantMessageChars: 60_000,
  /** Characters kept of one tool call's arguments. */
  toolArgumentsChars: 20_000,
  /** Characters kept of one tool call's result. */
  toolResultChars: 40_000,
  /** Conversations the history panel lists, newest first. */
  conversationsListed: 200,
} as const;

/**
 * Reads of one conversation's messages stop here: a little past the cap,
 * because a reply is saved after the check that let its question in.
 */
export const MESSAGE_READ_CAP = CHAT_LIMITS.messagesPerConversation + 100;

/** The words the chat shows when a conversation is full. */
export const CONVERSATION_FULL_MESSAGE =
  `This conversation has reached ${CHAT_LIMITS.messagesPerConversation} messages. ` +
  "Start a new one from the history button to keep going.";

/** Keep at most `max` characters, saying where the text was cut. */
export function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[cut at ${max.toLocaleString("en-US")} characters]`;
}
