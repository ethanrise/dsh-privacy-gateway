/** The word list names real customers, so it stays local with 0600 like the vault. */
export declare const DICTIONARY_FILE: string;
/** One term per line, exactly as the user typed it. */
export declare function loadDictionaryText(file: string | undefined): Promise<string>;
export declare function saveDictionaryText(file: string | undefined, terms: string): Promise<void>;
