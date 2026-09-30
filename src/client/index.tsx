import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar-right/client";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import { startRestore, type RestoreHandle } from "./restore.js";
import type { ColumnPolicy, PrivacyScan, RedactionAction } from "../core/types.js";

const KIND = "privacy-gateway";
const TYPE_ID = "dsh-privacy-gateway";
// Document-relative, like built-in DSH routes, so it works under a sub-path.
const BASE = "api/privacy-gateway/v1";

export const inject = ["slots", "sidebarRight", "sidebarRightTabs"] as const;

type ActionMap = Record<string, RedactionAction>;

function key(sheet: string, index: number): string {
  return `${sheet}:${index}`;
}

function safeDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface MaskStatus {
  enabled: boolean;
  toolResults: boolean;
  entities: string[];
  replaced: number;
  byKind: Record<string, number>;
  vaultEntries: number;
}

const RESTORE_KEY = "dsh-privacy-gateway:restore";
let restore: RestoreHandle | undefined;

function restoreWanted(): boolean {
  try {
    return localStorage.getItem(RESTORE_KEY) !== "off";
  } catch {
    return true;
  }
}

async function maskRequest(body?: object): Promise<MaskStatus> {
  const response = await fetch(`${BASE}/mask/status`, body === undefined
    ? { credentials: "include" }
    : { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as MaskStatus & { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? "status request failed");
  return payload;
}

function ConversationMaskSection(): ReactElement {
  const [status, setStatus] = useState<MaskStatus | null>(null);
  const [showOriginals, setShowOriginals] = useState(restoreWanted);
  const [error, setError] = useState<string | null>(null);

  function run(body?: object): void {
    maskRequest(body).then(next => {
      setStatus(next);
      setError(null);
    }, (failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
  }

  useEffect(() => run(), []);

  function toggleOriginals(next: boolean): void {
    setShowOriginals(next);
    try {
      localStorage.setItem(RESTORE_KEY, next ? "on" : "off");
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    restore?.setEnabled(next);
  }

  function clearVault(): void {
    if (window.confirm("Forget every stored original? Placeholders already in conversations can no longer be shown as originals.")) run({ clear: true });
  }

  const kinds = status === null ? "" : Object.entries(status.byKind).map(([kind, count]) => `${kind} ${count}`).join(" · ");
  return (
    <section style={{ borderBottom: "1px solid rgba(128,128,128,.25)", paddingBottom: 14, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 6px" }}>Conversation masking</h3>
      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: "0 0 8px" }}>
        Names, phone numbers, emails, ID and bank card numbers in your messages are replaced with placeholders
        such as [PHONE_1A2B3C4D5E] before the model sees them. Originals stay on this machine.
      </p>
      <label style={{ display: "block", margin: "4px 0" }}>
        <input type="checkbox" checked={status?.enabled ?? false} disabled={status === null} onChange={event => run({ enabled: event.target.checked })} />
        {" "}Mask messages before sending
      </label>
      <label style={{ display: "block", margin: "4px 0" }}>
        <input type="checkbox" checked={showOriginals} onChange={event => toggleOriginals(event.target.checked)} />
        {" "}Show originals in this window (highlighted)
      </label>
      {status !== null && (
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          <div>Masked this run: {status.replaced}{kinds ? ` (${kinds})` : ""}</div>
          <div>Stored originals: {status.vaultEntries}</div>
          <div>Tool results: {status.toolResults ? "masked" : "not masked (enable maskToolResults in the plugin config)"}</div>
          <button style={{ marginTop: 6 }} onClick={clearVault}>Forget stored originals</button>
        </div>
      )}
      {error !== null && <div style={{ fontSize: 12, color: "#d33", marginTop: 6 }}>{error}</div>}
    </section>
  );
}

interface WordList {
  terms: string;
  entries: Array<{ term: string; kind: string }>;
}

const KIND_LABEL: Record<string, string> = { ORG: "company", PERSON: "name", TERM: "term" };
const textareaStyle = { width: "100%", boxSizing: "border-box" as const, minHeight: 120, fontFamily: "ui-monospace, monospace", fontSize: 12, resize: "vertical" as const };

function WordListSection(): ReactElement {
  const [saved, setSaved] = useState<WordList | null>(null);
  const [terms, setTerms] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [columns, setColumns] = useState<Array<{ name: string; values: string[] }> | null>(null);
  const [column, setColumn] = useState(0);

  async function request(body?: object): Promise<void> {
    try {
      const response = await fetch(`${BASE}/mask/dictionary`, body === undefined
        ? { credentials: "include" }
        : { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as WordList & { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "word list request failed");
      setSaved(payload);
      setTerms(payload.terms);
      if (body !== undefined) setNote(`Saved ${payload.entries.length} terms. They apply to messages sent from now on.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => void request(), []);

  async function pickImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      const response = await fetch(`${BASE}/mask/columns`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dpg-file-name": encodeURIComponent(file.name) },
        body: file,
      });
      const payload = await response.json() as { ok: boolean; columns?: Array<{ name: string; values: string[] }>; error?: string };
      if (!response.ok || payload.columns === undefined) throw new Error(payload.error ?? "import failed");
      setColumns(payload.columns);
      setColumn(0);
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error));
    }
  }

  function addColumn(): void {
    const values = columns?.[column]?.values ?? [];
    const existing = new Set(terms.split(/\r?\n/).map(line => line.trim().toLowerCase()));
    const fresh = values.filter(value => !existing.has(value.toLowerCase()));
    setTerms(current => [current.trimEnd(), ...fresh].filter(Boolean).join("\n"));
    setColumns(null);
    setNote(`Added ${fresh.length} terms (${values.length - fresh.length} already listed). Click Save to apply.`);
  }

  const dirty = saved !== null && terms !== saved.terms;
  const short = terms.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && line.length <= 2 && !line.startsWith("#"));
  const counts = (saved?.entries ?? []).reduce<Record<string, number>>((all, entry) => ({ ...all, [entry.kind]: (all[entry.kind] ?? 0) + 1 }), {});

  return (
    <section style={{ borderBottom: "1px solid rgba(128,128,128,.25)", paddingBottom: 14, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 6px" }}>Word list</h3>
      <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: "0 0 8px" }}>
        One term per line: company names, people, project code names. Each is matched exactly and masked
        with its own placeholder, generated automatically. Lines starting with # are comments.
      </p>
      <textarea style={textareaStyle} value={terms} onChange={event => setTerms(event.target.value)} placeholder={"字节跳动有限公司\n王小二\n星河计划"} />
      {short.length > 0 && (
        <div style={{ fontSize: 11, color: "#c80", margin: "2px 0 6px" }}>
          Short terms can also mask unrelated text: {short.slice(0, 5).join("、")}{short.length > 5 ? " …" : ""}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <button disabled={!dirty} onClick={() => void request({ terms })}>Save</button>
        <label style={{ fontSize: 12 }}>
          Import a column from CSV/XLSX: <input type="file" accept=".csv,.xlsx" onChange={event => void pickImport(event)} />
        </label>
      </div>
      {columns !== null && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <select value={column} onChange={event => setColumn(Number(event.target.value))}>
            {columns.map((item, index) => <option key={index} value={index}>{item.name} ({item.values.length})</option>)}
          </select>
          {" "}
          <button onClick={addColumn}>Add to list</button>
          {" "}
          <button onClick={() => setColumns(null)}>Cancel</button>
          <div style={{ opacity: 0.7, marginTop: 4 }}>{columns[column]?.values.slice(0, 5).join("、")}{(columns[column]?.values.length ?? 0) > 5 ? " …" : ""}</div>
        </div>
      )}
      {saved !== null && saved.entries.length > 0 && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          In effect: {saved.entries.length} terms ({Object.entries(counts).map(([kind, count]) => `${KIND_LABEL[kind] ?? kind} ${count}`).join(" · ")})
        </div>
      )}
      {note !== null && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>{note}</div>}
    </section>
  );
}

function GatewayBody(): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [scan, setScan] = useState<PrivacyScan | null>(null);
  const [actions, setActions] = useState<ActionMap>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Raw files stay local and are never added to the DSH conversation.");

  const policies = useMemo<ColumnPolicy[]>(() => {
    if (scan === null) return [];
    return scan.sheets.flatMap(sheet =>
      sheet.columns.map(column => ({
        sheet: sheet.name,
        columnIndex: column.index,
        action: actions[key(sheet.name, column.index)] ?? column.recommendedAction,
        kind: column.kind,
      }))
    );
  }, [scan, actions]);

  async function runScan(target: File): Promise<void> {
    setBusy(true);
    setMessage("Scanning locally...");
    try {
      const response = await fetch(`${BASE}/scan`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dpg-file-name": encodeURIComponent(target.name) },
        body: target,
      });
      const payload = await response.json() as { ok: boolean; scan?: PrivacyScan; error?: string };
      if (!response.ok || payload.scan === undefined) throw new Error(payload.error ?? "scan failed");
      setScan(payload.scan);
      const defaults: ActionMap = {};
      for (const sheet of payload.scan.sheets) {
        for (const column of sheet.columns) defaults[key(sheet.name, column.index)] = column.recommendedAction;
      }
      setActions(defaults);
      setMessage("Scan complete. Review policies before creating a safe copy.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>): void {
    const target = event.target.files?.[0] ?? null;
    setFile(target);
    setScan(null);
    if (target !== null) void runScan(target);
  }

  async function redact(): Promise<void> {
    if (file === null) return;
    setBusy(true);
    setMessage("Creating safe copy...");
    try {
      const response = await fetch(`${BASE}/redact`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-dpg-file-name": encodeURIComponent(file.name),
          "x-dpg-policy": encodeURIComponent(JSON.stringify(policies)),
        },
        body: file,
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "redaction failed");
      }
      const blob = await response.blob();
      const safeName = decodeURIComponent(response.headers.get("x-dpg-safe-name") ?? "safe-output");
      safeDownload(blob, safeName);
      setMessage(`Safe copy created: ${safeName}. Only this copy should be sent to AI.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", overflow: "auto", height: "100%" }}>
      <h2 style={{ marginTop: 0 }}>🔒 Privacy Gateway</h2>
      <ConversationMaskSection />
      <WordListSection />
      <h3 style={{ margin: "0 0 6px" }}>Spreadsheet safe copy</h3>
      <p style={{ opacity: 0.78, lineHeight: 1.45 }}>
        Process CSV/XLSX locally before AI sees the data. Raw values are not written to the conversation or logs.
      </p>
      <input type="file" accept=".csv,.xlsx" disabled={busy} onChange={onFile} />
      <p style={{ fontSize: 13, opacity: 0.75 }}>{message}</p>

      {scan?.sheets.map(sheet => (
        <div key={sheet.name} style={{ marginTop: 18 }}>
          <strong>{sheet.name}</strong>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{sheet.rows} data rows</div>
          {sheet.columns.map(column => (
            <div key={column.index} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8, alignItems: "center", margin: "6px 0" }}>
              <div>
                <div>{column.name}</div>
                <div style={{ fontSize: 11, opacity: 0.65 }}>
                  {column.kind} · matched {column.matchedValues}/{column.nonEmptyValues}
                </div>
              </div>
              <span style={{ fontSize: 12 }}>{Math.round(column.confidence * 100)}%</span>
              <select
                value={actions[key(sheet.name, column.index)] ?? column.recommendedAction}
                onChange={event => setActions(current => ({ ...current, [key(sheet.name, column.index)]: event.target.value as RedactionAction }))}
              >
                <option value="KEEP">KEEP</option>
                <option value="MASK">MASK</option>
                <option value="TOKENIZE">TOKENIZE</option>
                <option value="REMOVE">REMOVE</option>
              </select>
            </div>
          ))}
        </div>
      ))}

      {scan !== null && (
        <button disabled={busy || file === null} onClick={() => void redact()} style={{ marginTop: 18 }}>
          Create Safe Copy
        </button>
      )}
    </div>
  );
}

export function apply(ctx: Context): void {
  ctx.effect(() => {
    restore = startRestore(`${BASE}/mask/resolve`);
    restore.setEnabled(restoreWanted());
    return () => {
      restore?.dispose();
      restore = undefined;
    };
  }, "privacy-gateway: display restore");

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TYPE_ID,
    kind: KIND,
    title: () => "Privacy Gateway",
    guide: [{
      id: "privacy-gateway",
      order: 40,
      title: () => "Privacy Gateway",
      description: () => "Redact sensitive CSV/XLSX data locally before sending a safe copy to AI.",
    }],
  }), "privacy-gateway: tab type");

  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
    { name: "sidebar.right.pane.tab", key: TYPE_ID },
    GatewayBody,
  )), "privacy-gateway: tab body");

  ctx.effect(() => ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register(
    { name: "conversation.session.header.utilities", id: "privacy-gateway", order: 80 },
    function PrivacyButton(): ReactElement {
      return (
        <button title="Open Privacy Gateway" onClick={() => ctx.sidebarRight.openTab(KIND)}>
          🔒
        </button>
      );
    },
  )), "privacy-gateway: header button");
}
