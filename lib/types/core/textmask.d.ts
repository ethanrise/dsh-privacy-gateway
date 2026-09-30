/** Entity kinds recognised in free text (conversation messages and tool results). */
export type TextEntity = "PERSON" | "PHONE" | "EMAIL" | "ID_CARD" | "BANK_CARD" | "IP";
export declare const TEXT_ENTITIES: readonly TextEntity[];
export declare const DEFAULT_TEXT_ENTITIES: readonly TextEntity[];
/**
 * Placeholders use square brackets: Markdown renders them literally, whereas
 * `<PHONE_1>` would be parsed as an HTML tag and disappear from the page.
 */
export declare const PLACEHOLDER: RegExp;
interface Span {
    readonly start: number;
    readonly end: number;
    readonly kind: TextEntity;
    readonly value: string;
}
/** Sensitive values in `text`, earliest first, without overlaps. */
export declare function findEntities(text: string, kinds: readonly TextEntity[]): Span[];
export interface MaskResult {
    readonly text: string;
    readonly replaced: number;
    /** placeholder -> original, for every value replaced in this call */
    readonly entries: ReadonlyMap<string, string>;
}
export declare function maskText(text: string, kinds: readonly TextEntity[], secret: Buffer): MaskResult;
/** Replace known placeholders with their originals; unknown ones stay as they are. */
export declare function restoreText(text: string, lookup: (placeholder: string) => string | undefined): string;
export {};
