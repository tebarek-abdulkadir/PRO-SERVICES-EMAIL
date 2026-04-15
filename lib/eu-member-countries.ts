/**
 * EU member states (27) — English names / common variants for matching CRM country strings.
 * Used to roll prospect counts and sales into the email "Visa Schengen" row together with legacy tokens.
 */

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Substrings or full keys matched against normalized country labels (same idea as `matchAliases` in email-report-layout). */
export const EU_MEMBER_COUNTRY_ALIAS_TOKENS: readonly string[] = [
  'austria',
  'belgium',
  'bulgaria',
  'croatia',
  'cyprus',
  'czech republic',
  'czechia',
  'czech',
  'denmark',
  'estonia',
  'finland',
  'france',
  'germany',
  'greece',
  'hungary',
  'ireland',
  'italy',
  'latvia',
  'lithuania',
  'luxembourg',
  'malta',
  'netherlands',
  'holland',
  'poland',
  'portugal',
  'romania',
  'slovakia',
  'slovenia',
  'spain',
  'sweden',
];

/** Non-EU labels that still map to the same email / dashboard "Visa Schengen" product row (legacy behavior). */
export const VISA_SCHENGEN_NON_EU_ALIAS_TOKENS: readonly string[] = [
  'schengen',
  'turkey',
  'türkiye',
  'turkiye',
  'golden visa',
  'golden',
  'family visa',
  'family',
  'gcc',
  'g.c.c',
  'gulf',
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
  for (const token of VISA_SCHENGEN_NON_EU_ALIAS_TOKENS) {
    if (tokenMatchesKey(k, token)) return true;
  }
  for (const token of EU_MEMBER_COUNTRY_ALIAS_TOKENS) {
    if (tokenMatchesKey(k, token)) return true;
  }
  return false;
}

/** Single travel visa country string from a prospect's list. */
export function travelVisaCountryLabelCountsAsVisaSchengen(label: string): boolean {
  return countryKeyCountsAsVisaSchengen(label);
}

/**
 * For `buildSalesEmailRows` Schengen count: EU + schengen/turkey tokens only.
 * (Golden / family / GCC use their own rows in the same allocation order.)
 */
export const VISA_SCHENGEN_SALES_EMAIL_ROW_ALIASES: readonly string[] = [
  'schengen',
  'turkey',
  'türkiye',
  'turkiye',
  ...EU_MEMBER_COUNTRY_ALIAS_TOKENS,
];
