/** Travel visa rows in the daily email; first matching region wins (same as dashboard allocation intent). */

export const EMAIL_TRAVEL_REGIONS: { key: string; aliases: string[] }[] = [
  { key: 'Visa Lebanon', aliases: ['lebanon'] },
  { key: 'Visa Egypt', aliases: ['egypt'] },
  { key: 'Visa Jordan', aliases: ['jordan'] },
  {
    key: 'Visa Schengen',
    aliases: [
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
    ],
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
