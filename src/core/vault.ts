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
  private readonly entries = new Map<string, string>();
  private loaded: Promise<void> | undefined;
  private saving: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(private readonly file: string | undefined, private readonly limit: number) {}

  load(): Promise<void> {
    this.loaded ??= this.read();
    return this.loaded;
  }

  private async read(): Promise<void> {
    if (this.file === undefined) return;
    try {
      const data = JSON.parse(await readFile(this.file, "utf8")) as Record<string, string>;
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") this.entries.set(key, value);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(placeholder: string): string | undefined {
    return this.entries.get(placeholder);
  }

  add(entries: ReadonlyMap<string, string>): void {
    for (const [key, value] of entries) {
      if (this.entries.get(key) === value) continue;
      this.entries.delete(key);
      this.entries.set(key, value);
      this.dirty = true;
    }
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    if (this.dirty) void this.persist();
  }

  clear(): Promise<void> {
    this.entries.clear();
    this.dirty = true;
    return this.persist();
  }

  private persist(): Promise<void> {
    const file = this.file;
    if (file === undefined) return Promise.resolve();
    this.saving = this.saving.then(async () => {
      if (!this.dirty) return;
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
