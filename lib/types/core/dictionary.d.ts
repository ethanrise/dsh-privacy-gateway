/**
 * User-maintained word list: one term per line, matched exactly (Latin text
 * case-insensitively). Placeholders are derived from the term automatically,
 * so the user only maintains which words to mask.
 */
export type DictionaryKind = "PERSON" | "ORG" | "TERM";
export interface DictionaryEntry {
    readonly term: string;
    readonly kind: DictionaryKind;
}
/** Label shown on the inspect card; it does not change what gets masked. */
export declare function kindOf(term: string): DictionaryKind;
/** Non-empty, non-comment lines, trimmed and de-duplicated. */
export declare function parseDictionary(text: string): DictionaryEntry[];
export interface DictionaryMatch {
    readonly start: number;
    readonly end: number;
    readonly entry: DictionaryEntry;
}
/**
 * Longest term first, so a list holding both "字节跳动" and "字节跳动有限公司"
 * masks the full name as one piece. A term starting or ending with a Latin
 * letter or digit needs a non-alphanumeric neighbour on that side, so "ACME"
 * does not match inside "ACMEX"; Chinese terms match anywhere.
 */
export declare function compileDictionary(entries: readonly DictionaryEntry[]): (text: string) => DictionaryMatch[];
