import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** The word list names real customers, so it stays local with 0600 like the vault. */
export const DICTIONARY_FILE = join(homedir(), ".dsh-privacy-gateway", "dictionary.json");

/** One term per line, exactly as the user typed it. */
export async function loadDictionaryText(file: string | undefined): Promise<string> {
  if (file === undefined) return "";
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as { terms?: unknown };
    return typeof data.terms === "string" ? data.terms : "";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function saveDictionaryText(file: string | undefined, terms: string): Promise<void> {
  if (file === undefined) return;
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify({ terms }), { mode: 0o600 });
  await chmod(temp, 0o600);
  await rename(temp, file);
}
