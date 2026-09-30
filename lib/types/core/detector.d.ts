import type { ColumnScan, RedactionAction, SensitiveKind, TabularSheet } from "./types.js";
export declare function recommendedAction(kind: SensitiveKind): RedactionAction;
export declare function scanSheet(sheet: TabularSheet): readonly ColumnScan[];
