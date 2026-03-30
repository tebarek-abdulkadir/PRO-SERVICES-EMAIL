import type { DailyEmailReportData } from '@/lib/daily-email-report';
import type { EmailReportTableRow } from '@/lib/email-report-layout';

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

function renderProductTable(
  sectionNumber: string,
  sectionTitle: string,
  columnLabel: string,
  rows: EmailReportTableRow[],
  total: number
): string {
  const bodyRows = rows
    .map(
      (row) => `
            <tr>
              <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;line-height:1.4;">${escapeHtml(row.label)}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;line-height:1.4;text-align:center;">${row.count}</td>
            </tr>`
    )
    .join('');

  return `
        <tr>
          <td style="padding:32px 0 16px;">
            <div style="color:#1967d2;font-size:20px;font-weight:700;border-left:4px solid #1967d2;padding-left:10px;line-height:1.4;">
              ${escapeHtml(sectionNumber)}. ${escapeHtml(sectionTitle)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;min-width:600px;border-collapse:collapse;background:#ffffff;font-size:13px;">
              <thead>
                <tr>
                  <th style="background-color:#f8f9fa;color:#202124;font-weight:700;padding:8px 10px;text-align:left;border-bottom:2px solid #e8eaed;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;">Product</th>
                  <th style="background-color:#f8f9fa;color:#202124;font-weight:700;padding:8px 10px;text-align:center;border-bottom:2px solid #e8eaed;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;">${escapeHtml(columnLabel)}</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
                <tr>
                  <td style="padding:8px 10px;border-top:2px solid #e0e0e0;background-color:#f8f9fa;font-weight:700;color:#202124;font-size:13px;"><strong>TOTALS</strong></td>
                  <td style="padding:8px 10px;border-top:2px solid #e0e0e0;background-color:#f8f9fa;font-weight:700;color:#202124;font-size:13px;text-align:center;"><strong>${total}</strong></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>`;
}

function renderChatAnalysisTable(report: DailyEmailReportData): string {
  const col = escapeHtml(report.columnLabelShort);
  const avg = report.chatAnalysis.averageResponseTime
    ? escapeHtml(report.chatAnalysis.averageResponseTime)
    : 'N/A';

  return `
        <tr>
          <td style="padding:32px 0 16px;">
            <div style="color:#1967d2;font-size:20px;font-weight:700;border-left:4px solid #1967d2;padding-left:10px;line-height:1.4;">
              3. Chat Analysis
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;min-width:600px;border-collapse:collapse;background:#ffffff;font-size:13px;">
              <thead>
                <tr>
                  <th style="background-color:#f8f9fa;color:#202124;font-weight:700;padding:8px 10px;text-align:left;border-bottom:2px solid #e8eaed;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;">Metric</th>
                  <th style="background-color:#f8f9fa;color:#202124;font-weight:700;padding:8px 10px;text-align:center;border-bottom:2px solid #e8eaed;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;">${col}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;">Average Response Time</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;text-align:center;">${avg}</td>
                </tr>
                <tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;">Frustration</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;text-align:center;">${escapeHtml(formatPercent(report.chatAnalysis.frustrationPercent))}</td>
                </tr>
                <tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;">Confusion</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#202124;font-size:13px;text-align:center;">${escapeHtml(formatPercent(report.chatAnalysis.confusionPercent))}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>`;
}

export function buildDailyEmailSubject(report: DailyEmailReportData): string {
  return `PRO Services Daily Report - ${report.displayDate}`;
}

export function renderDailyEmailText(report: DailyEmailReportData): string {
  const col = report.columnLabelShort;
  const prospectLines = report.prospects.rows.map((r) => `  ${r.label}: ${r.count}`).join('\n');
  const salesLines = report.sales.rows.map((r) => `  ${r.label}: ${r.count}`).join('\n');

  return [
    'PRO Services',
    'Daily Report',
    report.displayDate,
    '',
    `1. Prospects`,
    prospectLines,
    `  TOTALS: ${report.prospects.total}`,
    '',
    `2. Sales`,
    salesLines,
    `  TOTALS: ${report.sales.total}`,
    '',
    `3. Chat Analysis`,
    `  Metric | ${col}`,
    `  Average Response Time | ${report.chatAnalysis.averageResponseTime || 'N/A'}`,
    `  Frustration | ${formatPercent(report.chatAnalysis.frustrationPercent)}`,
    `  Confusion | ${formatPercent(report.chatAnalysis.confusionPercent)}`,
    '',
    `Generated for ${report.date} (${report.timezone}).`,
  ].join('\n');
}

export function renderDailyEmailHtml(report: DailyEmailReportData): string {
  const subject = escapeHtml(buildDailyEmailSubject(report));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.5;color:#202124;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f7fa;width:100%;">
    <tr>
      <td style="padding:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1200px;margin:0 auto;">
          <tr>
            <td style="padding-bottom:30px;">
              <span style="color:#1967d2;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px;">PRO Services</span>
              <h1 style="margin:0 0 8px 0;font-size:32px;font-weight:700;color:#202124;line-height:1.2;">Daily Report</h1>
              <span style="color:#5f6368;font-size:16px;display:block;margin-top:8px;">${escapeHtml(report.displayDate)}</span>
            </td>
          </tr>
          ${renderProductTable('1', 'Prospects', report.columnLabelShort, report.prospects.rows, report.prospects.total)}
          ${renderProductTable('2', 'Sales', report.columnLabelShort, report.sales.rows, report.sales.total)}
          ${renderChatAnalysisTable(report)}
          <tr>
            <td style="padding-top:24px;font-size:10px;color:#5f6368;font-style:italic;">
              Generated automatically for ${escapeHtml(report.date)} (${escapeHtml(report.timezone)}).
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
