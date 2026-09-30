export type SensitiveKind = "PERSON" | "PHONE" | "EMAIL" | "ID_CARD" | "IP" | "ORG" | "ADDRESS" | "UNKNOWN";
export type RedactionAction = "KEEP" | "MASK" | "TOKENIZE" | "REMOVE";
export interface ColumnScan {
    readonly index: number;
    readonly name: string;
    readonly kind: SensitiveKind;
    readonly confidence: number;
    readonly matchedValues: number;
    readonly nonEmptyValues: number;
    readonly recommendedAction: RedactionAction;
}
export interface SheetScan {
    readonly name: string;
    readonly rows: number;
    readonly columns: readonly ColumnScan[];
}
export interface PrivacyScan {
    readonly fileName: string;
    readonly format: "csv" | "xlsx";
    readonly sheets: readonly SheetScan[];
}
export interface ColumnPolicy {
    readonly sheet: string;
    readonly columnIndex: number;
    readonly action: RedactionAction;
    readonly kind?: SensitiveKind;
}
export interface TabularSheet {
    readonly name: string;
    readonly headers: readonly string[];
    readonly rows: readonly (string | number | boolean | Date | null)[][];
}
export interface TabularDocument {
    readonly format: "csv" | "xlsx";
    readonly sheets: readonly TabularSheet[];
}
