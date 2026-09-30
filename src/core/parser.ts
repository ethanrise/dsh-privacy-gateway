import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import type { TabularDocument, TabularSheet } from "./types.js";

const MAX_BYTES = 20 * 1024 * 1024;

function normalizeCell(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result !== undefined && value.result !== null) {
      return normalizeCell(value.result as ExcelJS.CellValue);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text).join("");
    }
  }
  return String(value);
}

function assertSize(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`file exceeds ${MAX_BYTES / 1024 / 1024} MiB limit`);
  }
}

function parseCsvDocument(bytes: Uint8Array): TabularDocument {
  const records = parseCsv(Buffer.from(bytes), {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as unknown[][];
  const [head = [], ...rows] = records;
  const headers = head.map((value, index) => String(value ?? "").trim() || `Column ${index + 1}`);
  const normalizedRows = rows.map(row => row.map(value => {
    if (value === null || value === undefined || value === "") return null;
    return typeof value === "string" ? value : String(value);
  }));
  return { format: "csv", sheets: [{ name: "CSV", headers, rows: normalizedRows }] };
}

async function parseXlsxDocument(bytes: Uint8Array): Promise<TabularDocument> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes));
  const sheets: TabularSheet[] = [];
  workbook.eachSheet(sheet => {
    const headerRow = sheet.getRow(1);
    const columnCount = Math.max(sheet.columnCount, headerRow.cellCount);
    const headers = Array.from({ length: columnCount }, (_, i) => {
      const raw = normalizeCell(headerRow.getCell(i + 1).value);
      return String(raw ?? "").trim() || `Column ${i + 1}`;
    });
    const rows: TabularSheet["rows"][number][] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      rows.push(Array.from({ length: columnCount }, (_, i) => normalizeCell(row.getCell(i + 1).value)));
    }
    sheets.push({ name: sheet.name, headers, rows });
  });
  return { format: "xlsx", sheets };
}

export async function parseDocument(fileName: string, bytes: Uint8Array): Promise<TabularDocument> {
  assertSize(bytes);
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsvDocument(bytes);
  if (lower.endsWith(".xlsx")) return parseXlsxDocument(bytes);
  throw new Error("only .csv and .xlsx are supported in v0.1");
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function serializeDocument(document: TabularDocument): Promise<Uint8Array> {
  if (document.format === "csv") {
    const sheet = document.sheets[0];
    if (sheet === undefined) return new Uint8Array();
    const lines = [
      sheet.headers.map(csvEscape).join(","),
      ...sheet.rows.map(row => row.map(csvEscape).join(",")),
    ];
    return Buffer.from(lines.join("\r\n"), "utf8");
  }

  const workbook = new ExcelJS.Workbook();
  for (const sheet of document.sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.addRow([...sheet.headers]);
    for (const row of sheet.rows) ws.addRow([...row]);
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
