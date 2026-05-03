// =============================================================================
// PDF text extraction via unpdf.
//
// Why unpdf and not pdf-parse:
//   - Works in serverless runtimes (no Node-only native deps)
//   - Returns per-page text directly via mergePages: false
//   - Actively maintained (Mozilla's pdfjs under the hood)
// =============================================================================

import { extractText, getDocumentProxy } from 'unpdf';

export interface PageText {
  page: number;
  text: string;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<{
  pages: PageText[];
  totalPages: number;
}> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  // When mergePages is false, `text` is string[] (per-page).
  const perPage = (text as string[]) ?? [];
  const pages: PageText[] = perPage
    .map((t, i) => ({ page: i + 1, text: (t ?? '').trim() }))
    .filter((p) => p.text.length > 0);
  return { pages, totalPages };
}
