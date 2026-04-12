/**
 * Bot vs agent classification from joinedSkills (comma-separated, contains match, case-insensitive).
 */
const BOT_TOKENS = ['GPT_VBC_SALES', 'VBC_ROUTING_BOT'] as const;
const AGENT_TOKENS = ['VBC_SALES_AGENTS', 'VBC_RESOLVERS_AGENTS'] as const;

function normalizeJoinedSkills(s: string | undefined): string {
  return (s ?? '').toUpperCase();
}

export function joinedSkillsIndicatesBot(joinedSkills?: string): boolean {
  const u = normalizeJoinedSkills(joinedSkills);
  return BOT_TOKENS.some((t) => u.includes(t));
}

export function joinedSkillsIndicatesAgent(joinedSkills?: string): boolean {
  const u = normalizeJoinedSkills(joinedSkills);
  return AGENT_TOKENS.some((t) => u.includes(t));
}

export function mergeJoinedSkillsFields(a?: string, b?: string): string {
  const parts = new Set<string>();
  for (const raw of [a, b]) {
    if (!raw?.trim()) continue;
    for (const p of raw.split(',')) {
      const t = p.trim();
      if (t) parts.add(t);
    }
  }
  return Array.from(parts).join(', ');
}
