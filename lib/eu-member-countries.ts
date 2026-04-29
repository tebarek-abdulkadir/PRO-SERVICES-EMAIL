/**
 * Schengen bucket for dashboard / email: only these destination tokens (country labels + complaint types).
 * Aligned with stakeholder list: France, Germany, Spain, Switzerland, Croatia, Italy, Greece, Portugal, Bulgaria, Latvia.
 */

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export const SCHENGEN_ALLOWED_COUNTRY_ALIAS_TOKENS: readonly string[] = [
  'france',
  'germany',
  'spain',
  'switzerland',
  'croatia',
  'italy',
  'greece',
  'portugal',
  'bulgaria',
  'latvia',
];

function tokenMatchesKey(keyNorm: string, token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  return keyNorm === t || keyNorm.includes(t);
}

/** Country key from `countryCounts` / `countryCountsByContractType` (e.g. "Spain", "france"). */
export function countryKeyCountsAsVisaSchengen(key: string): boolean {
  const k = norm(key);
  if (!k || k === 'unspecified') return false;
  for (const token of SCHENGEN_ALLOWED_COUNTRY_ALIAS_TOKENS) {
    if (tokenMatchesKey(k, token)) return true;
  }
  if (tokenMatchesKey(k, 'schengen')) return true;
  return false;
}

/** Single travel visa country string from a prospect's list. */
export function travelVisaCountryLabelCountsAsVisaSchengen(label: string): boolean {
  return countryKeyCountsAsVisaSchengen(label);
}

/**
 * For `buildSalesEmailRows` Schengen count: allowed destinations + literal "schengen" token only.
 * (Golden / family / GCC / Saudi use their own rows in the allocation order.)
 */
export const VISA_SCHENGEN_SALES_EMAIL_ROW_ALIASES: readonly string[] = [
  'schengen',
  ...SCHENGEN_ALLOWED_COUNTRY_ALIAS_TOKENS,
];
