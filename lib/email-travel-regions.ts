/** Travel visa rows in the daily email; first matching region wins (same as dashboard allocation intent). */

import {
  EU_MEMBER_COUNTRY_ALIAS_TOKENS,
  VISA_SCHENGEN_NON_EU_ALIAS_TOKENS,
} from '@/lib/eu-member-countries';

export const EMAIL_TRAVEL_REGIONS: { key: string; aliases: string[] }[] = [
  { key: 'Visa Lebanon', aliases: ['lebanon'] },
  { key: 'Visa Egypt', aliases: ['egypt'] },
  { key: 'Visa Jordan', aliases: ['jordan'] },
  {
    key: 'Visa Schengen',
    aliases: [...VISA_SCHENGEN_NON_EU_ALIAS_TOKENS, ...EU_MEMBER_COUNTRY_ALIAS_TOKENS],
  },
];

function normalizeCountryToken(s: string): string {
  return s.trim().toLowerCase();
}

function matchAliases(key: string, aliases: string[]): boolean {
  const k = normalizeCountryToken(key);
  return aliases.some((a) => k === a || k.includes(a));
}

export function prospectCountriesMatchRegions(countries: string[] | undefined, aliases: string[]): boolean {
  const list = (countries || []).map(normalizeCountryToken);
  if (list.length === 0) return false;
  return list.some((c) => aliases.some((a) => c === a || c.includes(a)));
}

export function resolveEmailTravelRegionKey(travelVisaCountries: string[] | undefined): string | null {
  for (const { key, aliases } of EMAIL_TRAVEL_REGIONS) {
    if (prospectCountriesMatchRegions(travelVisaCountries, aliases)) {
      return key;
    }
  }
  return null;
}
