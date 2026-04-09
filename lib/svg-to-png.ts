import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

/** Bundled OFL font so Resvg always has glyphs (no reliance on server system fonts). */
const NOTO_SANS_TTF = path.join(process.cwd(), 'lib', 'fonts', 'NotoSans-Regular.ttf');

/** Raster scale for chart SVGs (logical size stays 640px wide; PNG dimensions multiply by this). */
const CHART_PNG_ZOOM = 3;

function resvgOptions(): ConstructorParameters<typeof Resvg>[1] {
  const fontFiles = fs.existsSync(NOTO_SANS_TTF) ? [NOTO_SANS_TTF] : [];
  return {
    background: '#fafafa',
    font: {
      loadSystemFonts: fontFiles.length === 0,
      ...(fontFiles.length ? { fontFiles } : {}),
      defaultFontFamily: fontFiles.length ? 'Noto Sans' : 'Arial',
      sansSerifFamily: fontFiles.length ? 'Noto Sans' : 'Arial',
    },
  };
}

function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    ...resvgOptions(),
    fitTo: { mode: 'zoom', value: CHART_PNG_ZOOM },
  });
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
