import type { ByContractType } from '@/lib/types';
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

/** Combined prospects + sales per service row; CC column before MV (matches stakeholder email layout) */
export interface ServiceOverviewRow {
  label: string;
  prospectCc: number;
  prospectMv: number;
  salesCc: number;
  salesMv: number;
  conversionRate: string;
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

function contractKind(contractType: string | undefined): 'CC' | 'MV' | null {
  if (contractType === 'CC') return 'CC';
  if (contractType === 'MV') return 'MV';
  return null;
}

/** Matches stakeholder layout: OEC, OWWA, Visa Lebanon, Visa Egypt, Visa Jordan, Visa Schengen (incl. other travel), passports */
export function formatServiceConversionRate(prospectTotal: number, salesTotal: number): string {
  if (prospectTotal <= 0) {
    return '0%';
  }
  return `${((100 * salesTotal) / prospectTotal).toFixed(1)}%`;
}

function serviceOverviewRow(
  label: string,
  prospectCc: number,
  prospectMv: number,
  salesCc: number,
  salesMv: number
): ServiceOverviewRow {
  return {
    label,
    prospectCc,
    prospectMv,
    salesCc,
    salesMv,
    conversionRate: formatServiceConversionRate(prospectCc + prospectMv, salesCc + salesMv),
  };
}

function countOecSalesByContract(details: EnrichedProspectDetail[]): { cc: number; mv: number } {
  let cc = 0;
  let mv = 0;
  for (const p of details) {
    if (!p.isOECProspect || !p.convertedServices.includes('OEC')) continue;
    const k = contractKind(p.contractType);
    if (k === 'CC') cc++;
    else if (k === 'MV') mv++;
  }
  return { cc, mv };
}

function countOwwaSalesByContract(details: EnrichedProspectDetail[]): { cc: number; mv: number } {
  let cc = 0;
  let mv = 0;
  for (const p of details) {
    if (!p.isOWWAProspect || !p.convertedServices.includes('OWWA')) continue;
    const k = contractKind(p.contractType);
    if (k === 'CC') cc++;
    else if (k === 'MV') mv++;
  }
  return { cc, mv };
}

function countFilipinaSalesByContract(details: EnrichedProspectDetail[]): { cc: number; mv: number } {
  let cc = 0;
  let mv = 0;
  for (const p of details) {
    if (!p.isFilipinaPassportRenewalProspect || !p.convertedServices.includes('Filipina PP')) continue;
    const k = contractKind(p.contractType);
    if (k === 'CC') cc++;
    else if (k === 'MV') mv++;
  }
  return { cc, mv };
}

function countEthiopianSalesByContract(details: EnrichedProspectDetail[]): { cc: number; mv: number } {
  let cc = 0;
  let mv = 0;
  for (const p of details) {
    if (!p.isEthiopianPassportRenewalProspect || !p.convertedServices.includes('Ethiopian PP')) continue;
    const k = contractKind(p.contractType);
    if (k === 'CC') cc++;
    else if (k === 'MV') mv++;
  }
  return { cc, mv };
}

const TRAVEL_SALES_ORDER: { key: string; aliases: string[] }[] = [
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

function countTravelSalesByContract(
  details: EnrichedProspectDetail[]
): Record<string, { cc: number; mv: number }> {
  const out: Record<string, { cc: number; mv: number }> = {
    'Visa Lebanon': { cc: 0, mv: 0 },
    'Visa Egypt': { cc: 0, mv: 0 },
    'Visa Jordan': { cc: 0, mv: 0 },
    'Visa Schengen': { cc: 0, mv: 0 },
  };

  const allocated = new Set<string>();
  for (const p of details) {
    if (!p.isTravelVisaProspect || !prospectHasTravelConversion(p)) continue;
    const key = prospectDedupeKey(p);
    if (allocated.has(key)) continue;

    for (const { key: rowKey, aliases } of TRAVEL_SALES_ORDER) {
      if (prospectCountriesMatch(p, aliases)) {
        const k = contractKind(p.contractType);
        if (k === 'CC') out[rowKey].cc++;
        else if (k === 'MV') out[rowKey].mv++;
        allocated.add(key);
        break;
      }
    }
  }

  return out;
}

/** Service overview — prospect CC/MV from dashboard; sales CC/MV from complaint conversions */
export function buildServiceOverviewRows(
  byContractType: ByContractType,
  countryCountsByContractType: { MV: Record<string, number>; CC: Record<string, number> },
  details: EnrichedProspectDetail[]
): ServiceOverviewRow[] {
  const mv = countryCountsByContractType.MV;
  const cc = countryCountsByContractType.CC;

  const schengenProspectMatchers = [
    (k: string) => matchAliases(k, ['schengen']),
    (k: string) => matchAliases(k, ['turkey', 'türkiye', 'turkiye']),
    (k: string) => matchAliases(k, ['golden visa', 'golden']),
    (k: string) => matchAliases(k, ['family visa', 'family']),
    (k: string) => matchAliases(k, ['gcc', 'g.c.c', 'gulf']),
  ];

  const pLebanonMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['lebanon'])]);
  const pLebanonCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['lebanon'])]);
  const pEgyptMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['egypt'])]);
  const pEgyptCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['egypt'])]);
  const pJordanMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['jordan'])]);
  const pJordanCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['jordan'])]);
  const pSchengenMv = countryCountsMatching(mv, schengenProspectMatchers);
  const pSchengenCc = countryCountsMatching(cc, schengenProspectMatchers);

  const travelSales = countTravelSalesByContract(details);
  const oecSales = countOecSalesByContract(details);
  const owwaSales = countOwwaSalesByContract(details);
  const filSales = countFilipinaSalesByContract(details);
  const ethSales = countEthiopianSalesByContract(details);

  return [
    serviceOverviewRow(
      'OEC',
      byContractType.CC.oec,
      byContractType.MV.oec,
      oecSales.cc,
      oecSales.mv
    ),
    serviceOverviewRow(
      'OWWA',
      byContractType.CC.owwa,
      byContractType.MV.owwa,
      owwaSales.cc,
      owwaSales.mv
    ),
    serviceOverviewRow(
      'Visa Lebanon',
      pLebanonCc,
      pLebanonMv,
      travelSales['Visa Lebanon'].cc,
      travelSales['Visa Lebanon'].mv
    ),
    serviceOverviewRow(
      'Visa Egypt',
      pEgyptCc,
      pEgyptMv,
      travelSales['Visa Egypt'].cc,
      travelSales['Visa Egypt'].mv
    ),
    serviceOverviewRow(
      'Visa Jordan',
      pJordanCc,
      pJordanMv,
      travelSales['Visa Jordan'].cc,
      travelSales['Visa Jordan'].mv
    ),
    serviceOverviewRow(
      'Visa Schengen',
      pSchengenCc,
      pSchengenMv,
      travelSales['Visa Schengen'].cc,
      travelSales['Visa Schengen'].mv
    ),
    serviceOverviewRow(
      'Passport Filipina',
      byContractType.CC.filipinaPassportRenewal || 0,
      byContractType.MV.filipinaPassportRenewal || 0,
      filSales.cc,
      filSales.mv
    ),
    serviceOverviewRow(
      'Passport Ethiopian',
      byContractType.CC.ethiopianPassportRenewal || 0,
      byContractType.MV.ethiopianPassportRenewal || 0,
      ethSales.cc,
      ethSales.mv
    ),
  ];
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

export function serviceOverviewProspectTotal(rows: ServiceOverviewRow[]): number {
  return rows.reduce((sum, r) => sum + r.prospectCc + r.prospectMv, 0);
}

export function serviceOverviewSalesTotal(rows: ServiceOverviewRow[]): number {
  return rows.reduce((sum, r) => sum + r.salesCc + r.salesMv, 0);
}
