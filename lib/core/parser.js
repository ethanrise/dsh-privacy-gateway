import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
const MAX_BYTES = 20 * 1024 * 1024;
function normalizeCell(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return value;
    if (value instanceof Date)
        return value;
    if (typeof value === "object") {
        if ("text" in value && typeof value.text === "string")
            return value.text;
        if ("result" in value && value.result !== undefined && value.result !== null) {
            return normalizeCell(value.result);
        }
        if ("richText" in value && Array.isArray(value.richText)) {
            return value.richText.map(part => part.text).join("");
        }
    }
    return String(value);
}
function assertSize(bytes) {
    if (bytes.byteLength > MAX_BYTES) {
        throw new Error(`file exceeds ${MAX_BYTES / 1024 / 1024} MiB limit`);
    }
}
function parseCsvDocument(bytes) {
    const records = parseCsv(Buffer.from(bytes), {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: false,
    });
    const [head = [], ...rows] = records;
    const headers = head.map((value, index) => String(value ?? "").trim() || `Column ${index + 1}`);
    const normalizedRows = rows.map(row => row.map(value => {
        if (value === null || value === undefined || value === "")
            return null;
        return typeof value === "string" ? value : String(value);
    }));
    return { format: "csv", sheets: [{ name: "CSV", headers, rows: normalizedRows }] };
}
async function parseXlsxDocument(bytes) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const sheets = [];
    workbook.eachSheet(sheet => {
        const headerRow = sheet.getRow(1);
        const columnCount = Math.max(sheet.columnCount, headerRow.cellCount);
        const headers = Array.from({ length: columnCount }, (_, i) => {
            const raw = normalizeCell(headerRow.getCell(i + 1).value);
            return String(raw ?? "").trim() || `Column ${i + 1}`;
        });
        const rows = [];
        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
            const row = sheet.getRow(rowNumber);
            rows.push(Array.from({ length: columnCount }, (_, i) => normalizeCell(row.getCell(i + 1).value)));
        }
        sheets.push({ name: sheet.name, headers, rows });
    });
    return { format: "xlsx", sheets };
}
export async function parseDocument(fileName, bytes) {
    assertSize(bytes);
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".csv"))
        return parseCsvDocument(bytes);
    if (lower.endsWith(".xlsx"))
        return parseXlsxDocument(bytes);
    throw new Error("only .csv and .xlsx are supported in v0.1");
}
function csvEscape(value) {
    const text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export async function serializeDocument(document) {
    if (document.format === "csv") {
        const sheet = document.sheets[0];
        if (sheet === undefined)
            return new Uint8Array();
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
        for (const row of sheet.rows)
            ws.addRow([...row]);
    }
    return new Uint8Array(await workbook.xlsx.writeBuffer());
}
