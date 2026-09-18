import "server-only";

export type PdfReadResult = {
  text: string;
  /** Best-effort accent color detected from the first two pages, or null. */
  accentColor: string | null;
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

// Low saturation (max-min channel spread) reads as black/white/gray, not a
// deliberate accent choice.
function isNeutral(r: number, g: number, b: number): boolean {
  return Math.max(r, g, b) - Math.min(r, g, b) < 0.12;
}

/**
 * Reads a PDF's text (for CV extraction) and its accent color (for matching
 * generated documents to it) in a single pass. Text comes from pdfjs-dist's
 * text-content layer; the accent color is a best-effort heuristic — the fill
 * color most often active while text is drawn on the first couple pages,
 * ignoring black/white/gray. Resumes that use an accent color typically
 * apply it consistently to the name/section headers, so this is a reasonable
 * proxy without needing to identify which specific text is a heading.
 *
 * Deliberately uses ONE pdfjs-dist instance for both text and color: two
 * different pdfjs-dist versions loaded in the same process (e.g. one direct,
 * one nested inside another package) trip an internal version check pdfjs
 * does between its "API" and "worker" sides, even when both run on the main
 * thread in Node — so this avoids a second PDF-parsing dependency entirely
 * rather than risk that collision.
 */
export async function readCvPdf(pdfBuffer: Buffer): Promise<PdfReadResult> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0,
    }).promise;

    let text = "";
    let fill: [number, number, number] = [0, 0, 0];
    const counts = new Map<string, number>();
    const COLOR_SAMPLE_PAGES = 2;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);

      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) {
          text += item.str;
          text += item.hasEOL ? "\n" : " ";
        }
      }
      text += "\n\n";

      if (pageNum > COLOR_SAMPLE_PAGES) continue;
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as unknown[];

        if (fn === pdfjs.OPS.setFillRGBColor) {
          // pdfjs hands this back as either ["#rrggbb"] or [r,g,b] floats
          // depending on version/colorspace — handle both.
          fill =
            typeof args[0] === "string"
              ? hexToRgb(args[0])
              : [args[0] as number, args[1] as number, args[2] as number];
        } else if (fn === pdfjs.OPS.setFillGray) {
          const g = args[0] as number;
          fill = [g, g, g];
        } else if (fn === pdfjs.OPS.setFillCMYKColor) {
          const [c, m, y, k] = args as number[];
          fill = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
        } else if (fn === pdfjs.OPS.showText || fn === pdfjs.OPS.showSpacedText) {
          if (!isNeutral(...fill)) {
            const hex = rgbToHex(...fill);
            counts.set(hex, (counts.get(hex) ?? 0) + 1);
          }
        }
      }
    }

    let accentColor: string | null = null;
    let bestCount = 0;
    for (const [hex, count] of counts) {
      if (count > bestCount) {
        accentColor = hex;
        bestCount = count;
      }
    }

    return { text: text.trim(), accentColor };
  } catch {
    return { text: "", accentColor: null };
  }
}
