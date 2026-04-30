  /**
   * n8n Code node — PRO Services Daily Report: Section 1 (Service Overview) + Section 2 (Chat Analysis).
   * Paste into a Code node (Run Once for All Items). Output: { subject, html, text }.
   * Chat: .../chat-analysis/daily/{YYYY-MM-DD}.json
   * Evals: .../evals/daily/{YYYY-MM-DD}.json (summary + conversations; aligns with lib/evals-summary.ts).
   * Prospects: .../daily/{YYYY-MM-DD}.json (ProcessedConversation — lib/storage.ts).
   * Complaints: .../complaints-daily/{YYYY-MM-DD}.json — aligned with lib/prospects-report.ts + complaints-conversion-service.ts.
  * Operations: .../operations/{YYYY-MM-DD}.json — Operations Summary table (same report day as this email).
   *
   * Blob store: paths after …vercel-storage.com are unchanged. ISO dates strictly before BLOB_STORE_CUTOFF_ISO use
   * the legacy host; cutoff day and later use the new host (MTD / last month automatically mix per-day URLs).
   */
  const REPORT_TZ = 'Africa/Nairobi';
  /** YYYY-MM-DD (UTC calendar): this day and after → BLOB_HOST_CURRENT; all prior days → BLOB_HOST_LEGACY. */
  const BLOB_STORE_CUTOFF_ISO = '2026-04-27';
  const BLOB_HOST_LEGACY = 'https://g3fss0a1hcyfvksn.public.blob.vercel-storage.com';
  const BLOB_HOST_CURRENT = 'https://jz7dbscl8dj75bnv.public.blob.vercel-storage.com';

  function blobHostForIsoDate(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return BLOB_HOST_CURRENT;
    return dateStr < BLOB_STORE_CUTOFF_ISO ? BLOB_HOST_LEGACY : BLOB_HOST_CURRENT;
  }

  /** pathSuffix e.g. 'evals/daily' → {host}/evals/daily/{dateStr}.json with host chosen from dateStr. */
  function blobJsonUrl(dateStr, pathSuffix) {
    const tail = String(pathSuffix).replace(/^\/+|\/+$/g, '');
    return `${blobHostForIsoDate(dateStr)}/${tail}/${dateStr}.json`;
  }

  /** How far back to fetch complaint JSON files (each day one GET) for “complaints before date” filtering. */
  const COMPLAINT_BLOB_LOOKBACK_DAYS = 120;

  const BOT_TOKENS = ['GPT_VBC_SALES', 'GPT_PRO_SERVICES', 'VBC_ROUTING_BOT'];
  const AGENT_TOKENS = ['VBC_SALES_AGENTS', 'PRO_SERVICES_AGENTS', 'VBC_RESOLVERS_AGENTS'];

  const font = 'Segoe UI,Calibri,sans-serif';
  const thStyle = `padding:8px 10px;background:#4472c4;color:#fff;font-size:11px;font-weight:600;text-align:center;border:1px solid #bdc3c7;font-family:${font}`;
  const thLeft = `padding:8px 10px;background:#4472c4;color:#fff;font-size:11px;font-weight:600;text-align:left;border:1px solid #bdc3c7;font-family:${font}`;
  const tdBase = `padding:8px 10px;border:1px solid #bdc3c7;font-size:12px;color:#212121;font-family:${font}`;
  const EM = '&#8212;';

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  function formatPercent(value) { const hasFraction = Math.round(value) !== value; return `${value.toFixed(hasFraction ? 1 : 0)}%`; }
  function fmtCountPct(count, pctVal) { return `${count} (${formatPercent(pctVal)})`; }
  function norm(s) { return (s ?? '').trim().toLowerCase(); }
  function joinedSkillsFromRow(r) { return String(r.joinedSkills || r.skill || ''); }
  function joinedSkillsIndicatesBot(js) { const u = joinedSkillsFromRow({ joinedSkills: js }).toUpperCase(); return BOT_TOKENS.some((t) => u.includes(t)); }
  function joinedSkillsIndicatesAgent(js) { const u = joinedSkillsFromRow({ joinedSkills: js }).toUpperCase(); return AGENT_TOKENS.some((t) => u.includes(t)); }
  function isAgentInitiatedBucket(initiator) { return norm(initiator) === 'agent'; }

  function parseAgentResponseTimeToSeconds(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const withDays = /^(\d+)\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
    if (withDays) {
      const days = parseInt(withDays[1], 10), h = parseInt(withDays[2], 10), m = parseInt(withDays[3], 10), sec = parseInt(withDays[4], 10);
      if ([days, h, m, sec].some((n) => Number.isNaN(n))) return null;
      return days * 86400 + h * 3600 + m * 60 + sec;
    }
    const timeOnly = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
    if (timeOnly) {
      const h = parseInt(timeOnly[1], 10), m = parseInt(timeOnly[2], 10), sec = parseInt(timeOnly[3], 10);
      if ([h, m, sec].some((n) => Number.isNaN(n))) return null;
      return h * 3600 + m * 60 + sec;
    }
    return null;
  }
  function formatSecondsAsAgentResponseTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0 00:00:00';
    const days = Math.floor(totalSeconds / 86400);
    let rem = totalSeconds % 86400;
    const h = Math.floor(rem / 3600); rem %= 3600;
    const m = Math.floor(rem / 60);
    const sec = Math.floor(rem % 60);
    return `${days} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  function fmtAvgAgentResponseSeconds(n) { if (n == null || Number.isNaN(n)) return EM; return escapeHtml(formatSecondsAsAgentResponseTime(n)); }
  function fmtScore(n) { if (n == null || Number.isNaN(n)) return EM; return n.toFixed(2); }
  function pct(part, whole) { if (whole <= 0) return 0; return Math.round((part / whole) * 100); }

  function dedupeChatConversationResults(results) {
    const deduplicated = results.reduce((acc, conv) => {
      const existing = acc.get(conv.conversationId);
      if (!existing) acc.set(conv.conversationId, conv);
      else {
        const existingHasData = (existing.mainIssues?.length || 0) + (existing.keyPhrases?.length || 0);
        const currentHasData = (conv.mainIssues?.length || 0) + (conv.keyPhrases?.length || 0);
        if (currentHasData > existingHasData) acc.set(conv.conversationId, conv);
        else if (currentHasData === existingHasData) {
          const existingBothFlags = existing.frustrated && existing.confused;
          const currentBothFlags = conv.frustrated && conv.confused;
          if (currentBothFlags && !existingBothFlags) acc.set(conv.conversationId, conv);
        }
      }
      return acc;
    }, new Map());
    return Array.from(deduplicated.values());
  }
  function emptySection() {
    return { totalChats:0, frustrationByAgentCount:0, frustrationByAgentPct:0, frustrationByBotOrSystemCount:0, frustrationByBotOrSystemPct:0, confusionByAgentCount:0, confusionByAgentPct:0, confusionByBotOrSystemCount:0, confusionByBotOrSystemPct:0, agentScoreAvg:null, chatbotCoverageCount:0, chatbotCoveragePct:0, fullyBotCount:0, fullyBotPct:0, atLeastOneAgentMessageCount:0, atLeastOneAgentMessagePct:0, averageAgentResponseTimeSeconds:null };
  }
  function computeSection(rows, opts) {
    const out = { ...emptySection() }, total = rows.length; out.totalChats = total; if (total === 0) return out;
    let frAgent=0, frBot=0, confAgent=0, confBot=0, cov=0, fully=0, agentMsg=0; const scores=[], responseSeconds=[];
    for (const r of rows) {
      if (r.frustrated) { const fb = norm(r.frustratedBy); if (fb === 'agent') frAgent++; else if (fb === 'bot' || fb === 'system') frBot++; }
      if (r.confused) { const cb = norm(r.confusedBy); if (cb === 'agent') confAgent++; else if (cb === 'bot' || cb === 'system') confBot++; }
      if (r.agentScore != null && typeof r.agentScore === 'number' && Number.isFinite(r.agentScore)) scores.push(r.agentScore);
      const rt = parseAgentResponseTimeToSeconds(r.agentResponseTime ?? undefined); if (rt != null) responseSeconds.push(rt);
      if (opts.includeChatbotBlock) {
        const js = joinedSkillsFromRow(r), isBot = joinedSkillsIndicatesBot(js), isAgent = joinedSkillsIndicatesAgent(js);
        if (isBot) cov++; if (isBot && !isAgent) fully++; if (isAgent) agentMsg++;
      }
    }
    out.frustrationByAgentCount = frAgent; out.frustrationByAgentPct = pct(frAgent, total);
    out.frustrationByBotOrSystemCount = frBot; out.frustrationByBotOrSystemPct = pct(frBot, total);
    out.confusionByAgentCount = confAgent; out.confusionByAgentPct = pct(confAgent, total);
    out.confusionByBotOrSystemCount = confBot; out.confusionByBotOrSystemPct = pct(confBot, total);
    if (scores.length > 0) out.agentScoreAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (responseSeconds.length > 0) out.averageAgentResponseTimeSeconds = responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length;
    if (opts.includeChatbotBlock) { out.chatbotCoverageCount = cov; out.chatbotCoveragePct = pct(cov, total); out.fullyBotCount = fully; out.fullyBotPct = pct(fully, total); out.atLeastOneAgentMessageCount = agentMsg; out.atLeastOneAgentMessagePct = pct(agentMsg, total); }
    return out;
  }
  function computeByConversationViewFromResults(results) {
    const deduped = dedupeChatConversationResults(results), consumer = [], agent = [];
    for (const r of deduped) (isAgentInitiatedBucket(r.initiator) ? agent : consumer).push(r);
    return { consumerInitiated: computeSection(consumer, { includeChatbotBlock: true }), agentInitiated: computeSection(agent, { includeChatbotBlock: false }) };
  }
  function consumerBotCoverageSlice(s) { return { totalChats:s.totalChats, botCoverageCount:s.chatbotCoverageCount, botCoveragePct:s.chatbotCoveragePct, fullyBotCount:s.fullyBotCount, fullyBotPct:s.fullyBotPct, atLeastOneAgentCount:s.atLeastOneAgentMessageCount, atLeastOneAgentPct:s.atLeastOneAgentMessagePct }; }
  function initiatorRow(s) { return { totalChats:s.totalChats, frustratedByBotCount:s.frustrationByBotOrSystemCount, frustratedByBotPct:s.frustrationByBotOrSystemPct, frustratedByAgentCount:s.frustrationByAgentCount, frustratedByAgentPct:s.frustrationByAgentPct, confusedByBotCount:s.confusionByBotOrSystemCount, confusedByBotPct:s.confusionByBotOrSystemPct, confusedByAgentCount:s.confusionByAgentCount, confusedByAgentPct:s.confusionByAgentPct, agentScoreAvg:s.agentScoreAvg, averageAgentResponseTimeSeconds:s.averageAgentResponseTimeSeconds }; }
  function mergeCrossDayResults(dayRows) {
    const map = new Map();
    for (const row of dayRows) {
      const id = row.conversationId, prev = map.get(id);
      if (!prev) { map.set(id, row); continue; }
      const prevDate = String(prev.analysisDate || ''), currDate = String(row.analysisDate || '');
      if (currDate > prevDate) map.set(id, row);
      else if (currDate === prevDate) {
        const prevRich = (prev.mainIssues?.length || 0) + (prev.keyPhrases?.length || 0);
        const currRich = (row.mainIssues?.length || 0) + (row.keyPhrases?.length || 0);
        if (currRich > prevRich) map.set(id, row);
      }
    }
    return Array.from(map.values());
  }
  function getDateInTimeZone(now, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' });
    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value, month = parts.find((p) => p.type === 'month')?.value, day = parts.find((p) => p.type === 'day')?.value;
    if (!year || !month || !day) throw new Error(`Unable to derive date in timezone ${timeZone}`);
    return `${year}-${month}-${day}`;
  }
  function formatDisplayDate(date, timeZone) { return new Intl.DateTimeFormat('en-US', { timeZone, weekday:'long', year:'numeric', month:'long', day:'numeric' }).format(new Date(`${date}T12:00:00Z`)); }
  function shortDateColumnLabel(isoDate, timeZone) { return new Intl.DateTimeFormat('en-US', { timeZone, month:'short', day:'numeric' }).format(new Date(`${isoDate}T12:00:00Z`)); }
  function enumerateDatesInclusive(startIso, endIso) {
    const out = []; const [sy, sm, sd] = startIso.split('-').map(Number); const [ey, em, ed] = endIso.split('-').map(Number);
    let d = new Date(Date.UTC(sy, sm - 1, sd)); const end = new Date(Date.UTC(ey, em - 1, ed));
    while (d <= end) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
    return out;
  }
  function firstOfMonth(isoDate) { return `${isoDate.slice(0, 7)}-01`; }

  function pad2(n) { return String(n).padStart(2, '0'); }

  /** Previous calendar month (inclusive start/end) relative to reportDate. */
  function lastMonthRange(reportDate) {
    const [ys, ms] = reportDate.split('-');
    let y = Number(ys);
    let m = Number(ms);
    if (m === 1) {
      y -= 1;
      m = 12;
    } else {
      m -= 1;
    }
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: `${y}-${pad2(m)}-01`, end: `${y}-${pad2(m)}-${pad2(lastDay)}` };
  }

  function lastMonthDateRange(reportDate) {
    const { start, end } = lastMonthRange(reportDate);
    return enumerateDatesInclusive(start, end);
  }

  function addCalendarDays(isoDate, deltaDays) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
    return dt.toISOString().slice(0, 10);
  }

  function maxIsoDate(a, b) {
    return a > b ? a : b;
  }

  /** lib/pnl-complaints-types.ts COMPLAINT_TYPE_MAP (exact keys) + getServiceKeyFromComplaintType */
  const COMPLAINT_TYPE_MAP = {
    'overseas employment certificate': 'oec',
    overseas: 'oec',
    oec: 'oec',
    'contract verification': 'oec',
    'client contract verification': 'oec',
    'maid contract verification': 'oec',
    'client owwa registration': 'owwa',
    'owwa registration': 'owwa',
    owwa: 'owwa',
    'tourist visa to lebanon – single entry': 'ttlSingle',
    'tourist visa to lebanon - single entry': 'ttlSingle',
    'tourist visa to lebanon single entry': 'ttlSingle',
    'tourist visa to lebanon – double entry': 'ttlDouble',
    'tourist visa to lebanon - double entry': 'ttlDouble',
    'tourist visa to lebanon double entry': 'ttlDouble',
    'tourist visa to lebanon – multiple entry': 'ttlMultiple',
    'tourist visa to lebanon - multiple entry': 'ttlMultiple',
    'tourist visa to lebanon multiple entry': 'ttlMultiple',
    'tourist visa to lebanon': 'ttl',
    'travel to lebanon': 'ttl',
    ttl: 'ttl',
    lebanon: 'ttl',
    'tourist visa to egypt – single entry': 'tteSingle',
    'tourist visa to egypt - single entry': 'tteSingle',
    'tourist visa to egypt single entry': 'tteSingle',
    'tourist visa to egypt – double entry': 'tteDouble',
    'tourist visa to egypt - double entry': 'tteDouble',
    'tourist visa to egypt double entry': 'tteDouble',
    'tourist visa to egypt – multiple entry': 'tteMultiple',
    'tourist visa to egypt - multiple entry': 'tteMultiple',
    'tourist visa to egypt multiple entry': 'tteMultiple',
    'tourist visa to egypt': 'tte',
    'travel to egypt': 'tte',
    tte: 'tte',
    egypt: 'tte',
    'tourist visa to jordan': 'ttj',
    'travel to jordan': 'ttj',
    ttj: 'ttj',
    jordan: 'ttj',
    'tourist to jordan': 'ttj',
    'ethiopian passport renewal': 'ethiopianPP',
    'ethiopian pp': 'ethiopianPP',
    'ethiopian pp renewal': 'ethiopianPP',
    'filipina passport renewal': 'filipinaPP',
    'filipina pp': 'filipinaPP',
    'filipina pp renewal': 'filipinaPP',
    'gcc travel': 'gcc',
    gcc: 'gcc',
    'good conduct certificate': 'gcc',
    'good conduct': 'gcc',
    schengen: 'schengen',
    'schengen visa': 'schengen',
    'schengen visa to france': 'schengen',
    'schengen visa to germany': 'schengen',
    'schengen visa to italy': 'schengen',
    'schengen visa to spain': 'schengen',
    'schengen visa to netherlands': 'schengen',
    'schengen to france': 'schengen',
    'schengen to germany': 'schengen',
  };

  function getServiceKeyFromComplaintType(complaintType) {
    if (complaintType == null || typeof complaintType !== 'string') return undefined;
    const normalized = complaintType.toLowerCase().trim();
    if (!normalized) return undefined;
    if (COMPLAINT_TYPE_MAP[normalized]) return COMPLAINT_TYPE_MAP[normalized];
    if (normalized.includes('contract verification') || normalized.includes('contract verif') || normalized.includes('client contract verification')) {
      return 'oec';
    }
    if (normalized.includes('overseas')) return 'oec';
    if (normalized.includes('oec')) return 'oec';
    if (normalized.includes('owwa')) return 'owwa';
    if (normalized.includes('schengen')) return 'schengen';
    if (normalized.includes('lebanon')) {
      if (normalized.includes('single entry') || normalized.includes('single-entry')) return 'ttlSingle';
      if (normalized.includes('double entry') || normalized.includes('double-entry')) return 'ttlDouble';
      if (normalized.includes('multiple entry') || normalized.includes('multiple-entry')) return 'ttlMultiple';
      return 'ttl';
    }
    if (normalized.includes('egypt')) {
      if (normalized.includes('single entry') || normalized.includes('single-entry')) return 'tteSingle';
      if (normalized.includes('double entry') || normalized.includes('double-entry')) return 'tteDouble';
      if (normalized.includes('multiple entry') || normalized.includes('multiple-entry')) return 'tteMultiple';
      return 'tte';
    }
    if (normalized.includes('jordan')) return 'ttj';
    if (normalized.includes('ethiopian') && normalized.includes('passport')) return 'ethiopianPP';
    if (normalized.includes('filipina') && normalized.includes('passport')) return 'filipinaPP';
    if (normalized.includes('gcc') || normalized.includes('good conduct')) return 'gcc';
    return undefined;
  }

  const TRAVEL_COMPLAINT_SERVICE_KEYS = new Set([
    'ttl',
    'ttlSingle',
    'ttlDouble',
    'ttlMultiple',
    'tte',
    'tteSingle',
    'tteDouble',
    'tteMultiple',
    'ttj',
    'schengen',
    'gcc',
  ]);

  function extractComplaintDay(c) {
    if (!c?.creationDate) return null;
    const s = String(c.creationDate).split(/[T ]/)[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  /** lib/complaints-conversion-service.ts */
  function filterProspectsWithoutPreviousComplaints(prospects, complaintsBeforeDate) {
    const prospectsWithComplaints = new Set();
    for (const complaint of complaintsBeforeDate) {
      if (complaint.contractId) prospectsWithComplaints.add(`contract:${complaint.contractId}`);
      if (complaint.housemaidId) prospectsWithComplaints.add(`maid:${complaint.housemaidId}`);
      if (complaint.clientId) prospectsWithComplaints.add(`client:${complaint.clientId}`);
    }
    return prospects.filter((prospect) => {
      const hasComplaint =
        (prospect.contractId && prospectsWithComplaints.has(`contract:${prospect.contractId}`)) ||
        (prospect.maidId && prospectsWithComplaints.has(`maid:${prospect.maidId}`)) ||
        (prospect.clientId && prospectsWithComplaints.has(`client:${prospect.clientId}`));
      return !hasComplaint;
    });
  }

  function prospectTripleFromRow(r) {
    return {
      contractId: r.contractId,
      maidId: r.maidId,
      clientId: r.clientId,
    };
  }

  /** Filter raw daily `results` rows using same keys as getDashboardProspectsData. */
  function filterDailyResultsRows(results, complaintsBeforeSnapshotDate, mergedComplaints) {
    const complaintsBefore = mergedComplaints.filter((c) => {
      const day = extractComplaintDay(c);
      return day && day < complaintsBeforeSnapshotDate;
    });
    const triples = results.map(prospectTripleFromRow);
    const kept = filterProspectsWithoutPreviousComplaints(triples, complaintsBefore);
    const keepSet = new Set(kept.map((t) => JSON.stringify(t)));
    return results.filter((r, i) => keepSet.has(JSON.stringify(triples[i])));
  }

  function householdMembersContractBucket(members) {
    const contractType = members.find((m) => m.contractType)?.contractType || '';
    if (contractType === 'CC') return 'CC';
    if (contractType === 'MV') return 'MV';
    return null;
  }

  /** lib/prospects-report.ts computeEmailSalesCcMvSplit */
  function computeEmailSalesCcMvSplit(prospects, complaints, householdMap) {
    /**
     * IMPORTANT:
     * "Sales out of tracked prospects" must be a subset of total sales.
     * We enforce this by counting sales as the intersection of:
     * - contractIds that appear in prospects for a given service row
     * - contractIds that appear in complaints for that same service row (total sales events)
     */
    const travelRowKeys = [...EMAIL_TRAVEL_REGIONS.map((r) => r.key), VISA_OTHERS_KEY];

    const emptyBuckets = () => ({ cc: new Set(), mv: new Set() });
    const byRowProspect = new Map();
    const byRowTotalSales = new Map();
    const ensure = (m, k) => {
      if (!m.has(k)) m.set(k, emptyBuckets());
      return m.get(k);
    };

    // contractId -> CC/MV derived from its household members
    const contractBucket = new Map();
    for (const [hk, members] of householdMap) {
      const bucket = householdMembersContractBucket(members);
      if (!bucket) continue;
      if (hk && !hk.startsWith('standalone_')) {
        contractBucket.set(hk, bucket);
      }
    }

    const addContractIdToRow = (rowKey, contractId) => {
      if (!contractId) return;
      const bucket = contractBucket.get(contractId);
      if (bucket !== 'CC' && bucket !== 'MV') return;
      const tgt = ensure(byRowProspect, rowKey);
      if (bucket === 'CC') tgt.cc.add(contractId);
      else tgt.mv.add(contractId);
    };

    for (const p of prospects) {
      if (!p || !p.contractId) continue; // subset rule: rely on contractId only
      if (p.isOECProspect) addContractIdToRow('OEC', p.contractId);
      if (p.isOWWAProspect) addContractIdToRow('OWWA', p.contractId);
      if (p.isFilipinaPassportRenewalProspect) addContractIdToRow('Passport Filipina', p.contractId);
      if (p.isEthiopianPassportRenewalProspect) addContractIdToRow('Passport Ethiopian', p.contractId);
      if (p.isTravelVisaProspect) {
        const region = resolveEmailTravelRegionKey(p.travelVisaCountries) || VISA_OTHERS_KEY;
        addContractIdToRow(region, p.contractId);
      }
    }

    const complaintRowKey = (complaintType) => {
      const serviceKey = getServiceKeyFromComplaintType(complaintType);
      if (serviceKey === 'oec') return 'OEC';
      if (serviceKey === 'owwa') return 'OWWA';
      if (serviceKey === 'filipinaPP') return 'Passport Filipina';
      if (serviceKey === 'ethiopianPP') return 'Passport Ethiopian';
      if (serviceKey && TRAVEL_COMPLAINT_SERVICE_KEYS.has(serviceKey)) {
        if (serviceKey === 'ttl') return 'Visa Lebanon';
        if (serviceKey === 'tte') return 'Visa Egypt';
        if (serviceKey === 'ttj') return 'Visa Jordan';
        if (serviceKey === 'schengen') return 'Visa Schengen';
        if (serviceKey === 'visaSaudi') return 'Visa Saudi';
        return VISA_OTHERS_KEY;
      }
      return null;
    };

    for (const c of complaints || []) {
      if (!c || !c.complaintType) continue;
      const rowKey = complaintRowKey(c.complaintType);
      if (!rowKey) continue;
      const contractId = c.contractId;
      if (!contractId) continue; // subset rule: rely on contractId only
      const bucket = contractBucket.get(contractId);
      if (bucket !== 'CC' && bucket !== 'MV') continue;
      const tgt = ensure(byRowTotalSales, rowKey);
      if (bucket === 'CC') tgt.cc.add(contractId);
      else tgt.mv.add(contractId);
    }

    const intersectSize = (a, b) => {
      if (!a || !b) return 0;
      let n = 0;
      for (const x of a) if (b.has(x)) n += 1;
      return n;
    };
    const intersectRow = (rowKey) => {
      const p = byRowProspect.get(rowKey) || emptyBuckets();
      const t = byRowTotalSales.get(rowKey) || emptyBuckets();
      return {
        cc: intersectSize(p.cc, t.cc),
        mv: intersectSize(p.mv, t.mv),
      };
    };

    const travel = {};
    for (const key of travelRowKeys) {
      travel[key] = intersectRow(key);
    }

    return {
      oec: intersectRow('OEC'),
      owwa: intersectRow('OWWA'),
      filipinaPassportRenewal: intersectRow('Passport Filipina'),
      ethiopianPassportRenewal: intersectRow('Passport Ethiopian'),
      travel,
    };
  }

  function eligibleDailyMean(values, excludeZero = false) {
    const nums = [];
    for (const x of values) {
      if (x == null || typeof x !== 'number' || Number.isNaN(x)) continue;
      if (excludeZero && x === 0) continue;
      nums.push(x);
    }
    if (nums.length === 0) return 0;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000;
  }

  /** EU + Schengen non-EU tokens — aligned with lib/eu-member-countries.ts */
  const EU_MEMBER_COUNTRY_ALIAS_TOKENS = [
    'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czech republic', 'czechia', 'czech',
    'denmark', 'estonia', 'finland', 'france', 'germany', 'greece', 'hungary', 'ireland', 'italy',
    'latvia', 'lithuania', 'luxembourg', 'malta', 'netherlands', 'holland', 'poland', 'portugal',
    'romania', 'slovakia', 'slovenia', 'spain', 'sweden',
  ];
  const VISA_SCHENGEN_NON_EU_ALIAS_TOKENS = [
    'schengen', 'turkey', 'türkiye', 'turkiye', 'golden visa', 'golden', 'family visa', 'family', 'gcc', 'g.c.c', 'gulf',
  ];
  /** Schengen matcher tokens (same as former single Schengen row). */
  const SCHENGEN_REGION_ALIASES = [...VISA_SCHENGEN_NON_EU_ALIAS_TOKENS, ...EU_MEMBER_COUNTRY_ALIAS_TOKENS];

  const EMAIL_TRAVEL_REGIONS = [
    { key: 'Visa Lebanon', aliases: ['lebanon'] },
    { key: 'Visa Egypt', aliases: ['egypt'] },
    { key: 'Visa Jordan', aliases: ['jordan'] },
    { key: 'Visa Schengen', aliases: SCHENGEN_REGION_ALIASES },
  ];

  const VISA_OTHERS_KEY = 'Visa Others';

  function tokenMatchesKey(keyNorm, token) {
    const t = token.trim().toLowerCase();
    if (!t) return false;
    return keyNorm === t || keyNorm.includes(t);
  }
  function countryKeyCountsAsVisaSchengen(key) {
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
  function prospectCountriesMatchRegions(countries, aliases) {
    const list = (countries || []).map((c) => norm(c));
    if (list.length === 0) return false;
    return list.some((c) => aliases.some((a) => c === a || c.includes(a)));
  }
  /**
   * Resolution order: Lebanon → Egypt → Jordan → Schengen → Others (any remaining non-unspecified country).
   */
  function resolveEmailTravelRegionKey(travelVisaCountries) {
    const list = (travelVisaCountries || []).map((c) => String(c).trim()).filter((c) => c && norm(c) !== 'unspecified');
    if (list.length === 0) return null;
    if (prospectCountriesMatchRegions(travelVisaCountries, ['lebanon'])) return 'Visa Lebanon';
    if (prospectCountriesMatchRegions(travelVisaCountries, ['egypt'])) return 'Visa Egypt';
    if (prospectCountriesMatchRegions(travelVisaCountries, ['jordan'])) return 'Visa Jordan';
    if (prospectCountriesMatchRegions(travelVisaCountries, SCHENGEN_REGION_ALIASES)) return 'Visa Schengen';
    return VISA_OTHERS_KEY;
  }

  function formatServiceConversionRate(prospectTotal, salesTotal) {
    if (prospectTotal <= 0) return '0%';
    return `${((100 * salesTotal) / prospectTotal).toFixed(1)}%`;
  }

  function matchAliases(key, aliases) {
    const k = norm(key);
    return aliases.some((a) => k === a || k.includes(a));
  }

  function countryKeyMatchesVisaOthers(key) {
    const k = norm(key);
    if (!k || k === 'unspecified') return false;
    if (matchAliases(k, ['lebanon'])) return false;
    if (matchAliases(k, ['egypt'])) return false;
    if (matchAliases(k, ['jordan'])) return false;
    if (countryKeyCountsAsVisaSchengen(key)) return false;
    return true;
  }

  function countryCountsMatching(countryCounts, matchers) {
    let sum = 0;
    for (const [key, count] of Object.entries(countryCounts || {})) {
      if (!key || key.toLowerCase() === 'unspecified') continue;
      if (matchers.some((m) => m(key))) sum += count;
    }
    return sum;
  }

  function householdKeyFromResultsRow(r) {
    return r.contractId || `standalone_${r.id || r.conversationId || 'unknown'}`;
  }

  function buildHouseholdMapFromResults(results) {
    const map = new Map();
    for (const result of results) {
      const hk = householdKeyFromResultsRow(result);
      if (!map.has(hk)) map.set(hk, []);
      map.get(hk).push(result);
    }
    return map;
  }

  /** Travel-visa country counts split by household contract (MV vs CC) — lib/prospects-report.ts */
  function buildCountryCountsByContractType(results) {
    const out = { MV: {}, CC: {} };
    const householdMap = buildHouseholdMapFromResults(results);
    for (const [, members] of householdMap) {
      const hasTravelVisa = members.some((m) => m.isTravelVisaProspect);
      if (!hasTravelVisa) continue;
      const householdCountries = new Set();
      for (const member of members) {
        if (!member.isTravelVisaProspect) continue;
        for (const country of member.travelVisaCountries || []) {
          if (country && country.toLowerCase() !== 'unspecified') householdCountries.add(country);
        }
      }
      const contractType = members.find((m) => m.contractType)?.contractType || '';
      if (contractType !== 'CC' && contractType !== 'MV') continue;
      const bucket = contractType === 'CC' ? out.CC : out.MV;
      for (const country of householdCountries) {
        bucket[country] = (bucket[country] || 0) + 1;
      }
    }
    return out;
  }

  /** lib/email-report-layout.ts — buildServiceOverviewRows */
  function buildServiceOverviewRows(byContractType, countryCountsByContractType, emailSalesCcMv) {
    const mv = countryCountsByContractType.MV;
    const cc = countryCountsByContractType.CC;
    const pLebanonMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['lebanon'])]);
    const pLebanonCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['lebanon'])]);
    const pEgyptMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['egypt'])]);
    const pEgyptCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['egypt'])]);
    const pJordanMv = countryCountsMatching(mv, [(k) => matchAliases(k, ['jordan'])]);
    const pJordanCc = countryCountsMatching(cc, [(k) => matchAliases(k, ['jordan'])]);
    const pOthersMv = countryCountsMatching(mv, [(k) => countryKeyMatchesVisaOthers(k)]);
    const pOthersCc = countryCountsMatching(cc, [(k) => countryKeyMatchesVisaOthers(k)]);
    const pSchengenMv = countryCountsMatching(mv, [(k) => countryKeyCountsAsVisaSchengen(k)]);
    const pSchengenCc = countryCountsMatching(cc, [(k) => countryKeyCountsAsVisaSchengen(k)]);
    const travelSales = emailSalesCcMv.travel;
    const visa = (key) => travelSales[key] ?? { cc: 0, mv: 0 };
    const oecSales = emailSalesCcMv.oec;
    const owwaSales = emailSalesCcMv.owwa;
    const filSales = emailSalesCcMv.filipinaPassportRenewal;
    const ethSales = emailSalesCcMv.ethiopianPassportRenewal;

    const row = (label, prospectCc, prospectMv, salesCc, salesMv) => {
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
      };
    };

    return [
      row('OEC', byContractType.CC.oec, byContractType.MV.oec, oecSales.cc, oecSales.mv),
      row('OWWA', byContractType.CC.owwa, byContractType.MV.owwa, owwaSales.cc, owwaSales.mv),
      row('Visa Lebanon', pLebanonCc, pLebanonMv, visa('Visa Lebanon').cc, visa('Visa Lebanon').mv),
      row('Visa Egypt', pEgyptCc, pEgyptMv, visa('Visa Egypt').cc, visa('Visa Egypt').mv),
      row('Visa Jordan', pJordanCc, pJordanMv, visa('Visa Jordan').cc, visa('Visa Jordan').mv),
      row(VISA_OTHERS_KEY, pOthersCc, pOthersMv, visa(VISA_OTHERS_KEY).cc, visa(VISA_OTHERS_KEY).mv),
      row('Visa Schengen', pSchengenCc, pSchengenMv, visa('Visa Schengen').cc, visa('Visa Schengen').mv),
      row(
        'Passport Filipina',
        byContractType.CC.filipinaPassportRenewal || 0,
        byContractType.MV.filipinaPassportRenewal || 0,
        filSales.cc,
        filSales.mv
      ),
      row(
        'Passport Ethiopian',
        byContractType.CC.ethiopianPassportRenewal || 0,
        byContractType.MV.ethiopianPassportRenewal || 0,
        ethSales.cc,
        ethSales.mv
      ),
    ];
  }

  function buildByContractTypeFromHouseholds(results) {
    const byContractType = {
      CC: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
      MV: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
    };
    const householdMap = buildHouseholdMapFromResults(results);
    for (const [, members] of householdMap) {
      const contractType = members.find((m) => m.contractType)?.contractType || '';
      if (contractType !== 'CC' && contractType !== 'MV') continue;
      const tgt = contractType === 'CC' ? byContractType.CC : byContractType.MV;
      if (members.some((m) => m.isOECProspect)) tgt.oec += 1;
      if (members.some((m) => m.isOWWAProspect)) tgt.owwa += 1;
      if (members.some((m) => m.isTravelVisaProspect)) tgt.travelVisa += 1;
      if (members.some((m) => m.isFilipinaPassportRenewalProspect)) tgt.filipinaPassportRenewal += 1;
      if (members.some((m) => m.isEthiopianPassportRenewalProspect)) tgt.ethiopianPassportRenewal += 1;
    }
    return byContractType;
  }

  /**
   * One day service overview — lib/getDashboardProspectsData: filter prospects by complaints before snapshotDate,
   * then sales from complaints on snapshotDate (computeEmailSalesCcMvSplit).
   */
  function buildServiceOverviewSnapshot(snapshotDate, dailyJson, mergedComplaints) {
    if (!dailyJson || !Array.isArray(dailyJson.results) || dailyJson.results.length === 0) return null;
    const filteredResults = filterDailyResultsRows(dailyJson.results, snapshotDate, mergedComplaints);
    const householdMap = buildHouseholdMapFromResults(filteredResults);
    const byContractType = buildByContractTypeFromHouseholds(filteredResults);
    if (!byContractType?.CC || !byContractType?.MV) return null;
    const ccCt = buildCountryCountsByContractType(filteredResults);
    const complaintsOnDate = mergedComplaints.filter((c) => extractComplaintDay(c) === snapshotDate);
    const emailSalesCcMv = computeEmailSalesCcMvSplit(filteredResults, complaintsOnDate, householdMap);
    return buildServiceOverviewRows(byContractType, ccCt, emailSalesCcMv);
  }

  function sumByLabel(snapshots) {
    const map = new Map();
    if (!snapshots.length) return map;
    const labels = snapshots[0].map((r) => r.label);
    for (const label of labels) {
      let pcc = 0;
      let pmv = 0;
      let scc = 0;
      let smv = 0;
      for (const snap of snapshots) {
        const row = snap.find((r) => r.label === label);
        if (row) {
          pcc += row.prospectCc;
          pmv += row.prospectMv;
          scc += row.salesCc;
          smv += row.salesMv;
        }
      }
      map.set(label, { pcc, pmv, scc, smv });
    }
    return map;
  }

  function dailyValuesForLabel(snapshots, label, pick) {
    const out = [];
    for (const snap of snapshots) {
      const row = snap.find((r) => r.label === label);
      if (!row) continue;
      out.push(pick(row));
    }
    return out;
  }

  function applyPeriodAggregatesToRows(dailyRows, mtdSnapshots, lmSnapshots) {
    const mtdN = mtdSnapshots.length;
    const lmN = lmSnapshots.length;
    const mtdSum = sumByLabel(mtdSnapshots);
    const lmSum = sumByLabel(lmSnapshots);

    const rows = dailyRows.map((row) => {
      const m = mtdSum.get(row.label) ?? { pcc: 0, pmv: 0, scc: 0, smv: 0 };
      const l = lmSum.get(row.label) ?? { pcc: 0, pmv: 0, scc: 0, smv: 0 };

      const prospectMtdCc = m.pcc;
      const prospectMtdMv = m.pmv;
      const salesMtdCc = m.scc;
      const salesMtdMv = m.smv;

      const prospectMtdAvgCc = eligibleDailyMean(dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.prospectCc));
      const prospectMtdAvgMv = eligibleDailyMean(dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.prospectMv));
      const salesMtdAvgCc = eligibleDailyMean(dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.salesCc));
      const salesMtdAvgMv = eligibleDailyMean(dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.salesMv));

      const conversionRateMtd = formatServiceConversionRate(prospectMtdCc + prospectMtdMv, salesMtdCc + salesMtdMv);

      const lmProspectDailyAvgCc = eligibleDailyMean(dailyValuesForLabel(lmSnapshots, row.label, (r) => r.prospectCc));
      const lmProspectDailyAvgMv = eligibleDailyMean(dailyValuesForLabel(lmSnapshots, row.label, (r) => r.prospectMv));
      const lmSalesDailyAvgCc = eligibleDailyMean(dailyValuesForLabel(lmSnapshots, row.label, (r) => r.salesCc));
      const lmSalesDailyAvgMv = eligibleDailyMean(dailyValuesForLabel(lmSnapshots, row.label, (r) => r.salesMv));
      const lmConversionRate = formatServiceConversionRate(l.pcc + l.pmv, l.scc + l.smv);

      return {
        ...row,
        prospectMtdCc,
        prospectMtdMv,
        prospectMtdAvgCc,
        prospectMtdAvgMv,
        salesMtdCc,
        salesMtdMv,
        salesMtdAvgCc,
        salesMtdAvgMv,
        conversionRateMtd,
        lmProspectDailyAvgCc,
        lmProspectDailyAvgMv,
        lmSalesDailyAvgCc,
        lmSalesDailyAvgMv,
        lmProspectTotalCc: l.pcc,
        lmProspectTotalMv: l.pmv,
        lmSalesTotalCc: l.scc,
        lmSalesTotalMv: l.smv,
        lmConversionRate,
      };
    });

    return { rows, mtdDaysCounted: mtdN, lmDaysCounted: lmN };
  }

  function computeExtendedTotalsRow(rows, mtdSnapshots, lmSnapshots) {
    let prospectCc = 0;
    let prospectMv = 0;
    let prospectMtdCc = 0;
    let prospectMtdMv = 0;
    let salesCc = 0;
    let salesMv = 0;
    let salesMtdCc = 0;
    let salesMtdMv = 0;

    for (const r of rows) {
      prospectCc += r.prospectCc;
      prospectMv += r.prospectMv;
      prospectMtdCc += r.prospectMtdCc;
      prospectMtdMv += r.prospectMtdMv;
      salesCc += r.salesCc;
      salesMv += r.salesMv;
      salesMtdCc += r.salesMtdCc;
      salesMtdMv += r.salesMtdMv;
    }

    const dailyGrandPcc = mtdSnapshots.map((snap) => snap.reduce((s, r) => s + r.prospectCc, 0));
    const dailyGrandPmv = mtdSnapshots.map((snap) => snap.reduce((s, r) => s + r.prospectMv, 0));
    const dailyGrandScc = mtdSnapshots.map((snap) => snap.reduce((s, r) => s + r.salesCc, 0));
    const dailyGrandSmv = mtdSnapshots.map((snap) => snap.reduce((s, r) => s + r.salesMv, 0));

    const prospectMtdAvgCc = eligibleDailyMean(dailyGrandPcc);
    const prospectMtdAvgMv = eligibleDailyMean(dailyGrandPmv);
    const salesMtdAvgCc = eligibleDailyMean(dailyGrandScc);
    const salesMtdAvgMv = eligibleDailyMean(dailyGrandSmv);

    const pt = prospectCc + prospectMv;
    const st = salesCc + salesMv;
    const conversionRate = formatServiceConversionRate(pt, st);
    const conversionRateMtd = formatServiceConversionRate(prospectMtdCc + prospectMtdMv, salesMtdCc + salesMtdMv);

    let lmProsSum = 0;
    let lmSalSum = 0;
    const lmDailyPcc = [];
    const lmDailyPmv = [];
    const lmDailyScc = [];
    const lmDailySmv = [];
    if (lmSnapshots.length > 0) {
      for (const snap of lmSnapshots) {
        let dayPcc = 0;
        let dayPmv = 0;
        let dayScc = 0;
        let daySmv = 0;
        for (const r of snap) {
          dayPcc += r.prospectCc;
          dayPmv += r.prospectMv;
          dayScc += r.salesCc;
          daySmv += r.salesMv;
        }
        lmDailyPcc.push(dayPcc);
        lmDailyPmv.push(dayPmv);
        lmDailyScc.push(dayScc);
        lmDailySmv.push(daySmv);
        lmProsSum += dayPcc + dayPmv;
        lmSalSum += dayScc + daySmv;
      }
    }
    const lmProspectDailyAvgCc = eligibleDailyMean(lmDailyPcc);
    const lmProspectDailyAvgMv = eligibleDailyMean(lmDailyPmv);
    const lmSalesDailyAvgCc = eligibleDailyMean(lmDailyScc);
    const lmSalesDailyAvgMv = eligibleDailyMean(lmDailySmv);
    const lmConversionRate = formatServiceConversionRate(lmProsSum, lmSalSum);

    let lmProspectTotalCc = 0;
    let lmProspectTotalMv = 0;
    let lmSalesTotalCc = 0;
    let lmSalesTotalMv = 0;
    for (const r of rows) {
      lmProspectTotalCc += r.lmProspectTotalCc;
      lmProspectTotalMv += r.lmProspectTotalMv;
      lmSalesTotalCc += r.lmSalesTotalCc;
      lmSalesTotalMv += r.lmSalesTotalMv;
    }

    return {
      label: 'TOTALS',
      prospectCc,
      prospectMv,
      prospectMtdCc,
      prospectMtdMv,
      prospectMtdAvgCc,
      prospectMtdAvgMv,
      salesCc,
      salesMv,
      salesMtdCc,
      salesMtdMv,
      salesMtdAvgCc,
      salesMtdAvgMv,
      conversionRate,
      conversionRateMtd,
      lmProspectDailyAvgCc,
      lmProspectDailyAvgMv,
      lmSalesDailyAvgCc,
      lmSalesDailyAvgMv,
      lmProspectTotalCc,
      lmProspectTotalMv,
      lmSalesTotalCc,
      lmSalesTotalMv,
      lmConversionRate,
    };
  }

  function extractDayFromRow(r) {
    const a = r.analysisDate;
    if (a == null) return null;
    const m = String(a).match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : null;
  }

  /** Day eligible for frustration MTD: no frustrated rows, or every frustrated row has frustratedBy present in JSON */
  function dayEligibleFrustratedBy(rows) {
    const fr = rows.filter((x) => x.frustrated);
    if (fr.length === 0) return true;
    return fr.every((x) => Object.prototype.hasOwnProperty.call(x, 'frustratedBy'));
  }
  /** Day eligible for confusion MTD */
  function dayEligibleConfusedBy(rows) {
    const c = rows.filter((x) => x.confused);
    if (c.length === 0) return true;
    return c.every((x) => Object.prototype.hasOwnProperty.call(x, 'confusedBy'));
  }
  function dayEligibleAgentScore(rows) {
    return rows.some((x) => Object.prototype.hasOwnProperty.call(x, 'agentScore'));
  }
  function dayEligibleResponseTime(rows) {
    return rows.some((x) => parseAgentResponseTimeToSeconds(x.agentResponseTime ?? undefined) != null);
  }

  /** Bot coverage MTD: day counts only if every consumer row has joinedSkills or skill in JSON (so coverage is defined). */
  function dayEligibleJoinedSkillsConsumer(consumerRows) {
    if (consumerRows.length === 0) return true;
    return consumerRows.every(
      (r) =>
        Object.prototype.hasOwnProperty.call(r, 'joinedSkills') || Object.prototype.hasOwnProperty.call(r, 'skill')
    );
  }

  /**
   * MTD initiator metrics: only rows whose calendar day is eligible for that metric; each metric uses its own denominator (pool size).
   */
  function buildMtdInitiatorMetrics(rows, eligFr, eligConf, eligScore, eligRt) {
    const dayOf = (r) => extractDayFromRow(r) || '';

    const poolFr = rows.filter((r) => eligFr[dayOf(r)] === true);
    let frBot = 0, frAg = 0;
    for (const r of poolFr) {
      if (!r.frustrated) continue;
      const fb = norm(r.frustratedBy);
      if (fb === 'agent') frAg++;
      else if (fb === 'bot' || fb === 'system') frBot++;
    }
    const denFr = poolFr.length;

    const poolConf = rows.filter((r) => eligConf[dayOf(r)] === true);
    let cBot = 0, cAg = 0;
    for (const r of poolConf) {
      if (!r.confused) continue;
      const cb = norm(r.confusedBy);
      if (cb === 'agent') cAg++;
      else if (cb === 'bot' || cb === 'system') cBot++;
    }
    const denConf = poolConf.length;

    const poolScoreDays = rows.filter((r) => eligScore[dayOf(r)] === true);
    const scored = poolScoreDays.filter((r) => r.agentScore != null && typeof r.agentScore === 'number' && Number.isFinite(r.agentScore));
    const agentScoreAvg = scored.length ? scored.reduce((a, r) => a + r.agentScore, 0) / scored.length : null;

    const poolRtDays = rows.filter((r) => eligRt[dayOf(r)] === true);
    const secs = poolRtDays.map((r) => parseAgentResponseTimeToSeconds(r.agentResponseTime ?? undefined)).filter((s) => s != null);
    const averageAgentResponseTimeSeconds = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null;

    return {
      totalChats: rows.length,
      frustratedByBotCount: frBot,
      frustratedByBotPct: pct(frBot, denFr),
      frustratedByAgentCount: frAg,
      frustratedByAgentPct: pct(frAg, denFr),
      confusedByBotCount: cBot,
      confusedByBotPct: pct(cBot, denConf),
      confusedByAgentCount: cAg,
      confusedByAgentPct: pct(cAg, denConf),
      agentScoreAvg,
      averageAgentResponseTimeSeconds,
    };
  }

  /** MTD bot coverage: consumer rows on days where joinedSkills/skill eligibility holds; one shared denominator for all three bot metrics. */
  function buildMtdBotCoverageMetrics(consumerMergedRows, eligJoined) {
    const dayOf = (r) => extractDayFromRow(r) || '';
    const pool = consumerMergedRows.filter((r) => eligJoined[dayOf(r)] === true);
    const s = computeSection(pool, { includeChatbotBlock: true });
    return consumerBotCoverageSlice(s);
  }

  // --- Evals blob (tool/policy summary; mirrors lib/evals-summary.ts) ---
  function evalsTruthy(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  }
  function evalsAsRecord(x) {
    if (x != null && typeof x === 'object' && !Array.isArray(x)) return x;
    return null;
  }
  function evalsConversationIdTokens(conv) {
    const id = conv.conversationId;
    if (id == null) return [];
    return String(id)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  function evalsAllConversationIdSet(conversations) {
    const set = new Set();
    for (const c of conversations) {
      const r = evalsAsRecord(c);
      if (!r) continue;
      for (const id of evalsConversationIdTokens(r)) set.add(id);
    }
    return set;
  }
  function evalsGetTools(conv) {
    const t = conv.Tools;
    if (!Array.isArray(t)) return [];
    return t.filter((x) => x != null && typeof x === 'object');
  }
  function evalsRowHasWrongTool(conv) {
    if (evalsTruthy(conv.hasWrongToolCall)) return true;
    return evalsGetTools(conv).some((tool) => evalsTruthy(tool.Wrong_tool_call));
  }
  function evalsRowHasNegativeToolResponse(conv) {
    if (evalsTruthy(conv.hasNegativeToolResponse)) return true;
    return evalsGetTools(conv).some((tool) => evalsTruthy(tool.Negative_Tool_Response));
  }
  function evalsRowHasMissedToolCall(conv) {
    if (evalsTruthy(conv.hasMissedToolCall)) return true;
    const m = evalsAsRecord(conv.Missed_tool_call);
    return !!(m && evalsTruthy(m.Missed_tool_call));
  }
  function evalsPolicyArrayLen(conv, key) {
    const a = conv[key];
    return Array.isArray(a) ? a.length : 0;
  }
  function evalsRowHasWrongPolicy(conv) {
    if (evalsTruthy(conv.hasWrongPolicy)) return true;
    return evalsPolicyArrayLen(conv, 'Wrong_Policy') > 0;
  }
  function evalsRowHasMissedPolicy(conv) {
    if (evalsTruthy(conv.hasMissedPolicy)) return true;
    return evalsPolicyArrayLen(conv, 'Missed_Policy') > 0;
  }
  function evalsRowHasUnclearPolicy(conv) {
    if (evalsTruthy(conv.hasUnclearPolicy)) return true;
    return evalsPolicyArrayLen(conv, 'Unclear_Policy') > 0;
  }
  function evalsAddRowIdsToSet(set, conv) {
    for (const id of evalsConversationIdTokens(conv)) set.add(id);
  }
  function evalsPctNum(numerator, denominator) {
    if (!denominator || !Number.isFinite(denominator)) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }
  function computeEvalsSummaryFromConversations(conversations) {
    const allIds = evalsAllConversationIdSet(conversations);
    const uniqueConversationIdCount = allIds.size;
    const conversationRecordCount = conversations.length;
    const totalChatsAnalyzed = uniqueConversationIdCount;
    let totalToolCalls = 0;
    let wrongToolCalls = 0;
    let negativeToolResponses = 0;
    const wrongToolChatIds = new Set();
    const negativeToolChatIds = new Set();
    const missedToolChatIds = new Set();
    const wrongPolicyChatIds = new Set();
    const missedPolicyChatIds = new Set();
    const unclearPolicyChatIds = new Set();
    for (const c of conversations) {
      const conv = evalsAsRecord(c);
      if (!conv) continue;
      const tools = evalsGetTools(conv);
      totalToolCalls += tools.length;
      for (const tool of tools) {
        if (evalsTruthy(tool.Wrong_tool_call)) wrongToolCalls += 1;
        if (evalsTruthy(tool.Negative_Tool_Response)) negativeToolResponses += 1;
      }
      if (evalsRowHasWrongTool(conv)) evalsAddRowIdsToSet(wrongToolChatIds, conv);
      if (evalsRowHasNegativeToolResponse(conv)) evalsAddRowIdsToSet(negativeToolChatIds, conv);
      if (evalsRowHasMissedToolCall(conv)) evalsAddRowIdsToSet(missedToolChatIds, conv);
      if (evalsRowHasWrongPolicy(conv)) evalsAddRowIdsToSet(wrongPolicyChatIds, conv);
      if (evalsRowHasMissedPolicy(conv)) evalsAddRowIdsToSet(missedPolicyChatIds, conv);
      if (evalsRowHasUnclearPolicy(conv)) evalsAddRowIdsToSet(unclearPolicyChatIds, conv);
    }
    const toolEvals = {
      totalChatsAnalyzed,
      totalToolCalls,
      conversationsWithWrongToolCall: wrongToolChatIds.size,
      conversationsWithWrongToolCallPct: evalsPctNum(wrongToolChatIds.size, totalChatsAnalyzed),
      wrongToolCalls,
      wrongToolCallsPct: evalsPctNum(wrongToolCalls, totalToolCalls),
      conversationsWithNegativeToolResponse: negativeToolChatIds.size,
      conversationsWithNegativeToolResponsePct: evalsPctNum(negativeToolChatIds.size, totalChatsAnalyzed),
      negativeToolResponses,
      negativeToolResponsesPct: evalsPctNum(negativeToolResponses, totalToolCalls),
      conversationsWithMissedToolCall: missedToolChatIds.size,
      conversationsWithMissedToolCallPct: evalsPctNum(missedToolChatIds.size, totalChatsAnalyzed),
    };
    const policyEvals = {
      conversationsWithWrongPolicy: wrongPolicyChatIds.size,
      conversationsWithWrongPolicyPct: evalsPctNum(wrongPolicyChatIds.size, totalChatsAnalyzed),
      conversationsWithMissedPolicy: missedPolicyChatIds.size,
      conversationsWithMissedPolicyPct: evalsPctNum(missedPolicyChatIds.size, totalChatsAnalyzed),
      conversationsWithUnclearPolicy: unclearPolicyChatIds.size,
      conversationsWithUnclearPolicyPct: evalsPctNum(unclearPolicyChatIds.size, totalChatsAnalyzed),
    };
    return {
      uniqueConversationIdCount,
      conversationRecordCount,
      toolEvals,
      policyEvals,
      computedAt: new Date().toISOString(),
    };
  }
  function getEvalsDaySummary(doc) {
    if (!doc || typeof doc !== 'object') return null;
    if (doc.summary && doc.summary.toolEvals && doc.summary.policyEvals) return doc.summary;
    if (Array.isArray(doc.conversations) && doc.conversations.length > 0)
      return computeEvalsSummaryFromConversations(doc.conversations);
    return null;
  }
  function evalsMtdSum(mtdSummaries, pick) {
    let sum = 0;
    let n = 0;
    for (const s of mtdSummaries) {
      const v = pick(s);
      if (typeof v === 'number' && Number.isFinite(v)) {
        sum += v;
        n += 1;
      }
    }
    return n ? sum : null;
  }
  /** MTD % = mean of daily percentages; skip days with no chats (denominator 0). Zeros kept when den > 0. */
  function evalsMtdAvgChatPct(mtdSummaries, pickPct) {
    const vals = [];
    for (const s of mtdSummaries) {
      const den = s.toolEvals?.totalChatsAnalyzed;
      if (!(typeof den === 'number' && den > 0)) continue;
      const v = pickPct(s);
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  /** MTD % for tool-level rates: skip days with zero tool calls. */
  function evalsMtdAvgToolPct(mtdSummaries, pickPct) {
    const vals = [];
    for (const s of mtdSummaries) {
      const den = s.toolEvals?.totalToolCalls;
      if (!(typeof den === 'number' && den > 0)) continue;
      const v = pickPct(s);
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  function evalsMtdAvgPolicyPct(mtdSummaries, pickPct) {
    const vals = [];
    for (const s of mtdSummaries) {
      const den = s.uniqueConversationIdCount;
      if (!(typeof den === 'number' && den > 0)) continue;
      const v = pickPct(s);
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  function formatEvalsPctCell(avg) {
    if (avg == null || Number.isNaN(avg)) return EM;
    return formatPercent(Math.round(avg * 10) / 10);
  }
  function renderEvalsSection(colToday, reportDate, todaySummary, mtdSummaries) {
    const hasAny = todaySummary || (mtdSummaries && mtdSummaries.length > 0);
    if (!hasAny) {
      return `<div style="margin:20px 0 0 0;font-family:${font}"><div style="font-size:16px;font-weight:bold;color:#2c3e50;margin:0 0 8px 0;">Evals</div><p style="font-size:12px;color:#5f6368;">No evals data for this period (<code>evals/daily/${escapeHtml(reportDate)}.json</code> missing or empty).</p></div>`;
    }
    const t = todaySummary?.toolEvals;
    const p = todaySummary?.policyEvals;
    const mtd = Array.isArray(mtdSummaries) ? mtdSummaries : [];
    const d1 = t ? String(t.totalChatsAnalyzed) : EM;
    const d2 = t ? String(t.totalToolCalls) : EM;
    const d3 = t ? fmtCountPct(t.conversationsWithWrongToolCall, t.conversationsWithWrongToolCallPct) : EM;
    const d4 = t ? fmtCountPct(t.wrongToolCalls, t.wrongToolCallsPct) : EM;
    const d5 = t ? fmtCountPct(t.conversationsWithNegativeToolResponse, t.conversationsWithNegativeToolResponsePct) : EM;
    const d6 = t ? fmtCountPct(t.negativeToolResponses, t.negativeToolResponsesPct) : EM;
    const d7 = t ? fmtCountPct(t.conversationsWithMissedToolCall, t.conversationsWithMissedToolCallPct) : EM;
    const d8 = p ? fmtCountPct(p.conversationsWithWrongPolicy, p.conversationsWithWrongPolicyPct) : EM;
    const d9 = p ? fmtCountPct(p.conversationsWithMissedPolicy, p.conversationsWithMissedPolicyPct) : EM;
    const d10 = p ? fmtCountPct(p.conversationsWithUnclearPolicy, p.conversationsWithUnclearPolicyPct) : EM;
    const m1 = evalsMtdSum(mtd, (s) => s.toolEvals.totalChatsAnalyzed);
    const m2 = evalsMtdSum(mtd, (s) => s.toolEvals.totalToolCalls);
    const m3 = formatEvalsPctCell(evalsMtdAvgChatPct(mtd, (s) => s.toolEvals.conversationsWithWrongToolCallPct));
    const m4 = formatEvalsPctCell(evalsMtdAvgToolPct(mtd, (s) => s.toolEvals.wrongToolCallsPct));
    const m5 = formatEvalsPctCell(evalsMtdAvgChatPct(mtd, (s) => s.toolEvals.conversationsWithNegativeToolResponsePct));
    const m6 = formatEvalsPctCell(evalsMtdAvgToolPct(mtd, (s) => s.toolEvals.negativeToolResponsesPct));
    const m7 = formatEvalsPctCell(evalsMtdAvgChatPct(mtd, (s) => s.toolEvals.conversationsWithMissedToolCallPct));
    const m8 = formatEvalsPctCell(evalsMtdAvgPolicyPct(mtd, (s) => s.policyEvals.conversationsWithWrongPolicyPct));
    const m9 = formatEvalsPctCell(evalsMtdAvgPolicyPct(mtd, (s) => s.policyEvals.conversationsWithMissedPolicyPct));
    const m10 = formatEvalsPctCell(evalsMtdAvgPolicyPct(mtd, (s) => s.policyEvals.conversationsWithUnclearPolicyPct));
    const row = (label, dailyVal, mtdVal) =>
      `<tr style="background:#fff"><td style="${tdBase}">${escapeHtml(label)}</td><td style="${tdBase};text-align:center">${dailyVal}</td><td style="${tdBase};text-align:center">${mtdVal}</td></tr>`;
    return `<div style="margin:20px 0 0 0;font-family:${font}"><div style="font-size:16px;font-weight:bold;color:#2c3e50;margin:0 0 8px 0;">Evals</div><div style="font-size:11px;color:#5f6368;margin:0 0 8px 0;line-height:1.4;">MTD through report date. Count rows use <strong>sum</strong> of daily values where an evals summary existed. Percentage rows use <strong>mean of daily percentages</strong>, excluding days with no applicable denominator (no unique chats for chat/policy rates; no tool calls for tool-level rates). Days without an evals blob are omitted.</div>
      <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:560px;margin:0 0 8px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;" cellspacing="0" cellpadding="0"><thead><tr>
      <th style="${thLeft}">Metric</th><th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      </tr></thead><tbody>
      ${row('Total chats analyzed (unique conversation IDs)', d1, m1 != null ? String(m1) : EM)}
      ${row('Total tool calls', d2, m2 != null ? String(m2) : EM)}
      ${row('Conversations with wrong tool call', d3, m3)}
      ${row('Wrong tool calls (% of all tool calls)', d4, m4)}
      ${row('Conversations with negative tool response', d5, m5)}
      ${row('Negative tool responses (% of all tool calls)', d6, m6)}
      ${row('Conversations with missed tool call', d7, m7)}
      ${row('Conversations with wrong policy', d8, m8)}
      ${row('Conversations with missed policy', d9, m9)}
      ${row('Conversations with unclear policy', d10, m10)}
      </tbody></table></div>`;
  }

  async function fetchBlob(dateStr) {
    const url = blobJsonUrl(dateStr, 'chat-analysis/daily');
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

  async function fetchEvalsBlob(dateStr) {
    const url = blobJsonUrl(dateStr, 'evals/daily');
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

  async function fetchDailyBlob(dateStr) {
    const url = blobJsonUrl(dateStr, 'daily');
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

  async function fetchComplaintsBlob(dateStr) {
    const url = blobJsonUrl(dateStr, 'complaints-daily');
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

  /** Public blob path operations/{YYYY-MM-DD}.json (same host rules as other blobs). */
  async function fetchOperationsBlob(dateStr) {
    const url = blobJsonUrl(dateStr, 'operations');
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

  function parseOperationsBlobJson(raw) {
    if (!raw) return null;
    if (Array.isArray(raw) && raw[0]?.data?.operations) return raw[0].data;
    if (raw.data?.operations) return raw.data;
    if (Array.isArray(raw.operations)) return raw;
    return null;
  }

  function opsBreakdownLabels(serviceType) {
    const s = String(serviceType || '');
    if (s === 'OEC/CV/OWWA') return { within: '&lt;14 days', exceeded: '&gt;14 days' };
    return { within: '&le;21 days', exceeded: '&gt;21 days' };
  }

  function opsPctOfStarted(part, started) {
    if (!(typeof started === 'number') || started <= 0 || part == null) return null;
    return Math.round((part / started) * 1000) / 10;
  }

  function opsActiveFinishedCell(kind, serviceType, row) {
    if (!row) {
      return `<td style="${tdBase};text-align:center;vertical-align:middle">${EM}</td>`;
    }
    const started = Number(row.started_total) || 0;
    const total = kind === 'active' ? Number(row.active_total) || 0 : Number(row.finished_total) || 0;
    const wi =
      kind === 'active'
        ? Number(row.active_within_threshold) || 0
        : Number(row.finished_within_threshold) || 0;
    const ex =
      kind === 'active'
        ? Number(row.active_exceeded_threshold) || 0
        : Number(row.finished_exceeded_threshold) || 0;
    const p = opsPctOfStarted(total, started);
    const mainLine =
      p != null && Number.isFinite(p) ? `${total} (${formatPercent(p)})` : String(total);
    if (serviceType === '__TOTAL__') {
      return `<td style="${tdBase};text-align:center;vertical-align:middle;padding:6px 8px;">
        <div style="font-weight:600;font-size:12px;">${escapeHtml(mainLine)}</div>
      </td>`;
    }
    const labels = opsBreakdownLabels(serviceType);
    const pWi = opsPctOfStarted(wi, started);
    const pEx = opsPctOfStarted(ex, started);
    const lineWithin =
      pWi != null && Number.isFinite(pWi)
        ? `${labels.within}: ${wi} (${formatPercent(pWi)})`
        : `${labels.within}: ${wi}`;
    const lineExceeded =
      pEx != null && Number.isFinite(pEx)
        ? `${labels.exceeded}: ${ex} (${formatPercent(pEx)})`
        : `${labels.exceeded}: ${ex}`;
    return `<td style="${tdBase};text-align:center;vertical-align:middle;padding:6px 8px;">
      <div style="font-weight:600;font-size:12px;">${escapeHtml(mainLine)}</div>
      <div style="font-size:10px;margin-top:6px;line-height:1.5;text-align:center;">
        <div style="color:#1b5e20;font-weight:500;">${lineWithin}</div>
        <div style="color:#b71c1c;font-weight:500;margin-top:2px;">${lineExceeded}</div>
      </div>
    </td>`;
  }

  function opsStartedCell(row) {
    if (!row) return `<td style="${tdBase};text-align:center">${EM}</td>`;
    return `<td style="${tdBase};text-align:center">${escapeHtml(String(row.started_total ?? 0))}</td>`;
  }

  function renderOperationsSummarySection(opsDoc, operationsBlobDateIso) {
    const ops = opsDoc && Array.isArray(opsDoc.operations) ? opsDoc.operations : null;
    if (!ops || ops.length === 0) {
      return `${sectionTitle('3', 'Operations Summary')}<p style="font-family:${font};font-size:12px;color:#5f6368;">No operations data for <code>operations/${escapeHtml(operationsBlobDateIso)}.json</code> (report date in ${escapeHtml(REPORT_TZ)}).</p>`;
    }
    const byRange = (label) => {
      const m = new Map();
      for (const r of ops) {
        if (r && r.range_label === label && r.service_type) m.set(r.service_type, r);
      }
      return m;
    };
    const m7 = byRange('last7Days');
    const mMtd = byRange('mtd');
    const lastMonthNote = 'New Platform data starts in April';
    const svcSet = new Set();
    for (const r of ops) {
      if ((r.range_label === 'last7Days' || r.range_label === 'mtd') && r.service_type && r.service_type !== '__TOTAL__') {
        svcSet.add(r.service_type);
      }
    }
    const services = [...svcSet].sort((a, b) => a.localeCompare(b));
    if (m7.has('__TOTAL__') || mMtd.has('__TOTAL__')) services.push('__TOTAL__');
    const nRows = services.length;
    const rowspanNote = nRows > 0 ? nRows : 1;
    const sub = `font-size:10px;color:#5f6368;margin:0 0 10px 0;line-height:1.4;`;
    let body = '';
    if (nRows === 0) {
      body = `<tr style="background:#fff;"><td style="${tdBase}" colspan="7">No <code>last7Days</code> or <code>mtd</code> rows in payload.</td><td style="${tdBase};text-align:center;vertical-align:middle;font-size:11px;color:#5f6368;max-width:120px;">${escapeHtml(lastMonthNote)}</td></tr>`;
    } else {
      for (let i = 0; i < services.length; i++) {
        const st = services[i];
        const isTotal = st === '__TOTAL__';
        const r7 = m7.get(st);
        const rM = mMtd.get(st);
        const rowBg = isTotal ? 'background:#d9e2f3;font-weight:600;' : 'background:#fff;';
        const serviceLabel = st === '__TOTAL__' ? 'Total' : st;
        const lmCell =
          i === 0
            ? `<td rowspan="${rowspanNote}" style="${tdBase};text-align:center;vertical-align:middle;font-size:11px;color:#5f6368;max-width:120px;">${escapeHtml(lastMonthNote)}</td>`
            : '';
        body += `<tr style="${rowBg}"><td style="${tdBase};text-align:left">${escapeHtml(serviceLabel)}</td>
        ${opsStartedCell(r7)}
        ${opsActiveFinishedCell('active', st, r7)}
        ${opsActiveFinishedCell('finished', st, r7)}
        ${opsStartedCell(rM)}
        ${opsActiveFinishedCell('active', st, rM)}
        ${opsActiveFinishedCell('finished', st, rM)}
        ${lmCell}</tr>`;
      }
    }
    const headTop = `border:1px solid #bdc3c7;padding:8px 6px;background:#4472c4;color:#fff;font-size:11px;font-weight:600;text-align:center;font-family:${font}`;
    const headSub = `border:1px solid #bdc3c7;padding:6px 4px;background:#5b7fc7;color:#fff;font-size:10px;font-weight:600;text-align:center;font-family:${font}`;
    return `${sectionTitle('3', 'Operations Summary')}
      <p style="font-family:${font};${sub}">Source: operations blob for the <strong>same report date</strong> as this email (<code>operations/${escapeHtml(operationsBlobDateIso)}.json</code> — ${escapeHtml(REPORT_TZ)}).</p>
      <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;margin:0 0 12px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;" cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <th rowspan="2" style="${thLeft}">Service</th>
            <th colspan="3" style="${headTop}">Last 7 days</th>
            <th colspan="3" style="${headTop}">Month to date</th>
            <th rowspan="2" style="${headTop};max-width:130px;">Last month</th>
          </tr>
          <tr>
            <th style="${headSub}">Started</th><th style="${headSub}">Active</th><th style="${headSub}">Finished</th>
            <th style="${headSub}">Started</th><th style="${headSub}">Active</th><th style="${headSub}">Finished</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  /** Merge complaints from each daily file (same as getAllComplaintsBeforeDate input pool). */
  async function loadMergedComplaintsFromBlobRange(startIso, endIso) {
    const dates = enumerateDatesInclusive(startIso, endIso);
    const all = [];
    for (const d of dates) {
      const j = await fetchComplaintsBlob.call(this, d);
      if (j?.complaints?.length) {
        for (const c of j.complaints) all.push(c);
      }
    }
    return all;
  }

  async function loadServiceOverviewSnapshotsForDates(dates, mergedComplaints) {
    const out = [];
    for (const date of dates) {
      const j = await fetchDailyBlob.call(this, date);
      const rows = buildServiceOverviewSnapshot(date, j, mergedComplaints);
      if (rows !== null && rows.length > 0) out.push(rows);
    }
    return out;
  }

  function sectionTitle(num, title) { return `<div style="padding:8px 0 8px 12px;margin:8px 0 12px 0;font-size:16px;font-weight:bold;color:#2c3e50;border-left:4px solid #4472c4;background:#f8f9fa;font-family:${font}">${escapeHtml(num)}. ${escapeHtml(title)}</div>`; }

  function pairCell(todayVal, mtdVal) {
    return `<td style="${tdBase};text-align:center">${todayVal}</td><td style="${tdBase};text-align:center">${mtdVal}</td>`;
  }

  function renderBotCoverage(colToday, cToday, cMtd) {
    const t = {
      tc: cToday.totalChats,
      bc: `${cToday.botCoverageCount} (${formatPercent(cToday.botCoveragePct)})`,
      fb: fmtCountPct(cToday.fullyBotCount, cToday.fullyBotPct),
      ag: fmtCountPct(cToday.atLeastOneAgentCount, cToday.atLeastOneAgentPct),
    };
    const m = {
      bc: `${cMtd.botCoverageCount} (${formatPercent(cMtd.botCoveragePct)})`,
      fb: fmtCountPct(cMtd.fullyBotCount, cMtd.fullyBotPct),
      ag: fmtCountPct(cMtd.atLeastOneAgentCount, cMtd.atLeastOneAgentPct),
    };
    const tdTc = `<td style="${tdBase};text-align:center">${t.tc}</td>`;
    return `<div style="margin:0 0 8px 0;font-family:${font}"><div style="font-size:16px;font-weight:bold;color:#2c3e50;">Bot Coverage</div><div style="font-size:11px;color:#5f6368;margin-top:4px;line-height:1.4;"><span style="font-weight:600;">(Only Client Initiated Chats)</span> - All metrics in this table count only conversations where the initiator is Consumer</div></div>
      <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:720px;margin:0 0 24px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;" cellspacing="0" cellpadding="0"><thead><tr>
      <th style="${thStyle}" colspan="1">Total Chats</th><th style="${thStyle}" colspan="2">Bot Coverage (Bot Involved)</th><th style="${thStyle}" colspan="2">Fully Handled By Bot</th><th style="${thStyle}" colspan="2">Has At Least 1 Agent Message</th></tr><tr>
      <th style="${thStyle}">${escapeHtml(colToday)}</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      </tr></thead><tbody><tr style="background:#fff">${tdTc}${pairCell(t.bc, m.bc)}${pairCell(t.fb, m.fb)}${pairCell(t.ag, m.ag)}</tr></tbody></table>
      <div style="font-size:10px;color:#757575;margin:4px 0 0 0;line-height:1.35;"><strong>Today</strong> = report-day chat blob. <strong>MTD</strong> for bot metrics = merged chat blobs (deduped by conversation id) on days where every consumer row had joinedSkills or skill present. Total Chats has no MTD column. The next table uses separate eligible-day pools per metric for frustration, confusion, score, and response time.</div>`;
  }

  function tdNumCenter(val) {
    return `<td style="${tdBase};text-align:center">${val}</td>`;
  }

  function metricBlockInit(cT, cM) {
    return (
      tdNumCenter(cT.totalChats) +
      pairCell(fmtCountPct(cT.frustratedByBotCount, cT.frustratedByBotPct), fmtCountPct(cM.frustratedByBotCount, cM.frustratedByBotPct)) +
      pairCell(fmtCountPct(cT.frustratedByAgentCount, cT.frustratedByAgentPct), fmtCountPct(cM.frustratedByAgentCount, cM.frustratedByAgentPct)) +
      pairCell(fmtCountPct(cT.confusedByBotCount, cT.confusedByBotPct), fmtCountPct(cM.confusedByBotCount, cM.confusedByBotPct)) +
      pairCell(fmtCountPct(cT.confusedByAgentCount, cT.confusedByAgentPct), fmtCountPct(cM.confusedByAgentCount, cM.confusedByAgentPct)) +
      pairCell(fmtScore(cT.agentScoreAvg), fmtScore(cM.agentScoreAvg))
    );
  }

  function renderInitiatorComparison(colToday, clientT, clientM, agentT, agentM) {
    const pickAvg = (c, a) => c.averageAgentResponseTimeSeconds ?? a.averageAgentResponseTimeSeconds ?? null;
    const avgT = pickAvg(clientT, agentT), avgM = pickAvg(clientM, agentM);
    return `<div style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#2c3e50;font-family:${font}">By initiator (By Conversation)</div>
      <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:1080px;margin:0 0 24px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;" cellspacing="0" cellpadding="0"><thead><tr>
      <th style="${thLeft}" rowspan="2">Initiator</th><th style="${thStyle}" colspan="1">Total Chats</th><th style="${thStyle}" colspan="2">Frustrated By Bot</th><th style="${thStyle}" colspan="2">Frustrated By Agent</th><th style="${thStyle}" colspan="2">Confused By Bot</th><th style="${thStyle}" colspan="2">Confused By Agent</th><th style="${thStyle}" colspan="2">Agent Score (out of 5)</th><th style="${thStyle}" colspan="2">Avg Agent Response Time</th></tr><tr>
      <th style="${thStyle}">${escapeHtml(colToday)}</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      <th style="${thStyle}">${escapeHtml(colToday)}</th><th style="${thStyle}">MTD</th>
      </tr></thead><tbody>
      <tr style="background:#fff"><td style="${tdBase};font-weight:600">${escapeHtml('Client Initiated Chats')}</td>${metricBlockInit(clientT, clientM)}
      <td rowspan="2" style="${tdBase};text-align:center;vertical-align:middle">${fmtAvgAgentResponseSeconds(avgT)}</td>
      <td rowspan="2" style="${tdBase};text-align:center;vertical-align:middle">${fmtAvgAgentResponseSeconds(avgM)}</td></tr>
      <tr style="background:#fff"><td style="${tdBase};font-weight:600">${escapeHtml('Agent Initiated Chats')}</td>${metricBlockInit(agentT, agentM)}</tr>
      </tbody></table>`;
  }

  const tdNum = (extra) => `padding:8px 10px;border:1px solid #bdc3c7;font-size:12px;color:#212121;font-family:${font};text-align:center;${extra}`;

  function serviceOverviewDataCells(row, bold = false) {
    const s = bold ? tdNum('font-weight:bold') : `${tdBase};text-align:center`;
    return `
            <td style="${s}">${row.prospectCc}</td>
            <td style="${s}">${row.prospectMv}</td>
            <td style="${s}">${row.prospectMtdCc}</td>
            <td style="${s}">${row.prospectMtdMv}</td>
            <td style="${s}">${row.lmProspectTotalCc}</td>
            <td style="${s}">${row.lmProspectTotalMv}</td>
            <td style="${s}">${row.salesCc}</td>
            <td style="${s}">${row.salesMv}</td>
            <td style="${s}">${row.salesMtdCc}</td>
            <td style="${s}">${row.salesMtdMv}</td>
            <td style="${s}">${row.lmSalesTotalCc}</td>
            <td style="${s}">${row.lmSalesTotalMv}</td>
            <td style="${s}">${escapeHtml(row.conversionRate)}</td>
            <td style="${s}">${escapeHtml(row.conversionRateMtd)}</td>
            <td style="${s}">${escapeHtml(row.lmConversionRate)}</td>`;
  }

  function renderServiceOverviewTable(rows, totals, periodNote, colToday) {
    const bodyRows = rows
      .map((row, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f9fafb';
        return `
          <tr style="background:${bg}">
            <td style="${tdBase}">${escapeHtml(row.label)}</td>
            ${serviceOverviewDataCells(row)}
          </tr>`;
      })
      .join('');

    const note = periodNote
      ? `<div style="font-size:10px;color:#757575;margin:8px 0 0 0;line-height:1.35;">MTD totals sum days with valid <strong>daily/{date}.json</strong> (${periodNote.mtdDaysCounted} day(s); missing days skipped for all rows). LM uses the prior calendar month (${periodNote.lmDaysCounted} day(s)). Prospects exclude any contract/maid/client with a complaint <em>before</em> that day (from merged <strong>complaints-daily/*.json</strong> in a ${COMPLAINT_BLOB_LOOKBACK_DAYS}-day lookback). Sales match the dashboard: complaint types on that day vs filtered prospects.</div>`
      : '';

    const lmLabel = 'Last month';
    return `
      <table role="presentation" width="100%" style="border:1px solid #bdc3c7;border-collapse:collapse;width:100%;min-width:960px;margin:0 0 24px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;" cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <th style="${thLeft}" rowspan="3">Service Type</th>
            <th style="${thStyle}" colspan="6">Prospect</th>
            <th style="${thStyle}" colspan="6">Sales</th>
            <th style="${thStyle}" colspan="3">Conversion</th>
          </tr>
          <tr>
            <th style="${thStyle}" colspan="2">${escapeHtml(colToday)}</th>
            <th style="${thStyle}" colspan="2">MTD total</th>
            <th style="${thStyle}" colspan="2">${escapeHtml(lmLabel)}</th>
            <th style="${thStyle}" colspan="2">${escapeHtml(colToday)}</th>
            <th style="${thStyle}" colspan="2">MTD total</th>
            <th style="${thStyle}" colspan="2">${escapeHtml(lmLabel)}</th>
            <th style="${thStyle}" rowspan="2">${escapeHtml(colToday)}</th>
            <th style="${thStyle}" rowspan="2">MTD</th>
            <th style="${thStyle}" rowspan="2">${escapeHtml(lmLabel)}</th>
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
            ${serviceOverviewDataCells(totals, true)}
          </tr>
        </tbody>
      </table>
      ${note}`;
  }

  async function buildReport() {
    const now = new Date(), reportDate = getDateInTimeZone(now, REPORT_TZ), displayDate = formatDisplayDate(reportDate, REPORT_TZ), colToday = shortDateColumnLabel(reportDate, REPORT_TZ);
    const todayJson = await fetchBlob.call(this, reportDate);
    if (!todayJson || !Array.isArray(todayJson.conversationResults)) throw new Error(`Missing or invalid chat analysis blob for ${reportDate}`);

    const mtdDates = enumerateDatesInclusive(firstOfMonth(reportDate), reportDate);
    const eligFrConsumer = Object.create(null), eligFrAgent = Object.create(null);
    const eligConfConsumer = Object.create(null), eligConfAgent = Object.create(null);
    const eligScoreConsumer = Object.create(null), eligScoreAgent = Object.create(null);
    const eligRtConsumer = Object.create(null), eligRtAgent = Object.create(null);
    const eligJoinedConsumer = Object.create(null);

    const mtdRows = [];
    for (const d of mtdDates) {
      const j = await fetchBlob.call(this, d);
      if (!j?.conversationResults?.length) continue;
      for (const row of j.conversationResults) {
        mtdRows.push({ ...row, analysisDate: row.analysisDate || d });
      }
      const ded = dedupeChatConversationResults(j.conversationResults);
      const cons = [], ag = [];
      for (const r of ded) (isAgentInitiatedBucket(r.initiator) ? ag : cons).push(r);
      eligFrConsumer[d] = dayEligibleFrustratedBy(cons);
      eligFrAgent[d] = dayEligibleFrustratedBy(ag);
      eligConfConsumer[d] = dayEligibleConfusedBy(cons);
      eligConfAgent[d] = dayEligibleConfusedBy(ag);
      eligScoreConsumer[d] = dayEligibleAgentScore(cons);
      eligScoreAgent[d] = dayEligibleAgentScore(ag);
      eligRtConsumer[d] = dayEligibleResponseTime(cons);
      eligRtAgent[d] = dayEligibleResponseTime(ag);
      eligJoinedConsumer[d] = dayEligibleJoinedSkillsConsumer(cons);
    }

    const mergedMtd = mergeCrossDayResults(mtdRows);
    const viewToday = computeByConversationViewFromResults(todayJson.conversationResults);

    const botToday = consumerBotCoverageSlice(viewToday.consumerInitiated);
    const consMerged = mergedMtd.filter((r) => !isAgentInitiatedBucket(r.initiator));
    const botMtd = buildMtdBotCoverageMetrics(consMerged, eligJoinedConsumer);

    const agMerged = mergedMtd.filter((r) => isAgentInitiatedBucket(r.initiator));

    const cT = initiatorRow(viewToday.consumerInitiated);
    const aT = initiatorRow(viewToday.agentInitiated);
    const cM = buildMtdInitiatorMetrics(consMerged, eligFrConsumer, eligConfConsumer, eligScoreConsumer, eligRtConsumer);
    const aM = buildMtdInitiatorMetrics(agMerged, eligFrAgent, eligConfAgent, eligScoreAgent, eligRtAgent);

    const evalsByDate = new Map();
    for (const d of mtdDates) {
      const ev = await fetchEvalsBlob.call(this, d);
      const s = getEvalsDaySummary(ev);
      if (s) evalsByDate.set(d, s);
    }
    const mtdEvalSummaries = mtdDates.map((d) => evalsByDate.get(d)).filter((s) => s != null);
    const todayEvalSummary = evalsByDate.get(reportDate) ?? null;
    const evalsHtml = renderEvalsSection(colToday, reportDate, todayEvalSummary, mtdEvalSummaries);

    const rawOps = await fetchOperationsBlob.call(this, reportDate);
    const opsDoc = parseOperationsBlobJson(rawOps);
    const operationsHtml = renderOperationsSummarySection(opsDoc, reportDate);

    const complaintFetchStart = maxIsoDate('2018-01-01', addCalendarDays(reportDate, -COMPLAINT_BLOB_LOOKBACK_DAYS));
    const mergedComplaints = await loadMergedComplaintsFromBlobRange.call(this, complaintFetchStart, reportDate);

    const dailyToday = await fetchDailyBlob.call(this, reportDate);
    const todaySvc = buildServiceOverviewSnapshot(reportDate, dailyToday, mergedComplaints);
    const mtdDatesSvc = enumerateDatesInclusive(firstOfMonth(reportDate), reportDate);
    const mtdSnapshotsSvc = await loadServiceOverviewSnapshotsForDates.call(this, mtdDatesSvc, mergedComplaints);
    const lmSnapshotsSvc = await loadServiceOverviewSnapshotsForDates.call(this, lastMonthDateRange(reportDate), mergedComplaints);

    let section1Html = '';
    if (todaySvc) {
      const agg = applyPeriodAggregatesToRows(todaySvc, mtdSnapshotsSvc, lmSnapshotsSvc);
      const totals = computeExtendedTotalsRow(agg.rows, mtdSnapshotsSvc, lmSnapshotsSvc);
      section1Html =
        sectionTitle('1', 'Service Overview') +
        renderServiceOverviewTable(agg.rows, totals, { mtdDaysCounted: agg.mtdDaysCounted, lmDaysCounted: agg.lmDaysCounted }, colToday);
    } else {
      section1Html =
        sectionTitle('1', 'Service Overview') +
        `<p style="font-family:${font};font-size:13px;color:#5f6368;">No valid <strong>daily/${escapeHtml(reportDate)}.json</strong> prospect snapshot for today (missing blob or empty results).</p>`;
    }

    const subject = `PRO Services Daily Report - ${displayDate}`;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#e8eaed;font-family:${font};line-height:1.5;color:#212121;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e8eaed;width:100%;"><tr><td style="padding:24px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1200px;margin:0 auto;background:#fff;border-radius:8px;overflow:visible;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="background:#4472c4;color:#fff;padding:20px 24px;"><div style="font-size:11px;font-weight:600;letter-spacing:0.5px;opacity:0.9">PRO Services</div><h1 style="margin:8px 0 4px 0;font-size:26px;font-weight:bold;">Daily Report</h1><div style="font-size:14px;opacity:0.95">${escapeHtml(displayDate)}</div></td></tr><tr><td style="padding:24px 24px 32px 24px;width:100%;min-width:100%;">${section1Html}${sectionTitle('2', 'Chat Analysis')}${renderBotCoverage(colToday, botToday, botMtd)}${renderInitiatorComparison(colToday, cT, cM, aT, aM)}${evalsHtml}${operationsHtml}<div style="margin-top:20px;font-size:10px;color:#5f6368;font-style:italic;">Generated automatically for ${escapeHtml(reportDate)} (${escapeHtml(REPORT_TZ)}).</div></td></tr></table></td></tr></table></body></html>`;
    const text = [
      'PRO Services',
      'Daily Report',
      displayDate,
      '',
      '1. Service Overview — prospects from daily/{date}.json; prior-complaint filter + sales from complaints-daily/*.json (see HTML).',
      '2. Chat Analysis — Bot Coverage, By initiator, and Evals (see HTML table; evals/daily blobs).',
      '3. Operations Summary — from operations/{date}.json (see HTML).',
      '',
      `Generated for ${reportDate} (${REPORT_TZ}).`,
    ].join('\n');
    return { subject, html, text };
  }

  const r = await buildReport.call(this);
  return [{ json: r }];
