import type { DailyEmailReportData } from '@/lib/daily-email-report';
import type { ServiceOverviewRow } from '@/lib/email-report-layout';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPercent(value: number): string {
  const hasFraction = Math.round(value) !== value;
  return `${value.toFixed(hasFraction ? 1 : 0)}%`;
}

/** Em dash — (missing / TBD data) */
const EM = '&#8212;';

const font = "Segoe UI,Calibri,sans-serif";
const thStyle = `padding:8px 10px;background:#4472c4;color:#fff;font-size:11px;font-weight:600;text-align:center;border:1px solid #bdc3c7;font-family:${font}`;
const thLeft = `padding:8px 10px;background:#4472c4;color:#fff;font-size:11px;font-weight:600;text-align:left;border:1px solid #bdc3c7;font-family:${font}`;
const tdBase = `padding:8px 10px;border:1px solid #bdc3c7;font-size:12px;color:#212121;font-family:${font}`;
const tdMuted = `padding:8px 10px;border:1px solid #bdc3c7;font-size:12px;color:#757575;font-family:${font};text-align:center`;

const CSAT_SERVICE_ROWS = [
  'OEC',
  'OWWA',
  'Visa Lebanon',
  'Visa Egypt',
  'Visa Jordan',
  'Visa Schengen',
  'Passport Filipina',
  'Passport Ethiopian',
] as const;

function fmtAvgCell(n: number): string {
  if (n === 0) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const tdNum = (extra: string) => `padding:8px 10px;border:1px solid #bdc3c7;font-size:12px;color:#212121;font-family:${font};text-align:center;${extra}`;

function serviceDataCells(row: ServiceOverviewRow, bold = false): string {
  const s = bold ? `${tdNum('font-weight:bold')}` : `${tdBase};text-align:center`;
  return `
          <td style="${s}">${row.prospectCc}</td>
          <td style="${s}">${row.prospectMv}</td>
          <td style="${s}">${row.prospectMtdCc}</td>
          <td style="${s}">${row.prospectMtdMv}</td>
          <td style="${s}">${fmtAvgCell(row.prospectMtdAvgCc)}</td>
          <td style="${s}">${fmtAvgCell(row.prospectMtdAvgMv)}</td>
          <td style="${s}">${row.salesCc}</td>
          <td style="${s}">${row.salesMv}</td>
          <td style="${s}">${row.salesMtdCc}</td>
          <td style="${s}">${row.salesMtdMv}</td>
          <td style="${s}">${fmtAvgCell(row.salesMtdAvgCc)}</td>
          <td style="${s}">${fmtAvgCell(row.salesMtdAvgMv)}</td>
          <td style="${s}">${escapeHtml(row.conversionRate)}</td>
          <td style="${s}">${escapeHtml(row.conversionRateMtd)}</td>
          <td style="${s}">${fmtAvgCell(row.lmProspectDailyAvg)}</td>
          <td style="${s}">${fmtAvgCell(row.lmSalesDailyAvg)}</td>
          <td style="${s}">${escapeHtml(row.lmConversionRate)}</td>`;
}

function renderServiceOverviewTable(rows: ServiceOverviewRow[], totals: ServiceOverviewRow): string {
  const bodyRows = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f9fafb';
      return `
        <tr style="background:${bg}">
          <td style="${tdBase}">${escapeHtml(row.label)}</td>
          ${serviceDataCells(row)}
        </tr>`;
    })
    .join('');

  return `
    <table style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:1100px;margin:0 0 24px 0" cellspacing="0" cellpadding="0">
      <thead>
        <tr>
          <th style="${thLeft}" rowspan="3">Service Type</th>
          <th style="${thStyle}" colspan="6">Prospect</th>
          <th style="${thStyle}" colspan="6">Sales</th>
          <th style="${thStyle}" colspan="2">Conversion</th>
          <th style="${thStyle}" colspan="3">LM (last month)</th>
        </tr>
        <tr>
          <th style="${thStyle}" colspan="2">Daily</th>
          <th style="${thStyle}" colspan="2">MTD total</th>
          <th style="${thStyle}" colspan="2">MTD avg</th>
          <th style="${thStyle}" colspan="2">Daily</th>
          <th style="${thStyle}" colspan="2">MTD total</th>
          <th style="${thStyle}" colspan="2">MTD avg</th>
          <th style="${thStyle}" rowspan="2">Daily</th>
          <th style="${thStyle}" rowspan="2">MTD avg</th>
          <th style="${thStyle}" rowspan="2">Prospect daily avg</th>
          <th style="${thStyle}" rowspan="2">Sales daily avg</th>
          <th style="${thStyle}" rowspan="2">Conv. rate</th>
        </tr>
        <tr>
          <th style="${thStyle}">CC</th>
          <th style="${thStyle}">MV</th>
          <th style="${thStyle}">CC</th>
          <th style="${thStyle}">MV</th>
          <th style="${thStyle}">CC</th>
          <th style="${thStyle}">MV</th>
          <th style="${thStyle}">CC</th>
          <th style="${thStyle}">MV</th>
          <th style="${thStyle}">CC</th>
          <th style="${thStyle}">MV</th>
          <th style="${thStyle}">CC</th>
          <th style="${thStyle}">MV</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr style="font-weight:bold;background:#d9e2f3;border-top:2px solid #4472c4;font-family:${font}">
          <td style="padding:8px 10px;border:1px solid #bdc3c7;font-weight:bold"><strong>TOTALS</strong></td>
          ${serviceDataCells(totals, true)}
        </tr>
      </tbody>
    </table>`;
}

function renderCsatReplyRateTable(): string {
  const rows = CSAT_SERVICE_ROWS.map(
    (label, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
          <td style="${tdBase}">${escapeHtml(label)}</td>
          <td style="${tdMuted}">${EM}</td>
          <td style="${tdMuted}">${EM}</td>
          <td style="${tdMuted}">${EM}</td>
          <td style="${tdMuted}">${EM}</td>
          <td style="${tdMuted}">${EM}</td>
        </tr>`
  ).join('');

  return `
    <table style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:680px;margin:0 0 24px 0" cellspacing="0" cellpadding="0">
      <thead>
        <tr>
          <th style="${thLeft}">Service Type</th>
          <th style="${thStyle}">Reply Rate</th>
          <th style="${thStyle}">Completed in Time</th>
          <th style="${thStyle}">Completed Late</th>
          <th style="${thStyle}">CSAT Replies</th>
          <th style="${thStyle}">CSAT</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="font-weight:bold;background:#d9e2f3;border-top:2px solid #4472c4;font-family:${font}">
          <td style="padding:8px 10px;border:1px solid #bdc3c7;font-weight:bold">TOTALS</td>
          <td style="padding:8px 10px;border:1px solid #bdc3c7;text-align:center;color:#757575">${EM}</td>
          <td style="padding:8px 10px;border:1px solid #bdc3c7;text-align:center;color:#757575">${EM}</td>
          <td style="padding:8px 10px;border:1px solid #bdc3c7;text-align:center;color:#757575">${EM}</td>
          <td style="padding:8px 10px;border:1px solid #bdc3c7;text-align:center;color:#757575">${EM}</td>
          <td style="padding:8px 10px;border:1px solid #bdc3c7;text-align:center;color:#757575">${EM}</td>
        </tr>
      </tbody>
    </table>`;
}

function renderChatMetricsTable(report: DailyEmailReportData): string {
  const c = report.chatAnalysis;

  return `
    <table style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:560px;margin:0 0 16px 0" cellspacing="0" cellpadding="0">
      <thead>
        <tr>
          <th style="${thStyle}">Total Chats</th>
          <th style="${thStyle}">Frustrated Clients</th>
          <th style="${thStyle}">Frustrated Chats</th>
          <th style="${thStyle}">Confused Clients</th>
          <th style="${thStyle}">Confused Chats</th>
          <th style="${thStyle}">Chats Covered by Chatbot</th>
          <th style="${thStyle}">Coverage Rate</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#fff">
          <td style="${tdBase};text-align:center">${c.totalChats}</td>
          <td style="${tdBase};text-align:center">${c.frustratedClients}</td>
          <td style="${tdBase};text-align:center">${c.frustratedChats}</td>
          <td style="${tdBase};text-align:center">${c.confusedClients}</td>
          <td style="${tdBase};text-align:center">${c.confusedChats}</td>
          <td style="${tdBase};text-align:center">0</td>
          <td style="${tdBase};text-align:center">0%</td>
        </tr>
      </tbody>
    </table>`;
}

function renderChatSummaryTable(report: DailyEmailReportData): string {
  const col = escapeHtml(report.columnLabelShort);
  const fr = escapeHtml(formatPercent(report.chatAnalysis.frustrationPercent));
  const frm = escapeHtml(formatPercent(report.chatAnalysis.frustrationPercentMtdAvg));
  const cr = escapeHtml(formatPercent(report.chatAnalysis.confusionPercent));
  const crm = escapeHtml(formatPercent(report.chatAnalysis.confusionPercentMtdAvg));
  const mtdN = report.chatAnalysis.chatMtdDaysCounted;

  return `
    <table style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:360px;margin:0 0 16px 0" cellspacing="0" cellpadding="0">
      <thead>
        <tr>
          <th style="${thLeft}">Summary</th>
          <th style="${thStyle}">${col} (daily)</th>
          <th style="${thStyle}">MTD avg${mtdN > 0 ? ` (${mtdN}d)` : ''}</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#fff">
          <td style="${tdBase}">Frustration Rate</td>
          <td style="${tdBase};text-align:center">${fr}</td>
          <td style="${tdBase};text-align:center">${frm}</td>
        </tr>
        <tr style="background:#f9fafb">
          <td style="${tdBase}">Confusion Rate</td>
          <td style="${tdBase};text-align:center">${cr}</td>
          <td style="${tdBase};text-align:center">${crm}</td>
        </tr>
        <tr style="background:#fff">
          <td style="${tdBase}">Chatbot Coverage</td>
          <td style="${tdBase};text-align:center">0.0%</td>
          <td style="${tdBase};text-align:center">${EM}</td>
        </tr>
      </tbody>
    </table>`;
}

function sectionTitle(num: string, title: string): string {
  return `
    <div style="padding:8px 0 8px 12px;margin:28px 0 12px 0;font-size:16px;font-weight:bold;color:#2c3e50;border-left:4px solid #4472c4;background:#f8f9fa;font-family:${font}">
      ${escapeHtml(num)}. ${escapeHtml(title)}
    </div>`;
}

export function buildDailyEmailSubject(report: DailyEmailReportData): string {
  return `PRO Services Daily Report - ${report.displayDate}`;
}

export function renderDailyEmailText(report: DailyEmailReportData): string {
  const totals = report.prospects.totalsRow;
  const lines = report.prospects.rows.map((r) => {
    const pr = `pr d ${r.prospectCc}/${r.prospectMv} mtd ${r.prospectMtdCc}/${r.prospectMtdMv} avg ${fmtAvgCell(r.prospectMtdAvgCc)}/${fmtAvgCell(r.prospectMtdAvgMv)}`;
    const sa = `sa d ${r.salesCc}/${r.salesMv} mtd ${r.salesMtdCc}/${r.salesMtdMv} avg ${fmtAvgCell(r.salesMtdAvgCc)}/${fmtAvgCell(r.salesMtdAvgMv)}`;
    const cv = `conv ${r.conversionRate} mtd ${r.conversionRateMtd}`;
    const lm = `LM avg pr/sa/cv ${fmtAvgCell(r.lmProspectDailyAvg)}/${fmtAvgCell(r.lmSalesDailyAvg)}/${r.lmConversionRate}`;
    return `  ${r.label}: ${pr} | ${sa} | ${cv} | ${lm}`;
  });

  return [
    'PRO Services',
    'Daily Report',
    report.displayDate,
    '',
    `Service overview: MTD uses ${report.prospects.mtdDaysCounted} day(s) with data; LM uses ${report.prospects.lmDaysCounted} day(s).`,
    '',
    '1. Service Overview',
    ...lines,
    `  TOTALS: pr d ${totals.prospectCc}/${totals.prospectMv} mtd ${totals.prospectMtdCc}/${totals.prospectMtdMv} | sa d ${totals.salesCc}/${totals.salesMv} mtd ${totals.salesMtdCc}/${totals.salesMtdMv} | conv ${totals.conversionRate} mtd ${totals.conversionRateMtd} | LM ${fmtAvgCell(totals.lmProspectDailyAvg)}/${fmtAvgCell(totals.lmSalesDailyAvg)}/${totals.lmConversionRate}`,
    '',
    '2. CSAT & Reply Rate',
    '  (data pending —)',
    '',
    '3. Chat Analysis',
    `  Total chats: ${report.chatAnalysis.totalChats}`,
    `  Frustrated clients: ${report.chatAnalysis.frustratedClients}`,
    `  Frustrated chats: ${report.chatAnalysis.frustratedChats}`,
    `  Confused clients: ${report.chatAnalysis.confusedClients}`,
    `  Confused chats: ${report.chatAnalysis.confusedChats}`,
    `  Frustration rate daily: ${formatPercent(report.chatAnalysis.frustrationPercent)} | MTD avg (${report.chatAnalysis.chatMtdDaysCounted}d): ${formatPercent(report.chatAnalysis.frustrationPercentMtdAvg)}`,
    `  Confusion rate daily: ${formatPercent(report.chatAnalysis.confusionPercent)} | MTD avg: ${formatPercent(report.chatAnalysis.confusionPercentMtdAvg)}`,
    '',
    'CSAT columns in the HTML table still use an em dash where data is not yet available.',
    '',
    `Generated for ${report.date} (${report.timezone}).`,
  ].join('\n');
}

export function renderDailyEmailHtml(report: DailyEmailReportData): string {
  const subject = escapeHtml(buildDailyEmailSubject(report));
  const totals = report.prospects.totalsRow;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#e8eaed;font-family:${font};line-height:1.5;color:#212121;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e8eaed;width:100%;">
    <tr>
      <td style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:720px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#4472c4;color:#fff;padding:20px 24px;">
              <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;opacity:0.9">PRO Services</div>
              <h1 style="margin:8px 0 4px 0;font-size:26px;font-weight:bold;">Daily Report</h1>
              <div style="font-size:14px;opacity:0.95">${escapeHtml(report.displayDate)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 32px 24px;">
              ${sectionTitle('1', 'Service Overview')}
              ${renderServiceOverviewTable(report.prospects.rows, totals)}
              ${sectionTitle('2', 'CSAT & Reply Rate')}
              ${renderCsatReplyRateTable()}
              ${sectionTitle('3', 'Chat Analysis')}
              ${renderChatMetricsTable(report)}
              ${renderChatSummaryTable(report)}
              <div style="margin-top:12px;font-size:12px;color:#424242;line-height:1.5;">
                Prospect/sales MTD totals and averages include only days with complete data (${report.prospects.mtdDaysCounted} day(s) this month through the report date). LM uses ${report.prospects.lmDaysCounted} day(s) in the prior calendar month. Chat MTD averages use ${report.chatAnalysis.chatMtdDaysCounted} day(s) with chat analysis. CSAT columns still show &quot;&#8212;&quot; where not yet available.
              </div>
              <div style="margin-top:20px;font-size:10px;color:#5f6368;font-style:italic;">
                Generated automatically for ${escapeHtml(report.date)} (${escapeHtml(report.timezone)}).
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
