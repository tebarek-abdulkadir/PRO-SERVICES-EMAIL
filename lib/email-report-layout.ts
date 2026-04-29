import {
  countryKeyCountsAsVisaSchengen,
  VISA_SCHENGEN_SALES_EMAIL_ROW_ALIASES,
} from '@/lib/eu-member-countries';
import type { EmailSalesCcMvSplit } from '@/lib/prospects-report';
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
  /** Sum of daily prospect CC in current month through report date (days with data only). */
  prospectMtdCc: number;
  prospectMtdMv: number;
  /** prospectMtd / days counted */
  prospectMtdAvgCc: number;
  prospectMtdAvgMv: number;
  salesCc: number;
  salesMv: number;
  salesMtdCc: number;
  salesMtdMv: number;
  salesMtdAvgCc: number;
  salesMtdAvgMv: number;
  /** Daily conversion for the report date */
  conversionRate: string;
  /** Sales MTD total / prospect MTD total */
  conversionRateMtd: string;
  /** Last calendar month: avg daily prospects CC per day (days with data) */
  lmProspectDailyAvgCc: number;
  lmProspectDailyAvgMv: number;
  lmSalesDailyAvgCc: number;
  lmSalesDailyAvgMv: number;
  /** Last calendar month: absolute totals (sum over days with data) — used in email instead of LM daily averages. */
  lmProspectTotalCc: number;
  lmProspectTotalMv: number;
  lmSalesTotalCc: number;
  lmSalesTotalMv: number;
  lmConversionRate: string;
  /** From complaints-daily `summary` for the report day (not CC/MV split). */
  totalSalesYesterday: number;
  totalSalesThisMonth: number;
  totalSalesLastMonth: number;
}

/** Canonical order for the eight service-overview products (matches `buildServiceOverviewRows`). */
export const SERVICE_OVERVIEW_PRODUCT_LABELS: readonly string[] = [
  'OEC',
  'OWWA',
  'Visa Lebanon',
  'Visa Egypt',
  'Visa Jordan',
  'Visa Saudi',
  'Visa Schengen',
  'Passport Filipina',
  'Passport Ethiopian',
];

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
  const pt = prospectCc + prospectMv;
  const st = salesCc + salesMv;
  return {
    label,
    prospectCc,
    prospectMv,
    prospectMtdCc: 0,
    prospectMtdMv: 0,
    prospectMtdAvgCc: 0,
    prospectMtdAvgMv: 0,
    salesCc,
    salesMv,
    salesMtdCc: 0,
    salesMtdMv: 0,
    salesMtdAvgCc: 0,
    salesMtdAvgMv: 0,
    conversionRate: formatServiceConversionRate(pt, st),
    conversionRateMtd: '0%',
    lmProspectDailyAvgCc: 0,
    lmProspectDailyAvgMv: 0,
    lmSalesDailyAvgCc: 0,
    lmSalesDailyAvgMv: 0,
    lmProspectTotalCc: 0,
    lmProspectTotalMv: 0,
    lmSalesTotalCc: 0,
    lmSalesTotalMv: 0,
    lmConversionRate: '0%',
    totalSalesYesterday: 0,
    totalSalesThisMonth: 0,
    totalSalesLastMonth: 0,
  };
}

/** Service overview — prospect CC/MV from dashboard; sales CC/MV = unique conversions by household contract (aligned with dashboard). */
export function buildServiceOverviewRows(
  byContractType: ByContractType,
  countryCountsByContractType: { MV: Record<string, number>; CC: Record<string, number> },
  emailSalesCcMv: EmailSalesCcMvSplit
): ServiceOverviewRow[] {
  const mv = countryCountsByContractType.MV;
  const cc = countryCountsByContractType.CC;

  const pLebanonMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['lebanon'])]);
  const pLebanonCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['lebanon'])]);
  const pEgyptMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['egypt'])]);
  const pEgyptCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['egypt'])]);
  const pJordanMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['jordan'])]);
  const pJordanCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['jordan'])]);
  const pSaudiMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['saudi', 'saudi arabia', 'ksa'])]);
  const pSaudiCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['saudi', 'saudi arabia', 'ksa'])]);
  const pSchengenMv = countryCountsMatching(mv, [(k) => countryKeyCountsAsVisaSchengen(k)]);
  const pSchengenCc = countryCountsMatching(cc, [(k) => countryKeyCountsAsVisaSchengen(k)]);

  const travelSales = emailSalesCcMv.travel;
  const visa = (key: string) => travelSales[key] ?? { cc: 0, mv: 0 };
  const oecSales = emailSalesCcMv.oec;
  const owwaSales = emailSalesCcMv.owwa;
  const filSales = emailSalesCcMv.filipinaPassportRenewal;
  const ethSales = emailSalesCcMv.ethiopianPassportRenewal;

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
      visa('Visa Lebanon').cc,
      visa('Visa Lebanon').mv
    ),
    serviceOverviewRow(
      'Visa Egypt',
      pEgyptCc,
      pEgyptMv,
      visa('Visa Egypt').cc,
      visa('Visa Egypt').mv
    ),
    serviceOverviewRow(
      'Visa Jordan',
      pJordanCc,
      pJordanMv,
      visa('Visa Jordan').cc,
      visa('Visa Jordan').mv
    ),
    serviceOverviewRow(
      'Visa Saudi',
      pSaudiCc,
      pSaudiMv,
      visa('Visa Saudi').cc,
      visa('Visa Saudi').mv
    ),
    serviceOverviewRow(
      'Visa Schengen',
      pSchengenCc,
      pSchengenMv,
      visa('Visa Schengen').cc,
      visa('Visa Schengen').mv
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
    { label: 'Visa to Saudi', aliases: ['saudi', 'saudi arabia', 'ksa'] },
    { label: 'Schengen', aliases: [...VISA_SCHENGEN_SALES_EMAIL_ROW_ALIASES] },
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
    ...travelAllocationOrder.slice(0, -1).map(({ label }) => ({
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
