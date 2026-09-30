import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const SECRET_DIR = join(homedir(), ".dsh-privacy-gateway");
const SECRET_FILE = join(SECRET_DIR, "token-secret");

async function createSecret(): Promise<Buffer> {
  await mkdir(SECRET_DIR, { recursive: true, mode: 0o700 });
  const secret = randomBytes(32);
  await writeFile(SECRET_FILE, secret, { mode: 0o600, flag: "wx" });
  await chmod(SECRET_FILE, 0o600);
  return secret;
}

export async function loadOrCreateSecret(): Promise<Buffer> {
  try {
    return await readFile(SECRET_FILE);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    try {
      return await createSecret();
    } catch (createError) {
      if ((createError as NodeJS.ErrnoException).code === "EEXIST") return readFile(SECRET_FILE);
      throw createError;
    }
  }
}

export function stableToken(secret: Buffer, kind: string, value: string): string {
  const digest = createHmac("sha256", secret)
    .update(kind)
    .update("\0")
    .update(value)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `${kind}_${digest}`;
}
