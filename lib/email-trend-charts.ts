/**
 * Inline SVG line charts for HTML email (no JS). Font matches bundled Noto Sans in `lib/svg-to-png.ts`.
 */

const FONT = 'Noto Sans, Arial, Helvetica, sans-serif';
const TEXT_FILL = '#1a1a1a';
const MUTED = '#555555';

/** Pixels reserved below chart for x-axis labels (long month names). */
const X_AXIS_PAD = 52;

/** Top margin before plot so titles never overlap lines. */
const PLOT_TOP = 72;
const TITLE_Y = 22;
const SUBTITLE_Y = 50;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

const PRODUCT_COLORS = [
  '#c0392b',
  '#2980b9',
  '#27ae60',
  '#8e44ad',
  '#d35400',
  '#16a085',
  '#34495e',
  '#f39c12',
  '#7f8c8d',
];

export interface ConversionSeriesInput {
  label: string;
  values: (number | null)[];
}

function buildPath(
  values: (number | null)[],
  xAt: (i: number) => number,
  yAt: (v: number) => number
): string {
  let d = '';
  let prev = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined || Number.isNaN(v)) {
      prev = false;
      continue;
    }
    const x = xAt(i);
    const y = yAt(v);
    d += prev ? ` L ${x} ${y}` : ` M ${x} ${y}`;
    prev = true;
  }
  return d.trim();
}

/** e.g. "April 6" (month spelled out). */
function longDateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(d);
}

/** Fewer x labels when text is long to reduce overlap. */
function xLabelStepLong(n: number): number {
  if (n <= 6) return 1;
  if (n <= 12) return 2;
  if (n <= 20) return 3;
  if (n <= 28) return 4;
  return Math.ceil(n / 6);
}

function fmtPct(v: number): string {
  const hasFraction = Math.round(v * 10) !== v * 10;
  return hasFraction ? `${v.toFixed(1)}%` : `${Math.round(v)}%`;
}

const Y_PERCENT_MAX = 100;

function yPercentScale(v: number): number {
  return Math.min(Math.max(v, 0), Y_PERCENT_MAX);
}

export function renderConversionTrendSvg(
  dates: string[],
  series: ConversionSeriesInput[],
  title: string
): string {
  const W = 640;
  const H = 500;
  /** Title only (no subtitle); tighter top than chat chart. */
  const plotTop = 52;
  const padL = 56;
  const padR = 14;
  const padB = X_AXIS_PAD + 8;
  const legendRows = Math.ceil(series.length / 2);
  const legendH = Math.max(76, legendRows * 24 + 12);
  const plotW = W - padL - padR;
  const plotH = H - plotTop - padB - legendH;
  const n = dates.length;

  if (n === 0 || series.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120" viewBox="0 0 ${W} 120" role="img" aria-label="${esc(title)}">
  <text x="16" y="48" font-family="${FONT}" font-size="13" fill="${MUTED}">${esc('No data in this date range.')}</text>
</svg>`;
  }

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => plotTop + plotH - (yPercentScale(v) / Y_PERCENT_MAX) * plotH;

  const gridLines: string[] = [];
  const yLabels: string[] = [];
  for (let p = 0; p <= Y_PERCENT_MAX; p += 5) {
    const y = plotTop + plotH - (p / Y_PERCENT_MAX) * plotH;
    gridLines.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#dddddd" stroke-width="1"/>`
    );
    yLabels.push(
      `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="${TEXT_FILL}" font-family="${FONT}">${p}%</text>`
    );
  }

  const xstep = xLabelStepLong(n);
  const xLabels: string[] = [];
  for (let i = 0; i < n; i += xstep) {
    const lab = longDateLabel(dates[i]);
    xLabels.push(
      `<text x="${xAt(i)}" y="${plotTop + plotH + 16}" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="${FONT}">${esc(lab)}</text>`
    );
  }

  const paths: string[] = [];
  series.forEach((s, idx) => {
    const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
    const path = buildPath(s.values, xAt, yAt);
    if (path) {
      paths.push(
        `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
  });

  /** One row per product (canonical order): 100%–50% band; first date nudged right of Y-axis labels. */
  const FIRST_DATE_STACK_NUDGE = 20;
  const conversionColumnLabels: string[] = [];
  const bandTopPx = yAt(100) + 4;
  const bandBottomPx = yAt(50) - 4;
  const spanPx = bandBottomPx - bandTopPx;
  const slotH = spanPx / series.length;
  for (let i = 0; i < n; i++) {
    const colX = xAt(i) + (i === 0 ? FIRST_DATE_STACK_NUDGE : 0);
    series.forEach((s, idx) => {
      const v = s.values[i];
      const yBaseline = bandTopPx + (idx + 0.5) * slotH + 3;
      const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
      const hasVal = typeof v === 'number' && !Number.isNaN(v);
      const labelText = hasVal ? fmtPct(v) : '\u2014';
      const fill = hasVal ? color : MUTED;
      conversionColumnLabels.push(
        `<text x="${colX}" y="${yBaseline}" text-anchor="middle" font-size="8" font-weight="600" fill="${fill}" font-family="${FONT}">${esc(labelText)}</text>`
      );
    });
  }

  const legendY = plotTop + plotH + 36;
  const legendItems = series.map((s, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const lx = padL + col * 300;
    const ly = legendY + row * 24;
    const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
    return `<g>
  <rect x="${lx}" y="${ly - 10}" width="12" height="12" fill="${color}" stroke="#cccccc" stroke-width="0.5"/>
  <text x="${lx + 18}" y="${ly + 1}" font-size="11" fill="${TEXT_FILL}" font-family="${FONT}">${esc(s.label)}</text>
</g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="${TITLE_Y}" text-anchor="middle" font-size="14" font-weight="700" fill="${TEXT_FILL}" font-family="${FONT}">${esc(title)}</text>
  <line x1="${padL}" y1="${plotTop + plotH}" x2="${padL + plotW}" y2="${plotTop + plotH}" stroke="#888888" stroke-width="1"/>
  <line x1="${padL}" y1="${plotTop}" x2="${padL}" y2="${plotTop + plotH}" stroke="#888888" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${paths.join('\n  ')}
  ${conversionColumnLabels.join('\n  ')}
  ${xLabels.join('\n  ')}
  ${legendItems.join('\n  ')}
</svg>`;
}

export interface ChatRatesTrendSeries {
  label: string;
  values: (number | null)[];
  color: string;
}

/**
 * By Conversation trend: frustration & confusion as % of chats in section, split by initiator (client vs agent)
 * and attribution (agent vs bot/system). Missing days produce gaps in lines.
 */
export function renderChatRatesTrendSvg(
  dates: string[],
  series: ChatRatesTrendSeries[],
  title: string
): string {
  const W = 640;
  /** Extra height for 8 stacked value rows per column (same idea as conversion chart). */
  const H = 600;
  /** Match conversion chart: room for Y-axis % labels without overlapping first column values. */
  const padL = 56;
  const padR = 14;
  const padB = X_AXIS_PAD + 8;
  const legendRows = Math.ceil(Math.max(1, series.length) / 2);
  const legendBlock = Math.max(100, legendRows * 22 + 20);
  const plotW = W - padL - padR;
  const plotH = H - PLOT_TOP - padB - legendBlock;
  const n = dates.length;

  if (n === 0 || series.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120" viewBox="0 0 ${W} 120" role="img" aria-label="${esc(title)}">
  <text x="16" y="48" font-family="${FONT}" font-size="13" fill="${MUTED}">${esc('No data in this date range.')}</text>
</svg>`;
  }

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PLOT_TOP + plotH - (yPercentScale(v) / Y_PERCENT_MAX) * plotH;

  const gridLines: string[] = [];
  const yLabels: string[] = [];
  for (let p = 0; p <= Y_PERCENT_MAX; p += 5) {
    const y = PLOT_TOP + plotH - (p / Y_PERCENT_MAX) * plotH;
    gridLines.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#dddddd" stroke-width="1"/>`
    );
    yLabels.push(
      `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="${TEXT_FILL}" font-family="${FONT}">${p}%</text>`
    );
  }

  const step = xLabelStepLong(n);
  const xLabels: string[] = [];
  for (let i = 0; i < n; i += step) {
    xLabels.push(
      `<text x="${xAt(i)}" y="${PLOT_TOP + plotH + 16}" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="${FONT}">${esc(longDateLabel(dates[i]))}</text>`
    );
  }

  const paths: string[] = [];
  for (const s of series) {
    const path = buildPath(s.values, xAt, yAt);
    if (path) {
      paths.push(
        `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
  }

  /**
   * Per-date stacked % labels in the upper plot band (same pattern as conversion chart).
   * Band spans ~100%→18% on Y so 8 rows fit without crowding; first column nudged right of Y-axis.
   */
  const FIRST_DATE_STACK_NUDGE = 20;
  const bandTopPx = yAt(100) + 4;
  const bandBottomPx = yAt(18) - 4;
  const spanPx = Math.max(bandBottomPx - bandTopPx, series.length * 6);
  const slotH = spanPx / series.length;
  const labelFontPx = series.length >= 8 ? 7 : 8;

  const chatColumnLabels: string[] = [];
  for (let i = 0; i < n; i++) {
    const colX = xAt(i) + (i === 0 ? FIRST_DATE_STACK_NUDGE : 0);
    series.forEach((s, idx) => {
      const v = s.values[i];
      const yBaseline = bandTopPx + (idx + 0.5) * slotH + 2;
      const hasVal = typeof v === 'number' && !Number.isNaN(v);
      const labelText = hasVal ? fmtPct(v) : '\u2014';
      const fill = hasVal ? s.color : MUTED;
      chatColumnLabels.push(
        `<text x="${colX}" y="${yBaseline}" text-anchor="middle" font-size="${labelFontPx}" font-weight="600" fill="${fill}" font-family="${FONT}">${esc(labelText)}</text>`
      );
    });
  }

  const legendY = PLOT_TOP + plotH + 28;
  const legendItems = series.map((s, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const lx = padL + col * 310;
    const ly = legendY + row * 22;
    return `<g>
  <rect x="${lx}" y="${ly - 9}" width="11" height="11" fill="${s.color}" stroke="#cccccc" stroke-width="0.5"/>
  <text x="${lx + 16}" y="${ly + 1}" font-size="9" fill="${TEXT_FILL}" font-family="${FONT}">${esc(s.label)}</text>
</g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="${TITLE_Y}" text-anchor="middle" font-size="14" font-weight="700" fill="${TEXT_FILL}" font-family="${FONT}">${esc(title)}</text>
  <text x="${W / 2}" y="${SUBTITLE_Y}" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="${FONT}">${esc('By Conversation: % of chats in section; client-initiated vs agent-initiated; attribution agent vs bot/system')}</text>
  <line x1="${padL}" y1="${PLOT_TOP + plotH}" x2="${padL + plotW}" y2="${PLOT_TOP + plotH}" stroke="#888888" stroke-width="1"/>
  <line x1="${padL}" y1="${PLOT_TOP}" x2="${padL}" y2="${PLOT_TOP + plotH}" stroke="#888888" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${paths.join('\n  ')}
  ${chatColumnLabels.join('\n  ')}
  ${xLabels.join('\n  ')}
  ${legendItems.join('\n  ')}
</svg>`;
}
