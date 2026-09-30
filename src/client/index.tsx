import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar-right/client";
import { useMemo, useState, type ChangeEvent, type ReactElement } from "react";
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
