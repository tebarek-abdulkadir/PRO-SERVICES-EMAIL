import { Resvg } from '@resvg/resvg-js';

const RESVG_OPTS = {
  background: '#fafafa',
  font: {
    loadSystemFonts: false,
    defaultFontFamily: 'Arial',
    sansSerifFamily: 'Arial',
  },
} as const;

function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, RESVG_OPTS);
  return resvg.render().asPng();
}

/** PNG bytes for MIME inline attachments (`cid:`) — works in Outlook; data URLs often do not. */
export function svgToPngBuffer(svg: string): Buffer {
  return renderSvgToPng(svg);
}

export function trySvgToPngBuffer(svg: string): { buffer: Buffer } | { error: string } {
  try {
    return { buffer: renderSvgToPng(svg) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
