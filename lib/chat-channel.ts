/**
 * Classify chat analysis rows into Bot- vs Agent-handled queues using `skill`
 * from CC (e.g. VBC_ROUTING_BOT vs VBC_SALES_AGENTS). Adjust patterns if your
 * Snowflake / n8n skill names change.
 */
export type ChatChannelKind = 'bot' | 'agent' | 'unclassified';

export function getChatChannelFromSkill(skill?: string): ChatChannelKind {
  if (!skill || !skill.trim()) {
    return 'unclassified';
  }
  const s = skill.trim();

  // Automated / routing / GPT-assisted flows → "Bot"
  if (/\bROUTING_BOT\b|_BOT\b|\bBOT\b/i.test(s) || /^GPT_/i.test(s)) {
    return 'bot';
  }

  // Human agent queues (sales, resolvers, delighters, etc.)
  if (/\bAGENTS\b|\bRESOLVERS\b|\bSALES\b|\bDELIGHTER\b/i.test(s)) {
    return 'agent';
  }

  return 'unclassified';
}
