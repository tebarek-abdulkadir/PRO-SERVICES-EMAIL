import type { Prospects } from '@/lib/types';
import type { EnrichedProspectDetail } from '@/lib/prospects-report';

export function shortDateColumnLabel(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export interface EmailReportTableRow {
  label: string;
  count: number;
}

function normalizeCountryToken(s: string): string {
  return s.trim().toLowerCase();
}

function countryCountsMatching(
  countryCounts: Record<string, number>,
  matchers: ((key: string) => boolean)[]
): number {
  let sum = 0;
  for (const [key, count] of Object.entries(countryCounts)) {
    if (!key || key.toLowerCase() === 'unspecified') continue;
    if (matchers.some((m) => m(key))) {
      sum += count;
    }
  }
  return sum;
}

function matchAliases(key: string, aliases: string[]): boolean {
  const k = normalizeCountryToken(key);
  return aliases.some((a) => k === a || k.includes(a));
}

/** Prospects section — same product order as email-report.html */
export function buildProspectsEmailRows(
  prospects: Prospects,
  countryCounts: Record<string, number>
): EmailReportTableRow[] {
  const rows: EmailReportTableRow[] = [
    { label: 'OEC/Contract Verification', count: prospects.oec || 0 },
    { label: 'OWWA', count: prospects.owwa || 0 },
    {
      label: 'Visa to Lebanon',
      count: countryCountsMatching(countryCounts, [(k) => matchAliases(k, ['lebanon'])]),
    },
    {
      label: 'Visa to Egypt',
      count: countryCountsMatching(countryCounts, [(k) => matchAliases(k, ['egypt'])]),
    },
    {
      label: 'Visa to Turkey',
      count: countryCountsMatching(countryCounts, [(k) => matchAliases(k, ['turkey', 'türkiye', 'turkiye'])]),
    },
    {
      label: 'Visa to Jordan',
      count: countryCountsMatching(countryCounts, [(k) => matchAliases(k, ['jordan'])]),
    },
    {
      label: 'Schengen',
      count: countryCountsMatching(countryCounts, [(k) => matchAliases(k, ['schengen'])]),
    },
    {
      label: 'Golden Visa',
      count: countryCountsMatching(countryCounts, [
        (k) => matchAliases(k, ['golden visa', 'golden']),
      ]),
    },
    {
      label: 'Family Visa',
      count: countryCountsMatching(countryCounts, [(k) => matchAliases(k, ['family visa', 'family'])]),
    },
    {
      label: 'Ethiopian Passport Renewal',
      count: prospects.ethiopianPassportRenewal || 0,
    },
    {
      label: 'Filipina Passport Renewal',
      count: prospects.filipinaPassportRenewal || 0,
    },
    {
      label: 'GCC',
      count: countryCountsMatching(countryCounts, [(k) => matchAliases(k, ['gcc', 'g.c.c', 'gulf'])]),
    },
  ];

  return rows;
}

function prospectHasTravelConversion(p: EnrichedProspectDetail): boolean {
  return p.convertedServices.includes('Travel Visa');
}

function prospectCountriesMatch(p: EnrichedProspectDetail, aliases: string[]): boolean {
  const countries = (p.travelVisaCountries || []).map(normalizeCountryToken);
  if (countries.length === 0) return false;
  return countries.some((c) =>
    aliases.some((a) => c === a || c.includes(a))
  );
}

function prospectDedupeKey(p: EnrichedProspectDetail): string {
  return p.contractId || p.maidId || p.clientId || p.conversationId || p.id;
}

/** Sales section — complaint-based conversions, same product order as email-report.html */
export function buildSalesEmailRows(details: EnrichedProspectDetail[]): EmailReportTableRow[] {
  const travelAllocationOrder: { label: string; aliases: string[] }[] = [
    { label: 'Visa to Lebanon', aliases: ['lebanon'] },
    { label: 'Visa to Egypt', aliases: ['egypt'] },
    { label: 'Travel to Jordan', aliases: ['jordan'] },
    { label: 'Schengen', aliases: ['schengen'] },
    { label: 'Golden Visa', aliases: ['golden visa', 'golden'] },
    { label: 'Family Visa', aliases: ['family visa', 'family'] },
    { label: 'GCC', aliases: ['gcc', 'g.c.c', 'gulf'] },
  ];

  const travelCounts = new Map<string, number>();
  for (const { label } of travelAllocationOrder) {
    travelCounts.set(label, 0);
  }

  const allocatedTravel = new Set<string>();
  for (const p of details) {
    if (!p.isTravelVisaProspect || !prospectHasTravelConversion(p)) continue;
    const key = prospectDedupeKey(p);
    if (allocatedTravel.has(key)) continue;

    for (const { label, aliases } of travelAllocationOrder) {
      if (prospectCountriesMatch(p, aliases)) {
        travelCounts.set(label, (travelCounts.get(label) || 0) + 1);
        allocatedTravel.add(key);
        break;
      }
    }
  }

  const rows: EmailReportTableRow[] = [
    {
      label: 'OEC/Contract Verification',
      count: details.filter(
        (p) => p.isOECProspect && p.convertedServices.includes('OEC')
      ).length,
    },
    {
      label: 'OWWA',
      count: details.filter(
        (p) => p.isOWWAProspect && p.convertedServices.includes('OWWA')
      ).length,
    },
    ...travelAllocationOrder.slice(0, 6).map(({ label }) => ({
      label,
      count: travelCounts.get(label) || 0,
    })),
    {
      label: 'Ethiopian Passport Renewal',
      count: details.filter(
        (p) =>
          p.isEthiopianPassportRenewalProspect &&
          p.convertedServices.includes('Ethiopian PP')
      ).length,
    },
    {
      label: 'Filipina Passport Renewal',
      count: details.filter(
        (p) =>
          p.isFilipinaPassportRenewalProspect &&
          p.convertedServices.includes('Filipina PP')
      ).length,
    },
    {
      label: 'GCC',
      count: travelCounts.get('GCC') || 0,
    },
  ];

  return rows;
}

export function tableRowsTotal(rows: EmailReportTableRow[]): number {
  return rows.reduce((sum, r) => sum + r.count, 0);
}
