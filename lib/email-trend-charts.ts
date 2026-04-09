/**
 * Inline SVG line charts for HTML email (no JS). Uses polylines; missing points break segments.
 */

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

function niceMax(n: number): number {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const c = Math.ceil(n / p) * p;
  return Math.max(c, 1);
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

/** X-axis label step so we do not overcrowd */
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

export function renderConversionTrendSvg(
  dates: string[],
  series: ConversionSeriesInput[],
  title: string
): string {
  const W = 640;
  const H = 420;
  const padL = 44;
  const padR = 12;
  const padT = 36;
  const padB = 72;
  const legendH = Math.max(56, Math.ceil(series.length / 3) * 18 + 8);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB - legendH;
  const n = dates.length;

  if (n === 0 || series.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120" viewBox="0 0 ${W} 120" role="img" aria-label="${esc(title)}">
  <text x="16" y="48" font-family="Segoe UI,Calibri,sans-serif" font-size="13" fill="#555">${esc('No data in this date range.')}</text>
</svg>`;
  }

  let ymax = 0;
  for (const s of series) {
    for (const v of s.values) {
      if (v !== null && v !== undefined && !Number.isNaN(v)) ymax = Math.max(ymax, v);
    }
  }
  const yTop = niceMax(ymax);
  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / yTop) * plotH;

  const yTicks = 4;
  const gridLines: string[] = [];
  const yLabels: string[] = [];
  for (let t = 0; t <= yTicks; t++) {
    const val = (yTop * (yTicks - t)) / yTicks;
    const y = padT + (t / yTicks) * plotH;
    gridLines.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`
    );
    yLabels.push(
      `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666" font-family="Segoe UI,Calibri,sans-serif">${Math.round(val)}</text>`
    );
  }

  const xLabels: string[] = [];
  const step = xLabelStep(n);
  for (let i = 0; i < n; i += step) {
    xLabels.push(
      `<text x="${xAt(i)}" y="${padT + plotH + 16}" text-anchor="middle" font-size="9" fill="#666" font-family="Segoe UI,Calibri,sans-serif">${esc(shortDateLabel(dates[i]))}</text>`
    );
  }

  const paths: string[] = [];
  series.forEach((s, idx) => {
    const path = buildPath(s.values, xAt, yAt);
    if (!path) return;
    const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
    paths.push(
      `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  });

  const legendY = padT + plotH + 36;
  const legendItems = series.map((s, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const lx = padL + col * 200;
    const ly = legendY + row * 18;
    const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
    return `<rect x="${lx}" y="${ly - 8}" width="10" height="10" fill="${color}"/><text x="${lx + 16}" y="${ly}" font-size="10" fill="#333" font-family="Segoe UI,Calibri,sans-serif">${esc(s.label)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="14" font-weight="600" fill="#2c3e50" font-family="Segoe UI,Calibri,sans-serif">${esc(title)}</text>
  <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#999" stroke-width="1"/>
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#999" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${paths.join('\n  ')}
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
  const H = 320;
  const padL = 44;
  const padR = 12;
  const padT = 36;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = dates.length;
  const yTop = 100;

  if (n === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120" viewBox="0 0 ${W} 120" role="img" aria-label="${esc(title)}">
  <text x="16" y="48" font-family="Segoe UI,Calibri,sans-serif" font-size="13" fill="#555">${esc('No data in this date range.')}</text>
</svg>`;
  }

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / yTop) * plotH;

  const gridLines: string[] = [];
  const yLabels: string[] = [];
  for (let t = 0; t <= 4; t++) {
    const val = (100 * (4 - t)) / 4;
    const y = padT + (t / 4) * plotH;
    gridLines.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`
    );
    yLabels.push(
      `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666" font-family="Segoe UI,Calibri,sans-serif">${val}%</text>`
    );
  }

  const step = xLabelStep(n);
  const xLabels: string[] = [];
  for (let i = 0; i < n; i += step) {
    xLabels.push(
      `<text x="${xAt(i)}" y="${padT + plotH + 16}" text-anchor="middle" font-size="9" fill="#666" font-family="Segoe UI,Calibri,sans-serif">${esc(shortDateLabel(dates[i]))}</text>`
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

  const legendY = padT + plotH + 28;
  const leg = `<rect x="${padL}" y="${legendY - 8}" width="10" height="10" fill="#e74c3c"/><text x="${padL + 16}" y="${legendY}" font-size="11" fill="#333" font-family="Segoe UI,Calibri,sans-serif">Frustration %</text>
  <rect x="${padL + 140}" y="${legendY - 8}" width="10" height="10" fill="#3498db"/><text x="${padL + 156}" y="${legendY}" font-size="11" fill="#333" font-family="Segoe UI,Calibri,sans-serif">Confusion %</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="14" font-weight="600" fill="#2c3e50" font-family="Segoe UI,Calibri,sans-serif">${esc(title)}</text>
  <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#999" stroke-width="1"/>
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#999" stroke-width="1"/>
  ${gridLines.join('\n  ')}
  ${yLabels.join('\n  ')}
  ${lines.join('\n  ')}
  ${xLabels.join('\n  ')}
  ${leg}
</svg>`;
}
