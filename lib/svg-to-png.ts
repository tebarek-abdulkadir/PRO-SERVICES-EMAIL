import { Resvg } from '@resvg/resvg-js';

/** Rasterize SVG to a PNG data URL for HTML email (`<img src="...">`). */
export function svgToPngDataUrl(svg: string): string {
  const resvg = new Resvg(svg, {
    background: '#fafafa',
    // Avoid scanning system fonts on servers; SVG uses generic sans-serif stacks.
    font: {
      loadSystemFonts: false,
      defaultFontFamily: 'Arial',
      sansSerifFamily: 'Arial',
    },
  });
  const png = resvg.render().asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}

export function trySvgToPngDataUrl(svg: string): { dataUrl: string } | { error: string } {
  try {
    return { dataUrl: svgToPngDataUrl(svg) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
