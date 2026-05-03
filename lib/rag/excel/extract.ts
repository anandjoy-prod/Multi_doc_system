// =============================================================================
// Excel text extraction via ExcelJS.
//
// We render each sheet as readable text — header row, then one line per data
// row formatted as "ColA: val, ColB: val". This shape is much friendlier
// for embedding than raw cell coordinates because the column name is right
// next to the value, so semantic search picks up "what was Marketing's Q3
// budget?" by matching against the actual column header tokens.
//
// Empty rows and empty cells are skipped to keep chunks dense.
// =============================================================================

import ExcelJS from 'exceljs';

export interface SheetText {
  name: string;
  rowCount: number;
  text: string;
}

export interface ExtractedExcel {
  sheets: SheetText[];
  totalRows: number;
  totalSheets: number;
}

const MAX_ROWS_PER_SHEET = 50_000; // sanity cap for pathological files

export async function extractExcelText(
  buffer: ArrayBuffer,
): Promise<ExtractedExcel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheets: SheetText[] = [];
  let totalRows = 0;

  wb.eachSheet((ws) => {
    const sheetText = renderSheetAsText(ws);
    if (sheetText.text.trim().length === 0) return;
    sheets.push(sheetText);
    totalRows += sheetText.rowCount;
  });

  return { sheets, totalRows, totalSheets: sheets.length };
}

function renderSheetAsText(ws: ExcelJS.Worksheet): SheetText {
  // First non-empty row is treated as headers.
  const allRows = ws.getRows(1, Math.min(ws.actualRowCount, MAX_ROWS_PER_SHEET)) ?? [];

  // Find the first row with any content as headers.
  let headerIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (rowHasContent(allRows[i])) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return { name: ws.name, rowCount: 0, text: '' };
  }

  const headerRow = allRows[headerIdx]!;
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = stringify(cell.value) || `col${colNumber}`;
  });

  const lines: string[] = [];
  lines.push(`Sheet: ${ws.name}`);
  lines.push(`Columns: ${headers.filter(Boolean).join(' | ')}`);
  lines.push('');

  let dataRowCount = 0;
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || !rowHasContent(row)) continue;

    const parts: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber - 1] ?? `col${colNumber}`;
      const value = stringify(cell.value);
      if (value) parts.push(`${header}: ${value}`);
    });

    if (parts.length > 0) {
      lines.push(parts.join(', '));
      dataRowCount++;
    }
  }

  return {
    name: ws.name,
    rowCount: dataRowCount,
    text: lines.join('\n'),
  };
}

function rowHasContent(row: ExcelJS.Row | undefined): boolean {
  if (!row) return false;
  let has = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (stringify(cell.value).trim()) has = true;
  });
  return has;
}

/**
 * ExcelJS cell values can be strings, numbers, dates, formulas, hyperlinks,
 * rich text, errors, booleans. Coerce to a clean string for embedding.
 */
function stringify(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof (value as { text: unknown }).text === 'string') {
      return (value as { text: string }).text;
    }
    if ('result' in value) {
      return stringify((value as { result: ExcelJS.CellValue }).result);
    }
    if ('richText' in value && Array.isArray((value as { richText: unknown }).richText)) {
      return (value as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join('');
    }
    if ('hyperlink' in value && typeof (value as { hyperlink: unknown }).hyperlink === 'string') {
      const v = value as { hyperlink: string; text?: string };
      return v.text ? `${v.text} (${v.hyperlink})` : v.hyperlink;
    }
    if ('error' in value) return '';
  }
  return '';
}
