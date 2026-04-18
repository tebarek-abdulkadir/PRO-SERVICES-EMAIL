import { formatSecondsAsAgentResponseTime } from '@/lib/chat-agent-response-time';
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
/** Chat analysis tables: MTD columns show placeholder until Vercel Pro (compact cell). */
const tdMtdPending = `padding:6px 4px;border:1px solid #bdc3c7;font-size:9px;line-height:1.15;color:#5f6368;font-family:${font};text-align:center;vertical-align:middle;max-width:92px;word-wrap:break-word`;
const MTD_PENDING_LABEL = 'Pending Vercel Pro Account';

function mtdPendingCell(): string {
  return `<td style="${tdMtdPending}">${escapeHtml(MTD_PENDING_LABEL)}</td>`;
}

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

const tdNum = (extra: string) => `padding:8px 10px;border:1px solid #bdc3c7;font-size:12px;color:#212121;font-family:${font};text-align:center;${extra}`;

function serviceDataCells(row: ServiceOverviewRow, bold = false): string {
  const s = bold ? `${tdNum('font-weight:bold')}` : `${tdBase};text-align:center`;
  return `
          <td style="${s}">${row.prospectCc}</td>
          <td style="${s}">${row.prospectMv}</td>
          <td style="${s}">${row.prospectMtdCc}</td>
          <td style="${s}">${row.prospectMtdMv}</td>
          <td style="${s}">${row.salesCc}</td>
          <td style="${s}">${row.salesMv}</td>
          <td style="${s}">${row.salesMtdCc}</td>
          <td style="${s}">${row.salesMtdMv}</td>
          <td style="${s}">${escapeHtml(row.conversionRate)}</td>
          <td style="${s}">${escapeHtml(row.conversionRateMtd)}</td>
          <td style="${s}">${row.lmProspectTotalCc}</td>
          <td style="${s}">${row.lmProspectTotalMv}</td>
          <td style="${s}">${row.lmSalesTotalCc}</td>
          <td style="${s}">${row.lmSalesTotalMv}</td>
          <td style="${s}">${escapeHtml(row.lmConversionRate)}</td>`;
}

function renderServiceOverviewTable(
  rows: ServiceOverviewRow[],
  totals: ServiceOverviewRow,
  periodNote?: { mtdDaysCounted: number; lmDaysCounted: number }
): string {
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
    <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:920px;margin:0 0 24px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:auto;" cellspacing="0" cellpadding="0">
      <thead>
        <tr>
          <th style="${thLeft}" rowspan="3">Service Type</th>
          <th style="${thStyle}" colspan="4">Prospect</th>
          <th style="${thStyle}" colspan="4">Sales</th>
          <th style="${thStyle}" colspan="2">Conversion</th>
          <th style="${thStyle}" colspan="5">LM (last month)</th>
        </tr>
        <tr>
          <th style="${thStyle}" colspan="2">Daily</th>
          <th style="${thStyle}" colspan="2">MTD total</th>
          <th style="${thStyle}" colspan="2">Daily</th>
          <th style="${thStyle}" colspan="2">MTD total</th>
          <th style="${thStyle}" rowspan="2">Daily</th>
          <th style="${thStyle}" rowspan="2">MTD</th>
          <th style="${thStyle}" colspan="2">Prospect total</th>
          <th style="${thStyle}" colspan="2">Sales total</th>
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
    </table>
    ${
      periodNote
        ? `<div style="font-size:10px;color:#757575;margin:8px 0 0 0;line-height:1.35;">MTD totals sum daily snapshots in range (missing days omitted). Last month totals sum the full prior calendar month where snapshots exist. Up to ${periodNote.mtdDaysCounted} MTD day(s) and ${periodNote.lmDaysCounted} LM day(s) with prospect snapshots.</div>`
        : ''
    }`;
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

function fmtCountPct(count: number, pctVal: number): string {
  return `${count} (${formatPercent(pctVal)})`;
}

function fmtScore(n: number | null): string {
  if (n == null || Number.isNaN(n)) return EM;
  return n.toFixed(2);
}

function fmtAvgAgentResponseSeconds(n: number | null): string {
  if (n == null || Number.isNaN(n)) return EM;
  return escapeHtml(formatSecondsAsAgentResponseTime(n));
}

/** Table 1: Bot coverage — client-initiated (consumer) chats only; matches By Conversation dashboard. */
function renderBotCoverageByConversationTable(report: DailyEmailReportData): string {
  const colToday = escapeHtml(report.columnLabelShort);
  const b = report.byConversationEmail;
  const t = b.consumerBotCoverageToday;

  return `
    <div style="margin:0 0 8px 0;font-family:${font}">
      <div style="font-size:16px;font-weight:bold;color:#2c3e50;">Bot Coverage</div>
      <div style="font-size:11px;color:#5f6368;margin-top:4px;line-height:1.4;">
        <span style="font-weight:600;">(Only Client Initiated Chats)</span> — All metrics in this table count only conversations where the initiator is Consumer
      </div>
    </div>
    <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:720px;margin:0 0 24px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;" cellspacing="0" cellpadding="0">
      <thead>
        <tr>
          <th style="${thStyle}" colspan="2">Total Chats</th>
          <th style="${thStyle}" colspan="2">Bot Coverage (Bot Involved)</th>
          <th style="${thStyle}" colspan="2">Fully Handled By Bot</th>
          <th style="${thStyle}" colspan="2">Has At Least 1 Agent Message</th>
        </tr>
        <tr>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#fff">
          <td style="${tdBase};text-align:center">${t.totalChats}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${t.botCoverageCount} (${formatPercent(t.botCoveragePct)})</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtCountPct(t.fullyBotCount, t.fullyBotPct)}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtCountPct(t.atLeastOneAgentCount, t.atLeastOneAgentPct)}</td>
          ${mtdPendingCell()}
        </tr>
      </tbody>
    </table>`;
}

function renderInitiatorComparisonTable(report: DailyEmailReportData): string {
  const colToday = escapeHtml(report.columnLabelShort);
  const b = report.byConversationEmail;

  function row(label: string, today: typeof b.clientInitiatedToday): string {
    return `
        <tr style="background:#fff">
          <td style="${tdBase};font-weight:600">${escapeHtml(label)}</td>
          <td style="${tdBase};text-align:center">${today.totalChats}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtCountPct(today.frustratedByBotCount, today.frustratedByBotPct)}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtCountPct(today.frustratedByAgentCount, today.frustratedByAgentPct)}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtCountPct(today.confusedByBotCount, today.confusedByBotPct)}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtCountPct(today.confusedByAgentCount, today.confusedByAgentPct)}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtScore(today.agentScoreAvg)}</td>
          ${mtdPendingCell()}
          <td style="${tdBase};text-align:center">${fmtAvgAgentResponseSeconds(today.averageAgentResponseTimeSeconds)}</td>
          ${mtdPendingCell()}
        </tr>`;
  }

  return `
    <div style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#2c3e50;font-family:${font}">By initiator (By Conversation)</div>
    <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:1080px;margin:0 0 24px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;" cellspacing="0" cellpadding="0">
      <thead>
        <tr>
          <th style="${thLeft}" rowspan="2">Initiator</th>
          <th style="${thStyle}" colspan="2">Total Chats</th>
          <th style="${thStyle}" colspan="2">Frustrated By Bot</th>
          <th style="${thStyle}" colspan="2">Frustrated By Agent</th>
          <th style="${thStyle}" colspan="2">Confused By Bot</th>
          <th style="${thStyle}" colspan="2">Confused By Agent</th>
          <th style="${thStyle}" colspan="2">Agent Score (out of 5)</th>
          <th style="${thStyle}" colspan="2">Avg Agent Response Time</th>
        </tr>
        <tr>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
          <th style="${thStyle}">${colToday}</th>
          <th style="${thStyle}">MTD</th>
        </tr>
      </thead>
      <tbody>
        ${row('Client Initiated Chats', b.clientInitiatedToday)}
        ${row('Agent Initiated Chats', b.agentInitiatedToday)}
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
    const pr = `pr d ${r.prospectCc}/${r.prospectMv} mtd ${r.prospectMtdCc}/${r.prospectMtdMv}`;
    const sa = `sa d ${r.salesCc}/${r.salesMv} mtd ${r.salesMtdCc}/${r.salesMtdMv}`;
    const cv = `conv ${r.conversionRate} mtd ${r.conversionRateMtd}`;
    const lm = `LM pr ${r.lmProspectTotalCc}/${r.lmProspectTotalMv} sa ${r.lmSalesTotalCc}/${r.lmSalesTotalMv} cv ${r.lmConversionRate}`;
    return `  ${r.label}: ${pr} | ${sa} | ${cv} | ${lm}`;
  });

  return [
    'PRO Services',
    'Daily Report',
    report.displayDate,
    '',
    '1. Service Overview',
    ...lines,
    `  TOTALS: pr d ${totals.prospectCc}/${totals.prospectMv} mtd ${totals.prospectMtdCc}/${totals.prospectMtdMv} | sa d ${totals.salesCc}/${totals.salesMv} mtd ${totals.salesMtdCc}/${totals.salesMtdMv} | conv ${totals.conversionRate} mtd ${totals.conversionRateMtd} | LM pr ${totals.lmProspectTotalCc}/${totals.lmProspectTotalMv} sa ${totals.lmSalesTotalCc}/${totals.lmSalesTotalMv} cv ${totals.lmConversionRate}`,
    '',
    '2. CSAT & Reply Rate',
    '  (data pending —)',
    '',
    '3. Chat Analysis (By Conversation)',
    `  Overall frustration (people): ${formatPercent(report.chatAnalysis.overallFrustrationPercent)} | confusion: ${formatPercent(report.chatAnalysis.overallConfusionPercent)}`,
    `  See HTML for Bot Coverage and Client vs Agent initiator tables (MTD columns: ${MTD_PENDING_LABEL}).`,
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
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1200px;margin:0 auto;background:#fff;border-radius:8px;overflow:visible;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td style="background:#4472c4;color:#fff;padding:20px 24px;">
              <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;opacity:0.9">PRO Services</div>
              <h1 style="margin:8px 0 4px 0;font-size:26px;font-weight:bold;">Daily Report</h1>
              <div style="font-size:14px;opacity:0.95">${escapeHtml(report.displayDate)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 32px 24px;width:100%;min-width:100%;">
              <!-- keep full table visible in clients that clip narrow layouts -->
              ${sectionTitle('1', 'Service Overview')}
              ${renderServiceOverviewTable(report.prospects.rows, totals, {
                mtdDaysCounted: report.prospects.mtdDaysCounted,
                lmDaysCounted: report.prospects.lmDaysCounted,
              })}
              ${sectionTitle('2', 'CSAT & Reply Rate')}
              ${renderCsatReplyRateTable()}
              ${sectionTitle('3', 'Chat Analysis')}
              ${renderBotCoverageByConversationTable(report)}
              ${renderInitiatorComparisonTable(report)}
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
