import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-connection";
import type { ColumnPolicy } from "./core/types.js";
import { parseDocument, serializeDocument } from "./core/parser.js";
import { buildScan, redactDocument } from "./core/redactor.js";
import { loadOrCreateSecret } from "./core/tokenizer.js";
import { DEFAULT_TEXT_ENTITIES, PLACEHOLDER, TEXT_ENTITIES, maskText, type TextEntity } from "./core/textmask.js";
import { VAULT_FILE, Vault } from "./core/vault.js";
import { compileDictionary, parseDictionary, type DictionaryMatch } from "./core/dictionary.js";
import { DICTIONARY_FILE, loadDictionaryText, saveDictionaryText } from "./core/dictionary-store.js";

const BASE = "/api/privacy-gateway/v1";
const FILE_NAME_HEADER = "x-dpg-file-name";
const POLICY_HEADER = "x-dpg-policy";

export const inject = ["connection"] as const;

function fileNameOf(request: Request): string {
  const encoded = request.headers.get(FILE_NAME_HEADER);
  if (encoded === null) throw new Error("missing x-dpg-file-name");
  return decodeURIComponent(encoded);
}

async function readBytes(request: Request): Promise<Uint8Array> {
  return new Uint8Array(await request.arrayBuffer());
}

function jsonError(error: unknown, status = 400): Response {
  return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status });
}

export interface Config {
  /** Mask conversation text before it reaches the model (and the session log). */
  maskMessages?: boolean;
  /** Also mask tool results; off by default because the model may then write placeholders into files. */
  maskToolResults?: boolean;
  entities?: TextEntity[];
  /** Keep the placeholder table on disk so history still restores after a restart. */
  persistVault?: boolean;
  maxVaultEntries?: number;
  /** Where the word list lives; an empty string keeps it in memory only (tests). */
  dictionaryFile?: string;
}

interface TextBlock { type: "text"; text: string }
type Block = TextBlock | { type: string };
interface Message { content?: string | Block[] }
type Decision = { kind: "reject" } | { kind: "enter"; messages: Message[] };
type ToolDecision = { kind: string; content?: Block[] };
interface HookHost {
  on(name: "agent/pre-step", listener: (event: unknown, next: () => Promise<Decision>) => Promise<Decision>): () => void;
  on(name: "tools/post-execute", listener: (exec: unknown, result: unknown, next: () => Promise<ToolDecision>) => Promise<ToolDecision>): () => void;
}

const MAX_RESOLVE = 500;
const MAX_IMPORT_VALUES = 20000;

function isText(block: Block): block is TextBlock {
  return block.type === "text" && typeof (block as TextBlock).text === "string";
}

export function apply(ctx: Context, config: Config = {}): void {
  const entities = (config.entities ?? DEFAULT_TEXT_ENTITIES).filter(kind => TEXT_ENTITIES.includes(kind));
  const vault = new Vault(config.persistVault === false ? undefined : VAULT_FILE, config.maxVaultEntries ?? 20000);
  const stats = { enabled: config.maskMessages !== false, replaced: 0, byKind: {} as Record<string, number> };
  let secret: Promise<Buffer> | undefined;
  let dictionaryText = "";
  let matcher: (text: string) => DictionaryMatch[] = () => [];
  function useDictionary(text: string): void {
    dictionaryText = text;
    matcher = compileDictionary(parseDictionary(text));
  }
  const dictionaryFile = config.dictionaryFile === undefined ? DICTIONARY_FILE : config.dictionaryFile || undefined;
  const dictionaryLoaded = loadDictionaryText(dictionaryFile).then(useDictionary, () => undefined);

  async function maskBlocks<T extends Block>(blocks: T[]): Promise<T[] | undefined> {
    let changed = false;
    const key = await (secret ??= loadOrCreateSecret());
    await Promise.all([vault.load(), dictionaryLoaded]);
    const out = blocks.map(block => {
      if (!isText(block)) return block;
      const result = maskText(block.text, entities, key, { dictionary: matcher });
      if (result.replaced === 0) return block;
      changed = true;
      vault.add(result.entries);
      stats.replaced += result.replaced;
      for (const placeholder of result.entries.keys()) {
        const kind = placeholder.slice(1, placeholder.lastIndexOf("_"));
        stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
      }
      return { ...block, text: result.text };
    });
    return changed ? out : undefined;
  }

  async function maskMessage(message: Message): Promise<Message> {
    if (typeof message.content === "string") {
      const masked = await maskBlocks([{ type: "text", text: message.content }]);
      return masked === undefined ? message : { ...message, content: (masked[0] as TextBlock).text };
    }
    if (!Array.isArray(message.content)) return message;
    const masked = await maskBlocks(message.content);
    return masked === undefined ? message : { ...message, content: masked };
  }

  const hooks = ctx as unknown as HookHost;
  // Runs after next() so text added by other pre-step plugins is masked too.
  ctx.effect(() => hooks.on("agent/pre-step", async (_event, next) => {
    const decision = await next();
    if (decision.kind !== "enter" || !stats.enabled) return decision;
    return { ...decision, messages: await Promise.all(decision.messages.map(maskMessage)) };
  }), "privacy-gateway: mask messages");

  if (config.maskToolResults === true) {
    ctx.effect(() => hooks.on("tools/post-execute", async (_exec, _result, next) => {
      const decision = await next();
      if (decision.kind !== "accept" || !stats.enabled || !Array.isArray(decision.content)) return decision;
      const masked = await maskBlocks(decision.content);
      return masked === undefined ? decision : { ...decision, content: masked };
    }), "privacy-gateway: mask tool results");
  }

  ctx.effect(() => ctx.connection.fetch.register({
    path: `${BASE}/mask/resolve`,
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        const body = await request.json() as { placeholders?: unknown };
        if (!Array.isArray(body.placeholders)) throw new Error("placeholders must be an array");
        await vault.load();
        const values: Record<string, string> = {};
        for (const placeholder of body.placeholders.slice(0, MAX_RESOLVE)) {
          if (typeof placeholder !== "string") continue;
          const value = vault.get(placeholder);
          if (value !== undefined) values[placeholder] = value;
        }
        return Response.json({ ok: true, values });
      } catch (error) {
        return jsonError(error);
      }
    },
  }), "privacy-gateway: resolve placeholders");

  ctx.effect(() => ctx.connection.fetch.register({
    path: `${BASE}/mask/dictionary`,
    methods: ["GET", "POST"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        await dictionaryLoaded;
        if (request.method === "POST") {
          const body = await request.json() as { terms?: unknown };
          if (typeof body.terms !== "string") throw new Error("terms must be a string");
          await saveDictionaryText(dictionaryFile, body.terms);
          useDictionary(body.terms);
        }
        return Response.json({ ok: true, terms: dictionaryText, entries: parseDictionary(dictionaryText) });
      } catch (error) {
        return jsonError(error);
      }
    },
  }), "privacy-gateway: word list");

  // Column values of an uploaded CSV/XLSX, so a customer list can be imported
  // into the word list. The file is parsed in memory and never stored.
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${BASE}/mask/columns`,
    methods: ["POST"],
    requestBody: "streaming",
    async fetch(request) {
      try {
        const fileName = fileNameOf(request);
        const document = await parseDocument(fileName, await readBytes(request));
        const columns = document.sheets.flatMap(sheet => sheet.headers.map((header, index) => {
          const values = new Set<string>();
          for (const row of sheet.rows) {
            const cell = row[index];
            const text = cell === null || cell === undefined ? "" : String(cell).trim();
            if (text.length > 0 && values.size < MAX_IMPORT_VALUES) values.add(text);
          }
          const name = header || `Column ${index + 1}`;
          return { name: document.sheets.length > 1 ? `${sheet.name} / ${name}` : name, values: [...values] };
        }));
        return Response.json({ ok: true, columns });
      } catch (error) {
        return jsonError(error);
      }
    },
  }), "privacy-gateway: import columns");

  ctx.effect(() => ctx.connection.fetch.register({
    path: `${BASE}/mask/status`,
    methods: ["GET", "POST"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        if (request.method === "POST") {
          const body = await request.json() as { enabled?: unknown; clear?: unknown };
          if (typeof body.enabled === "boolean") stats.enabled = body.enabled;
          if (body.clear === true) await vault.clear();
        }
        await vault.load();
        return Response.json({
          ok: true,
          enabled: stats.enabled,
          toolResults: config.maskToolResults === true,
          entities,
          replaced: stats.replaced,
          byKind: stats.byKind,
          vaultEntries: vault.size,
          placeholderPattern: PLACEHOLDER.source,
        });
      } catch (error) {
        return jsonError(error);
      }
    },
  }), "privacy-gateway: mask status");

  ctx.effect(() => ctx.connection.fetch.register({
    path: `${BASE}/scan`,
    methods: ["POST"],
    requestBody: "streaming",
    async fetch(request) {
      try {
        const fileName = fileNameOf(request);
        const document = await parseDocument(fileName, await readBytes(request));
        return Response.json({ ok: true, scan: buildScan(fileName, document) });
      } catch (error) {
        return jsonError(error);
      }
    },
  }), "privacy-gateway: scan route");

  ctx.effect(() => ctx.connection.fetch.register({
    path: `${BASE}/redact`,
    methods: ["POST"],
    requestBody: "streaming",
    async fetch(request) {
      try {
        const fileName = fileNameOf(request);
        const policyText = request.headers.get(POLICY_HEADER);
        const policies = policyText === null
          ? []
          : JSON.parse(decodeURIComponent(policyText)) as ColumnPolicy[];
        const document = await parseDocument(fileName, await readBytes(request));
        const scan = buildScan(fileName, document);
        const secret = await loadOrCreateSecret();
        const safe = redactDocument(document, scan, policies, secret);
        const body = await serializeDocument(safe);
        const safeName = fileName.replace(/(\.csv|\.xlsx)$/i, ".safe$1");
        const responseBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
        return new Response(responseBody, {
          status: 200,
          headers: {
            "content-type": document.format === "csv"
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "content-disposition": `attachment; filename="${safeName.replace(/"/g, "")}"`,
            "x-dpg-safe-name": encodeURIComponent(safeName),
          },
        });
      } catch (error) {
        return jsonError(error);
      }
    },
  }), "privacy-gateway: redact route");
}
