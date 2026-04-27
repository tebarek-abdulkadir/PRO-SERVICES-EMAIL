/**
 * n8n Code node — MTD lists of unique conversation IDs where frustration / confusion occurred,
 * split by initiator (Consumer vs Agent), but filtered to only cases where:
 * - frustratedBy === 'agent' (for the frustrated column)
 * - confusedBy === 'agent' (for the confused column)
 *
 * Paste into a Code node (Run Once for All Items). Wire output to Email node: {{ $json.subject }},
 * {{ $json.html }} (HTML), {{ $json.text }} (plain text).
 *
 * Data source: same public blobs as the daily report — chat-analysis/daily/{YYYY-MM-DD}.json
 * (conversationResults). MTD = calendar month through “today” in REPORT_TZ, merged across days
 * with the same merge rule as the main email (latest analysisDate wins; tie-break by richer issues).
 *
 * Unique IDs: each comma-separated token in conversationId is counted separately (merged rows
 * contribute multiple CH… ids).
 *
 * This file is standalone; it does not import or modify n8n-chat-analysis-email-code.js.
 */
const REPORT_TZ = 'Africa/Nairobi';
const BLOB_BASE =
  'https://g3fss0a1hcyfvksn.public.blob.vercel-storage.com/chat-analysis/daily';

const font = 'Segoe UI,Calibri,sans-serif';
const thStyle = `padding:8px 10px;background:#4472c4;color:#fff;font-size:11px;font-weight:600;text-align:center;border:1px solid #bdc3c7;font-family:${font};vertical-align:top`;
const tdBase = `padding:8px 10px;border:1px solid #bdc3c7;font-size:11px;color:#212121;font-family:${font};vertical-align:top;width:25%`;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function norm(s) {
  return (s ?? '').trim().toLowerCase();
}

function isAgentInitiatedBucket(initiator) {
  return norm(initiator) === 'agent';
}

function getDateInTimeZone(now, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) throw new Error(`Unable to derive date in timezone ${timeZone}`);
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

function enumerateDatesInclusive(startIso, endIso) {
  const out = [];
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  let d = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

function firstOfMonth(isoDate) {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Cross-day merge: one row per conversationId; latest analysisDate wins. */
function mergeCrossDayResults(dayRows) {
  const map = new Map();
  for (const row of dayRows) {
    const id = row.conversationId;
    const prev = map.get(id);
    if (!prev) {
      map.set(id, row);
      continue;
    }
    const prevDate = String(prev.analysisDate || '');
    const currDate = String(row.analysisDate || '');
    if (currDate > prevDate) map.set(id, row);
    else if (currDate === prevDate) {
      const prevRich = (prev.mainIssues?.length || 0) + (prev.keyPhrases?.length || 0);
      const currRich = (row.mainIssues?.length || 0) + (row.keyPhrases?.length || 0);
      if (currRich > prevRich) map.set(id, row);
    }
  }
  return Array.from(map.values());
}

function conversationIdTokens(conversationId) {
  return String(conversationId ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fetchBlob(dateStr) {
  const url = `${BLOB_BASE}/${dateStr}.json`;
  try {
    const data = await this.helpers.httpRequest({
      method: 'GET',
      url,
      json: true,
      timeout: 30000,
    });
    return data ?? null;
  } catch (error) {
    const statusCode = error?.statusCode || error?.response?.status;
    if (statusCode === 404) return null;
    return null;
  }
}

function sortedLinesFromSet(set) {
  const arr = Array.from(set).sort();
  if (arr.length === 0) return `<span style="color:#757575">(none)</span>`;
  return arr.map((id) => escapeHtml(id)).join('<br/>');
}

function textBlockFromSet(set, title) {
  const arr = Array.from(set).sort();
  const lines = [`${title} (${arr.length})`, ...arr];
  return lines.join('\n');
}

function renderFourColumnTable(consumerFrByAgent, consumerConfByAgent, agentInitFrByAgent, agentInitConfByAgent) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;table-layout:fixed;max-width:1200px;">
  <thead>
    <tr>
      <th style="${thStyle}">Consumer-initiated &mdash; frustrated by agent<br/><span style="font-weight:400;font-size:10px">(${consumerFrByAgent.size} unique id(s))</span></th>
      <th style="${thStyle}">Consumer-initiated &mdash; confused by agent<br/><span style="font-weight:400;font-size:10px">(${consumerConfByAgent.size} unique id(s))</span></th>
      <th style="${thStyle}">Agent-initiated &mdash; frustrated by agent<br/><span style="font-weight:400;font-size:10px">(${agentInitFrByAgent.size} unique id(s))</span></th>
      <th style="${thStyle}">Agent-initiated &mdash; confused by agent<br/><span style="font-weight:400;font-size:10px">(${agentInitConfByAgent.size} unique id(s))</span></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdBase}">${sortedLinesFromSet(consumerFrByAgent)}</td>
      <td style="${tdBase}">${sortedLinesFromSet(consumerConfByAgent)}</td>
      <td style="${tdBase}">${sortedLinesFromSet(agentInitFrByAgent)}</td>
      <td style="${tdBase}">${sortedLinesFromSet(agentInitConfByAgent)}</td>
    </tr>
  </tbody>
</table>`;
}

async function buildEmail() {
  const now = new Date();
  const reportDate = getDateInTimeZone(now, REPORT_TZ);
  const displayDate = formatDisplayDate(reportDate, REPORT_TZ);
  const mtdDates = enumerateDatesInclusive(firstOfMonth(reportDate), reportDate);

  const mtdRows = [];
  let daysWithBlob = 0;
  for (const d of mtdDates) {
    const j = await fetchBlob.call(this, d);
    if (!j?.conversationResults?.length) continue;
    daysWithBlob += 1;
    for (const row of j.conversationResults) {
      mtdRows.push({ ...row, analysisDate: row.analysisDate || d });
    }
  }

  const mergedMtd = mergeCrossDayResults(mtdRows);

  const consumerFrByAgent = new Set();
  const consumerConfByAgent = new Set();
  const agentInitFrByAgent = new Set();
  const agentInitConfByAgent = new Set();

  for (const r of mergedMtd) {
    const tokens = conversationIdTokens(r.conversationId);
    if (tokens.length === 0) continue;

    const isAgentInitiated = isAgentInitiatedBucket(r.initiator);
    const frustratedByAgent = norm(r.frustratedBy) === 'agent';
    const confusedByAgent = norm(r.confusedBy) === 'agent';

    if (r.frustrated && frustratedByAgent) {
      const target = isAgentInitiated ? agentInitFrByAgent : consumerFrByAgent;
      for (const t of tokens) target.add(t);
    }
    if (r.confused && confusedByAgent) {
      const target = isAgentInitiated ? agentInitConfByAgent : consumerConfByAgent;
      for (const t of tokens) target.add(t);
    }
  }

  const subject = `PRO Services — MTD agent-caused frustration & confusion IDs (${reportDate})`;
  const intro = `<p style="font-family:${font};font-size:13px;color:#212121;line-height:1.5;margin:0 0 12px 0;">
    <strong>Month-to-date</strong> through <strong>${escapeHtml(reportDate)}</strong> (${escapeHtml(REPORT_TZ)}). Columns are split by initiator.
    Lists include only chats where the flag is attributed to <strong>agent</strong> (i.e., <code>frustratedBy</code> or <code>confusedBy</code> equals <code>agent</code>).
    Same public chat blobs as the daily report, merged across days (latest row per stored <code>conversationId</code>).
    Comma-separated ids in a row are split so each <code>CH…</code> token appears at most once per column.
  </p>`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(
    subject
  )}</title></head><body style="margin:0;padding:0;background:#e8eaed;font-family:${font};line-height:1.5;color:#212121;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e8eaed;width:100%;"><tr><td style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1200px;margin:0 auto;background:#fff;border-radius:8px;">
<tr><td style="background:#4472c4;color:#fff;padding:18px 22px;">
  <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;opacity:0.9">PRO Services</div>
  <h1 style="margin:6px 0 4px 0;font-size:20px;font-weight:bold;">MTD agent-caused frustration &amp; confusion — conversation IDs</h1>
  <div style="font-size:13px;opacity:0.95">${escapeHtml(displayDate)}</div>
</td></tr>
<tr><td style="padding:22px;">${intro}${renderFourColumnTable(consumerFrByAgent, consumerConfByAgent, agentInitFrByAgent, agentInitConfByAgent)}
  <p style="font-family:${font};font-size:10px;color:#5f6368;margin:16px 0 0 0;">Days with missing 404 blobs are skipped.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    'PRO Services — MTD agent-caused frustration & confusion conversation IDs',
    displayDate,
    `MTD through ${reportDate} (${REPORT_TZ}). Split by initiator; only *By=agent* included.`,
    '',
    textBlockFromSet(consumerFrByAgent, 'Consumer-initiated — frustrated by agent'),
    '',
    textBlockFromSet(consumerConfByAgent, 'Consumer-initiated — confused by agent'),
    '',
    textBlockFromSet(agentInitFrByAgent, 'Agent-initiated — frustrated by agent'),
    '',
    textBlockFromSet(agentInitConfByAgent, 'Agent-initiated — confused by agent'),
    '',
    'Same merge rules as the main daily email (latest analysisDate per conversationId).',
  ].join('\n');

  return {
    subject,
    html,
    text,
    meta: {
      reportDate,
      mtdCalendarDayCount: mtdDates.length,
      daysWithChatBlob: daysWithBlob,
      mergedRowCount: mergedMtd.length,
      counts: {
        consumerFrustratedByAgentUniqueIds: consumerFrByAgent.size,
        consumerConfusedByAgentUniqueIds: consumerConfByAgent.size,
        agentInitiatedFrustratedByAgentUniqueIds: agentInitFrByAgent.size,
        agentInitiatedConfusedByAgentUniqueIds: agentInitConfByAgent.size,
      },
    },
  };
}

const out = await buildEmail.call(this);
return [{ json: out }];
