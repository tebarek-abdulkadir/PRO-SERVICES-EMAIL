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
  const padL = 56;
  const padR = 14;
  const padB = X_AXIS_PAD + 8;
  const legendRows = Math.ceil(series.length / 2);
  const legendH = Math.max(76, legendRows * 24 + 12);
  const plotW = W - padL - padR;
  const plotH = H - PLOT_TOP - padB - legendH;
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

  const xstep = xLabelStepLong(n);
  const xLabels: string[] = [];
  for (let i = 0; i < n; i += xstep) {
    const lab = longDateLabel(dates[i]);
    xLabels.push(
      `<text x="${xAt(i)}" y="${PLOT_TOP + plotH + 16}" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="${FONT}">${esc(lab)}</text>`
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

  /**
   * Per date: stack all conversion % in a fixed band between the 100% and 50% grid lines,
   * highest value at the top. Color matches the line (legend); no labels on the lines themselves.
   */
  const conversionColumnLabels: string[] = [];
  const bandTopPx = yAt(100) + 4;
  const bandBottomPx = yAt(50) - 4;
  for (let i = 0; i < n; i++) {
    const entries: { value: number; idx: number }[] = [];
    series.forEach((s, idx) => {
      const v = s.values[i];
      if (v !== null && v !== undefined && !Number.isNaN(v)) {
        entries.push({ value: v, idx });
      }
    });
    if (entries.length === 0) {
      continue;
    }
    entries.sort((a, b) => b.value - a.value);
    const k = entries.length;
    const spanPx = bandBottomPx - bandTopPx;
    const slotH = spanPx / k;
    const cx = xAt(i);
    entries.forEach((e, j) => {
      const yCenter = bandTopPx + (j + 0.5) * slotH;
      const color = PRODUCT_COLORS[e.idx % PRODUCT_COLORS.length];
      const yBaseline = yCenter + 3;
      conversionColumnLabels.push(
        `<text x="${cx}" y="${yBaseline}" text-anchor="middle" font-size="8" font-weight="600" fill="${color}" font-family="${FONT}">${esc(fmtPct(e.value))}</text>`
      );
    });
  }

  const legendY = PLOT_TOP + plotH + 36;
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
  <text x="${W / 2}" y="${SUBTITLE_Y}" text-anchor="middle" font-size="10" fill="${MUTED}" font-family="${FONT}">${esc('Per-date % stacked between 100% and 50% (high→low); colors match lines. Y axis every 5%.')}</text>
  <line x1="${padL}" y1="${PLOT_TOP + plotH}" x2="${padL + plotW}" y2="${PLOT_TOP + plotH}" stroke="#888888" stroke-width="1"/>
  <line x1="${padL}" y1="${PLOT_TOP}" x2="${padL}" y2="${PLOT_TOP + plotH}" stroke="#888888" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${paths.join('\n  ')}
  ${conversionColumnLabels.join('\n  ')}
  ${xLabels.join('\n  ')}
  ${legendItems.join('\n  ')}
</svg>`;
}

export function renderChatRatesTrendSvg(
  dates: string[],
  frustration: (number | null)[],
  confusion: (number | null)[],
  title: string
): string {
  const W = 640;
  const H = 420;
  const padL = 58;
  const padR = 14;
  const padB = X_AXIS_PAD + 8;
  const legendBlock = 44;
  const plotW = W - padL - padR;
  const plotH = H - PLOT_TOP - padB - legendBlock;
  const n = dates.length;

  if (n === 0) {
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

  const pathFr = buildPath(frustration, xAt, yAt);
  const pathCf = buildPath(confusion, xAt, yAt);

  const lines: string[] = [];
  if (pathFr) {
    lines.push(
      `<path d="${pathFr}" fill="none" stroke="#e74c3c" stroke-width="2.5" stroke-linecap="round"/>`
    );
  }
  if (pathCf) {
    lines.push(
      `<path d="${pathCf}" fill="none" stroke="#3498db" stroke-width="2.5" stroke-linecap="round"/>`
    );
  }

  const pointLabels: string[] = [];
  const showPointLabels = n <= 12;
  if (showPointLabels) {
    for (let i = 0; i < n; i++) {
      const fr = frustration[i];
      if (fr !== null && fr !== undefined && !Number.isNaN(fr)) {
        const cx = xAt(i);
        const cy = yAt(fr);
        pointLabels.push(
          `<text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="8" font-weight="600" fill="#c0392b" font-family="${FONT}">${esc(fmtPct(fr))}</text>`
        );
      }
    }
    for (let i = 0; i < n; i++) {
      const cf = confusion[i];
      if (cf !== null && cf !== undefined && !Number.isNaN(cf)) {
        const cx = xAt(i);
        const cy = yAt(cf);
        pointLabels.push(
          `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="8" font-weight="600" fill="#2471a3" font-family="${FONT}">${esc(fmtPct(cf))}</text>`
        );
      }
    }
  }

  const legendY = PLOT_TOP + plotH + 34;
  const leg = `<g>
  <rect x="${padL}" y="${legendY - 10}" width="12" height="12" fill="#e74c3c" stroke="#cccccc" stroke-width="0.5"/>
  <text x="${padL + 18}" y="${legendY + 1}" font-size="12" font-weight="600" fill="${TEXT_FILL}" font-family="${FONT}">Frustration rate</text>
  <rect x="${padL + 200}" y="${legendY - 10}" width="12" height="12" fill="#3498db" stroke="#cccccc" stroke-width="0.5"/>
  <text x="${padL + 218}" y="${legendY + 1}" font-size="12" font-weight="600" fill="${TEXT_FILL}" font-family="${FONT}">Confusion rate</text>
</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="${TITLE_Y}" text-anchor="middle" font-size="14" font-weight="700" fill="${TEXT_FILL}" font-family="${FONT}">${esc(title)}</text>
  <text x="${W / 2}" y="${SUBTITLE_Y}" text-anchor="middle" font-size="10" fill="${MUTED}" font-family="${FONT}">${esc('Y axis: percent (0–100%), every 5%')}</text>
  <line x1="${padL}" y1="${PLOT_TOP + plotH}" x2="${padL + plotW}" y2="${PLOT_TOP + plotH}" stroke="#888888" stroke-width="1"/>
  <line x1="${padL}" y1="${PLOT_TOP}" x2="${padL}" y2="${PLOT_TOP + plotH}" stroke="#888888" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${lines.join('\n  ')}
  ${pointLabels.join('\n  ')}
  ${xLabels.join('\n  ')}
  ${leg}
</svg>`;
}
