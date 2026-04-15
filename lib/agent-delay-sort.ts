import type { AgentDelayStats } from './chat-types';

/** Fastest first; N/A (null / non-finite) last; ties broken alphabetically by name */
export function compareAgentDelayStats(a: AgentDelayStats, b: AgentDelayStats): number {
  const rank = (s: AgentDelayStats) =>
    s.avgDelaySeconds != null && Number.isFinite(s.avgDelaySeconds)
      ? s.avgDelaySeconds
      : Number.POSITIVE_INFINITY;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return a.agentName.localeCompare(b.agentName, undefined, { sensitivity: 'base' });
}
