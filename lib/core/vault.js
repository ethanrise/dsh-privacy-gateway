import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
const VAULT_DIR = join(homedir(), ".dsh-privacy-gateway");
export const VAULT_FILE = join(VAULT_DIR, "vault.json");
/**
 * placeholder -> original value. Kept host-side only: never written to the
 * session log, and read by the browser only through the plugin's own route.
 * Oldest entries are dropped past `limit`; their placeholders then stay
 * unrestored in the UI.
 */
export class Vault {
    file;
    limit;
    entries = new Map();
    loaded;
    saving = Promise.resolve();
    dirty = false;
    constructor(file, limit) {
        this.file = file;
        this.limit = limit;
    }
    load() {
        this.loaded ??= this.read();
        return this.loaded;
    }
    async read() {
        if (this.file === undefined)
            return;
        try {
            const data = JSON.parse(await readFile(this.file, "utf8"));
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === "string")
                    this.entries.set(key, value);
            }
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
    }
    get size() {
        return this.entries.size;
    }
    get(placeholder) {
        return this.entries.get(placeholder);
    }
    add(entries) {
        for (const [key, value] of entries) {
            if (this.entries.get(key) === value)
                continue;
            this.entries.delete(key);
            this.entries.set(key, value);
            this.dirty = true;
        }
        while (this.entries.size > this.limit) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined)
                break;
            this.entries.delete(oldest);
        }
        if (this.dirty)
            void this.persist();
    }
    clear() {
        this.entries.clear();
        this.dirty = true;
        return this.persist();
    }
    persist() {
        const file = this.file;
        if (file === undefined)
            return Promise.resolve();
        this.saving = this.saving.then(async () => {
            if (!this.dirty)
                return;
            this.dirty = false;
            await mkdir(VAULT_DIR, { recursive: true, mode: 0o700 });
            const temp = `${file}.tmp`;
            await writeFile(temp, JSON.stringify(Object.fromEntries(this.entries)), { mode: 0o600 });
            await chmod(temp, 0o600);
            await rename(temp, file);
        }).catch(() => {
            this.dirty = true;
        });
        return this.saving;
    }
}
