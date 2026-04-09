/**
 * Inline SVG line charts for HTML email (no JS). Text uses Arial — Resvg rasterizes it reliably with loadSystemFonts: false.
 */

const FONT = 'Arial, Helvetica, sans-serif';
const TEXT_FILL = '#1a1a1a';
const MUTED = '#555555';

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

function ceilToStep(n: number, step: number): number {
  if (n <= 0) return step;
  return Math.ceil(n / step) * step;
}

/** Y-axis max and step (5 or 10) so tick count stays readable */
function conversionYScale(ymax: number): { yTop: number; step: number } {
  if (ymax <= 0) return { yTop: 5, step: 5 };
  const rough = ceilToStep(ymax, 5);
  const numTicks = rough / 5 + 1;
  if (numTicks > 16) {
    const yTop = ceilToStep(ymax, 10);
    return { yTop: Math.max(yTop, 10), step: 10 };
  }
  return { yTop: Math.max(rough, 5), step: 5 };
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

function xLabelStep(n: number): number {
  if (n <= 8) return 1;
  if (n <= 16) return 2;
  if (n <= 31) return 3;
  return Math.ceil(n / 12);
}

function shortDateLabel(iso: string): string {
  const [, m, day] = iso.split('-');
  return `${Number(m)}/${Number(day)}`;
}

function fmtCount(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function fmtPct(v: number): string {
  const hasFraction = Math.round(v * 10) !== v * 10;
  return hasFraction ? `${v.toFixed(1)}%` : `${Math.round(v)}%`;
}

export function renderConversionTrendSvg(
  dates: string[],
  series: ConversionSeriesInput[],
  title: string
): string {
  const W = 640;
  const H = 480;
  const padL = 56;
  const padR = 14;
  const padT = 40;
  const padB = 100;
  const legendRows = Math.ceil(series.length / 2);
  const legendH = Math.max(72, legendRows * 22 + 16);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB - legendH;
  const n = dates.length;

  if (n === 0 || series.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120" viewBox="0 0 ${W} 120" role="img" aria-label="${esc(title)}">
  <text x="16" y="48" font-family="${FONT}" font-size="13" fill="${MUTED}">${esc('No data in this date range.')}</text>
</svg>`;
  }

  let ymax = 0;
  for (const s of series) {
    for (const v of s.values) {
      if (v !== null && v !== undefined && !Number.isNaN(v)) ymax = Math.max(ymax, v);
    }
  }
  const { yTop, step } = conversionYScale(ymax);
  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / yTop) * plotH;

  const gridLines: string[] = [];
  const yLabels: string[] = [];
  for (let val = 0; val <= yTop + 0.001; val += step) {
    const y = padT + plotH - (val / yTop) * plotH;
    gridLines.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#dddddd" stroke-width="1"/>`
    );
    yLabels.push(
      `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="${TEXT_FILL}" font-family="${FONT}">${fmtCount(val)}</text>`
    );
  }

  const xLabels: string[] = [];
  const xstep = xLabelStep(n);
  for (let i = 0; i < n; i += xstep) {
    xLabels.push(
      `<text x="${xAt(i)}" y="${padT + plotH + 18}" text-anchor="middle" font-size="10" fill="${MUTED}" font-family="${FONT}">${esc(shortDateLabel(dates[i]))}</text>`
    );
  }

  const paths: string[] = [];
  const pointLabels: string[] = [];
  series.forEach((s, idx) => {
    const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
    const path = buildPath(s.values, xAt, yAt);
    if (path) {
      paths.push(
        `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
    const stackOffset = (idx % 5) * 11;
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      const cx = xAt(i);
      const cy = yAt(v);
      const ty = cy - 8 - stackOffset;
      pointLabels.push(
        `<text x="${cx}" y="${ty}" text-anchor="middle" font-size="9" font-weight="600" fill="${color}" font-family="${FONT}">${esc(fmtCount(v))}</text>`
      );
    }
  });

  const legendY = padT + plotH + 32;
  const legendItems = series.map((s, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const lx = padL + col * 300;
    const ly = legendY + row * 22;
    const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
    return `<g>
  <rect x="${lx}" y="${ly - 10}" width="12" height="12" fill="${color}" stroke="#cccccc" stroke-width="0.5"/>
  <text x="${lx + 18}" y="${ly + 1}" font-size="11" fill="${TEXT_FILL}" font-family="${FONT}">${esc(s.label)}</text>
</g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="26" text-anchor="middle" font-size="14" font-weight="700" fill="${TEXT_FILL}" font-family="${FONT}">${esc(title)}</text>
  <text x="${W / 2}" y="42" text-anchor="middle" font-size="10" fill="${MUTED}" font-family="${FONT}">${esc('Y axis: daily conversion count (CC+MV sales per product)')}</text>
  <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#888888" stroke-width="1"/>
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#888888" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${paths.join('\n  ')}
  ${pointLabels.join('\n  ')}
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
  const H = 400;
  const padL = 58;
  const padR = 14;
  const padT = 40;
  const padB = 72;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = dates.length;
  const yTop = 100;

  if (n === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120" viewBox="0 0 ${W} 120" role="img" aria-label="${esc(title)}">
  <text x="16" y="48" font-family="${FONT}" font-size="13" fill="${MUTED}">${esc('No data in this date range.')}</text>
</svg>`;
  }

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / yTop) * plotH;

  const gridLines: string[] = [];
  const yLabels: string[] = [];
  for (let p = 0; p <= 100; p += 5) {
    const y = padT + plotH - (p / yTop) * plotH;
    gridLines.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#dddddd" stroke-width="1"/>`
    );
    yLabels.push(
      `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="${TEXT_FILL}" font-family="${FONT}">${p}%</text>`
    );
  }

  const step = xLabelStep(n);
  const xLabels: string[] = [];
  for (let i = 0; i < n; i += step) {
    xLabels.push(
      `<text x="${xAt(i)}" y="${padT + plotH + 18}" text-anchor="middle" font-size="10" fill="${MUTED}" font-family="${FONT}">${esc(shortDateLabel(dates[i]))}</text>`
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
  for (let i = 0; i < n; i++) {
    const fr = frustration[i];
    if (fr !== null && fr !== undefined && !Number.isNaN(fr)) {
      const cx = xAt(i);
      const cy = yAt(fr);
      pointLabels.push(
        `<text x="${cx}" y="${cy - 10}" text-anchor="middle" font-size="9" font-weight="600" fill="#c0392b" font-family="${FONT}">${esc(fmtPct(fr))}</text>`
      );
    }
  }
  for (let i = 0; i < n; i++) {
    const cf = confusion[i];
    if (cf !== null && cf !== undefined && !Number.isNaN(cf)) {
      const cx = xAt(i);
      const cy = yAt(cf);
      pointLabels.push(
        `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" font-weight="600" fill="#2471a3" font-family="${FONT}">${esc(fmtPct(cf))}</text>`
      );
    }
  }

  const legendY = padT + plotH + 36;
  const leg = `<g>
  <rect x="${padL}" y="${legendY - 10}" width="12" height="12" fill="#e74c3c" stroke="#cccccc" stroke-width="0.5"/>
  <text x="${padL + 18}" y="${legendY + 1}" font-size="12" font-weight="600" fill="${TEXT_FILL}" font-family="${FONT}">Frustration rate</text>
  <rect x="${padL + 200}" y="${legendY - 10}" width="12" height="12" fill="#3498db" stroke="#cccccc" stroke-width="0.5"/>
  <text x="${padL + 218}" y="${legendY + 1}" font-size="12" font-weight="600" fill="${TEXT_FILL}" font-family="${FONT}">Confusion rate</text>
</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="26" text-anchor="middle" font-size="14" font-weight="700" fill="${TEXT_FILL}" font-family="${FONT}">${esc(title)}</text>
  <text x="${W / 2}" y="42" text-anchor="middle" font-size="10" fill="${MUTED}" font-family="${FONT}">${esc('Y axis: percent (0–100%), grid every 5%')}</text>
  <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#888888" stroke-width="1"/>
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#888888" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${lines.join('\n  ')}
  ${pointLabels.join('\n  ')}
  ${xLabels.join('\n  ')}
  ${leg}
</svg>`;
}
