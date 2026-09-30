import type { ColumnPolicy, PrivacyScan, TabularDocument } from "./types.js";
export declare function buildScan(fileName: string, document: TabularDocument): PrivacyScan;
export declare function redactDocument(document: TabularDocument, scan: PrivacyScan, policies: readonly ColumnPolicy[], secret: Buffer): TabularDocument;
