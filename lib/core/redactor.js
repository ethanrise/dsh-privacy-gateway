import { scanSheet } from "./detector.js";
import { stableToken } from "./tokenizer.js";
function textOf(value) {
    if (value === null || value === undefined)
        return "";
    if (value instanceof Date)
        return value.toISOString();
    return String(value);
}
function mask(kind, value) {
    if (value.length === 0)
        return value;
    switch (kind) {
        case "PHONE": {
            const compact = value.replace(/[\s-]/g, "");
            if (compact.length >= 7)
                return `${compact.slice(0, 3)}****${compact.slice(-4)}`;
            return "***";
        }
        case "ID_CARD":
            return value.length >= 8 ? `${value.slice(0, 4)}**********${value.slice(-4)}` : "***";
        case "EMAIL": {
            const at = value.indexOf("@");
            if (at <= 1)
                return "***";
            return `${value.slice(0, 1)}***${value.slice(at)}`;
        }
        default:
            return value.length <= 2 ? "**" : `${value.slice(0, 1)}***${value.slice(-1)}`;
    }
}
function redactValue(value, kind, action, secret) {
    if (value === null || value === undefined || value === "")
        return value;
    if (action === "KEEP")
        return value;
    if (action === "REMOVE")
        return "[REDACTED]";
    const text = textOf(value);
    if (action === "MASK")
        return mask(kind, text);
    return stableToken(secret, kind === "UNKNOWN" ? "VALUE" : kind, text);
}
export function buildScan(fileName, document) {
    return {
        fileName,
        format: document.format,
        sheets: document.sheets.map(sheet => ({
            name: sheet.name,
            rows: sheet.rows.length,
            columns: scanSheet(sheet),
        })),
    };
}
export function redactDocument(document, scan, policies, secret) {
    const policyMap = new Map(policies.map(policy => [`${policy.sheet}:${policy.columnIndex}`, policy]));
    return {
        format: document.format,
        sheets: document.sheets.map((sheet, sheetIndex) => {
            const sheetScan = scan.sheets[sheetIndex];
            if (sheetScan === undefined)
                return sheet;
            return {
                ...sheet,
                rows: sheet.rows.map(row => row.map((value, columnIndex) => {
                    const column = sheetScan.columns[columnIndex];
                    if (column === undefined)
                        return value;
                    const explicit = policyMap.get(`${sheet.name}:${columnIndex}`);
                    const action = explicit?.action ?? column.recommendedAction;
                    const kind = explicit?.kind ?? column.kind;
                    return redactValue(value, kind, action, secret);
                })),
            };
        }),
    };
}
