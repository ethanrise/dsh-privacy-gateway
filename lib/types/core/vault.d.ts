export declare const VAULT_FILE: string;
/**
 * placeholder -> original value. Kept host-side only: never written to the
 * session log, and read by the browser only through the plugin's own route.
 * Oldest entries are dropped past `limit`; their placeholders then stay
 * unrestored in the UI.
 */
export declare class Vault {
    private readonly file;
    private readonly limit;
    private readonly entries;
    private loaded;
    private saving;
    private dirty;
    constructor(file: string | undefined, limit: number);
    load(): Promise<void>;
    private read;
    get size(): number;
    get(placeholder: string): string | undefined;
    add(entries: ReadonlyMap<string, string>): void;
    clear(): Promise<void>;
    private persist;
}
