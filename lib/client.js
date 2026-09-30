window.__ModuleLoader__.load({
  id: "dsh-privacy-gateway",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/restore.ts
var PATTERN = /\[(?:PERSON|PHONE|EMAIL|ID_CARD|BANK_CARD|IP)_[0-9A-F]{10}\]/g;
var HAS_PLACEHOLDER = new RegExp(PATTERN.source);
var HIGHLIGHT = "dsh-privacy-restored";
var RESOLVE_BATCH = 200;
var LOCK = "\u{1F512}";
var IGNORE = "data-dpg-ignore";
var LABELS = {
  zh: { PERSON: "\u59D3\u540D", PHONE: "\u624B\u673A\u53F7", EMAIL: "\u90AE\u7BB1", ID_CARD: "\u8EAB\u4EFD\u8BC1\u53F7", BANK_CARD: "\u94F6\u884C\u5361\u53F7", IP: "IP \u5730\u5740", saw: "\u6A21\u578B\u770B\u5230\u7684", original: "\u5B9E\u9645\u5185\u5BB9", copyOriginal: "\u590D\u5236\u539F\u6587", copyPlaceholder: "\u590D\u5236\u5360\u4F4D\u7B26", copied: "\u5DF2\u590D\u5236", note: "\u539F\u6587\u53EA\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u6CA1\u6709\u53D1\u9001\u7ED9\u6A21\u578B\u3002" },
  en: { PERSON: "Name", PHONE: "Phone", EMAIL: "Email", ID_CARD: "ID card", BANK_CARD: "Bank card", IP: "IP address", saw: "Model saw", original: "Original", copyOriginal: "Copy original", copyPlaceholder: "Copy placeholder", copied: "Copied", note: "The original stays on this machine and was not sent to the model." }
};
function labels() {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? LABELS.zh : LABELS.en;
}
function kindOf(placeholder) {
  return placeholder.slice(1, placeholder.lastIndexOf("_"));
}
function startRestore(resolveUrl) {
  const known = /* @__PURE__ */ new Map();
  const missing = /* @__PURE__ */ new Set();
  const pending = /* @__PURE__ */ new Set();
  const originals = /* @__PURE__ */ new WeakMap();
  const segments = /* @__PURE__ */ new WeakMap();
  let card;
  let enabled = true;
  let scheduled = false;
  let inFlight = false;
  const registry = typeof CSS === "undefined" ? void 0 : CSS.highlights;
  const Highlight = globalThis.Highlight;
  const highlight = registry !== void 0 && Highlight !== void 0 ? new Highlight() : void 0;
  if (highlight !== void 0) registry?.set(HIGHLIGHT, highlight);
  const style = document.createElement("style");
  style.textContent = [
    `::highlight(${HIGHLIGHT}){background-color:rgba(46,160,67,.28);text-decoration:underline dotted rgba(46,160,67,.95)}`,
    `.dpg-card{position:fixed;z-index:2147483000;min-width:240px;max-width:360px;padding:12px 14px;border-radius:10px;font:13px/1.5 system-ui,sans-serif;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2328);border:1px solid rgba(128,128,128,.35);box-shadow:0 8px 24px rgba(0,0,0,.25)}`,
    `.dpg-card h4{margin:0 0 8px;font-size:13px}`,
    `.dpg-card dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 10px}`,
    `.dpg-card dt{opacity:.65}.dpg-card dd{margin:0;word-break:break-all;font-family:ui-monospace,monospace}`,
    `.dpg-card .dpg-actions{display:flex;gap:8px;margin-top:10px}`,
    `.dpg-card button{font:inherit;font-size:12px;padding:2px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;cursor:pointer}`,
    `.dpg-card p{margin:8px 0 0;font-size:11px;opacity:.6}`
  ].join("\n");
  document.head.append(style);
  function editable(node) {
    const parent = node.parentElement;
    return parent === null || parent.closest(`textarea,input,[contenteditable=''],[contenteditable='true'],script,style,[${IGNORE}]`) !== null;
  }
  function queue(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node;
      if (HAS_PLACEHOLDER.test(text.data) && !editable(text)) pending.add(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) queue(current);
  }
  function schedule() {
    if (scheduled || !enabled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      void flush();
    });
  }
  async function resolve(placeholders) {
    for (let i = 0; i < placeholders.length; i += RESOLVE_BATCH) {
      const batch = placeholders.slice(i, i + RESOLVE_BATCH);
      const response = await fetch(resolveUrl, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeholders: batch })
      });
      if (!response.ok) return;
      const payload = await response.json();
      for (const placeholder of batch) {
        const value = payload.values?.[placeholder];
        if (value === void 0) missing.add(placeholder);
        else known.set(placeholder, value);
      }
    }
  }
  async function flush() {
    if (inFlight) return schedule();
    const nodes = [...pending].filter((node) => node.isConnected);
    pending.clear();
    const unknown = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      for (const match of node.data.matchAll(PATTERN)) {
        if (!known.has(match[0]) && !missing.has(match[0])) unknown.add(match[0]);
      }
    }
    if (unknown.size > 0) {
      inFlight = true;
      try {
        await resolve([...unknown]);
      } catch {
      } finally {
        inFlight = false;
      }
    }
    if (!enabled) return;
    for (const node of nodes) apply2(node);
  }
  function apply2(node) {
    if (!node.isConnected) return;
    const source = node.data;
    const found = [];
    let out = "";
    let cursor = 0;
    for (const match of source.matchAll(PATTERN)) {
      const value = known.get(match[0]);
      if (value === void 0 || match.index === void 0) continue;
      out += source.slice(cursor, match.index);
      const start = out.length;
      out += LOCK + value;
      found.push({ start, end: out.length, placeholder: match[0], value });
      cursor = match.index + match[0].length;
    }
    if (found.length === 0) return;
    out += source.slice(cursor);
    silently(() => {
      originals.set(node, source);
      segments.set(node, found);
      node.data = out;
    });
    if (highlight !== void 0) {
      for (const segment of found) {
        const range = document.createRange();
        range.setStart(node, segment.start);
        range.setEnd(node, segment.end);
        highlight.add(range);
      }
    }
  }
  function handle(records) {
    for (const record of records) {
      if (record.type === "characterData") {
        originals.delete(record.target);
        segments.delete(record.target);
        queue(record.target);
      } else {
        record.addedNodes.forEach(queue);
      }
    }
    if (pending.size > 0) schedule();
  }
  const observer = new MutationObserver(handle);
  function silently(write) {
    handle(observer.takeRecords());
    observer.disconnect();
    write();
    observe();
  }
  function observe() {
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  function restoreAll() {
    queue(document.body);
    schedule();
  }
  function revertAll() {
    handle(observer.takeRecords());
    observer.disconnect();
    pending.clear();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
      const original = originals.get(current);
      if (original !== void 0) current.data = original;
      segments.delete(current);
    }
    highlight?.clear();
    closeCard();
  }
  function segmentAt(x, y) {
    const doc = document;
    let node;
    let offset = 0;
    const position = doc.caretPositionFromPoint?.(x, y);
    if (position) {
      node = position.offsetNode;
      offset = position.offset;
    } else {
      const range = doc.caretRangeFromPoint?.(x, y);
      if (range) {
        node = range.startContainer;
        offset = range.startOffset;
      }
    }
    if (node === void 0 || node.nodeType !== Node.TEXT_NODE) return void 0;
    return segments.get(node)?.find((segment) => offset >= segment.start && offset <= segment.end);
  }
  function closeCard() {
    card?.remove();
    card = void 0;
  }
  function copyButton(text, label, done) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      void navigator.clipboard?.writeText(text).then(() => {
        button.textContent = done;
      }, () => void 0);
    });
    return button;
  }
  function openCard(segment, x, y) {
    closeCard();
    const t = labels();
    const element = document.createElement("div");
    element.className = "dpg-card";
    element.setAttribute(IGNORE, "");
    element.setAttribute("role", "dialog");
    const title = document.createElement("h4");
    title.textContent = `${LOCK} ${t[kindOf(segment.placeholder)] ?? kindOf(segment.placeholder)}`;
    const list = document.createElement("dl");
    for (const [term, value] of [[t.saw, segment.placeholder], [t.original, segment.value]]) {
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = value;
      list.append(dt, dd);
    }
    const actions = document.createElement("div");
    actions.className = "dpg-actions";
    actions.append(copyButton(segment.value, t.copyOriginal, t.copied), copyButton(segment.placeholder, t.copyPlaceholder, t.copied));
    const note = document.createElement("p");
    note.textContent = t.note;
    element.append(title, list, actions, note);
    document.body.append(element);
    const width = element.offsetWidth || 280;
    const height = element.offsetHeight || 140;
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
    element.style.top = `${y + 14 + height > window.innerHeight ? Math.max(8, y - height - 10) : y + 14}px`;
    card = element;
  }
  function onClick(event) {
    if (card?.contains(event.target)) return;
    if (window.getSelection()?.isCollapsed === false) return closeCard();
    const segment = segmentAt(event.clientX, event.clientY);
    if (segment === void 0) return closeCard();
    openCard(segment, event.clientX, event.clientY);
  }
  function onKey(event) {
    if (event.key === "Escape") closeCard();
  }
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey);
  window.addEventListener("wheel", closeCard, { capture: true, passive: true });
  window.addEventListener("touchmove", closeCard, { capture: true, passive: true });
  observe();
  restoreAll();
  return {
    dispose() {
      enabled = false;
      revertAll();
      registry?.delete(HIGHLIGHT);
      style.remove();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", closeCard, true);
      window.removeEventListener("touchmove", closeCard, true);
    },
    setEnabled(next) {
      if (next === enabled) return;
      enabled = next;
      if (enabled) {
        observe();
        restoreAll();
      } else {
        revertAll();
      }
    }
  };
}

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var KIND = "privacy-gateway";
var TYPE_ID = "dsh-privacy-gateway";
var BASE = "api/privacy-gateway/v1";
var inject = ["slots", "sidebarRight", "sidebarRightTabs"];
function key(sheet, index) {
  return `${sheet}:${index}`;
}
function safeDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
var RESTORE_KEY = "dsh-privacy-gateway:restore";
var restore;
function restoreWanted() {
  try {
    return localStorage.getItem(RESTORE_KEY) !== "off";
  } catch {
    return true;
  }
}
async function maskRequest(body) {
  const response = await fetch(`${BASE}/mask/status`, body === void 0 ? { credentials: "include" } : { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? "status request failed");
  return payload;
}
function ConversationMaskSection() {
  const [status, setStatus] = (0, import_react.useState)(null);
  const [showOriginals, setShowOriginals] = (0, import_react.useState)(restoreWanted);
  const [error, setError] = (0, import_react.useState)(null);
  function run(body) {
    maskRequest(body).then((next) => {
      setStatus(next);
      setError(null);
    }, (failure) => setError(failure instanceof Error ? failure.message : String(failure)));
  }
  (0, import_react.useEffect)(() => run(), []);
  function toggleOriginals(next) {
    setShowOriginals(next);
    try {
      localStorage.setItem(RESTORE_KEY, next ? "on" : "off");
    } catch {
    }
    restore?.setEnabled(next);
  }
  function clearVault() {
    if (window.confirm("Forget every stored original? Placeholders already in conversations can no longer be shown as originals.")) run({ clear: true });
  }
  const kinds = status === null ? "" : Object.entries(status.byKind).map(([kind, count]) => `${kind} ${count}`).join(" \xB7 ");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: { borderBottom: "1px solid rgba(128,128,128,.25)", paddingBottom: 14, marginBottom: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 6px" }, children: "Conversation masking" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: "0 0 8px" }, children: "Names, phone numbers, emails, ID and bank card numbers in your messages are replaced with placeholders such as [PHONE_1A2B3C4D5E] before the model sees them. Originals stay on this machine." }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block", margin: "4px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: status?.enabled ?? false, disabled: status === null, onChange: (event) => run({ enabled: event.target.checked }) }),
      " ",
      "Mask messages before sending"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block", margin: "4px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: showOriginals, onChange: (event) => toggleOriginals(event.target.checked) }),
      " ",
      "Show originals in this window (highlighted)"
    ] }),
    status !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, opacity: 0.75, marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        "Masked this run: ",
        status.replaced,
        kinds ? ` (${kinds})` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        "Stored originals: ",
        status.vaultEntries
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        "Tool results: ",
        status.toolResults ? "masked" : "not masked (enable maskToolResults in the plugin config)"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { marginTop: 6 }, onClick: clearVault, children: "Forget stored originals" })
    ] }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "#d33", marginTop: 6 }, children: error })
  ] });
}
function GatewayBody() {
  const [file, setFile] = (0, import_react.useState)(null);
  const [scan, setScan] = (0, import_react.useState)(null);
  const [actions, setActions] = (0, import_react.useState)({});
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [message, setMessage] = (0, import_react.useState)("Raw files stay local and are never added to the DSH conversation.");
  const policies = (0, import_react.useMemo)(() => {
    if (scan === null) return [];
    return scan.sheets.flatMap(
      (sheet) => sheet.columns.map((column) => ({
        sheet: sheet.name,
        columnIndex: column.index,
        action: actions[key(sheet.name, column.index)] ?? column.recommendedAction,
        kind: column.kind
      }))
    );
  }, [scan, actions]);
  async function runScan(target) {
    setBusy(true);
    setMessage("Scanning locally...");
    try {
      const response = await fetch(`${BASE}/scan`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dpg-file-name": encodeURIComponent(target.name) },
        body: target
      });
      const payload = await response.json();
      if (!response.ok || payload.scan === void 0) throw new Error(payload.error ?? "scan failed");
      setScan(payload.scan);
      const defaults = {};
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
  function onFile(event) {
    const target = event.target.files?.[0] ?? null;
    setFile(target);
    setScan(null);
    if (target !== null) void runScan(target);
  }
  async function redact() {
    if (file === null) return;
    setBusy(true);
    setMessage("Creating safe copy...");
    try {
      const response = await fetch(`${BASE}/redact`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-dpg-file-name": encodeURIComponent(file.name),
          "x-dpg-policy": encodeURIComponent(JSON.stringify(policies))
        },
        body: file
      });
      if (!response.ok) {
        const payload = await response.json();
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 16, fontFamily: "system-ui", overflow: "auto", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { marginTop: 0 }, children: "\u{1F512} Privacy Gateway" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConversationMaskSection, {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 6px" }, children: "Spreadsheet safe copy" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.78, lineHeight: 1.45 }, children: "Process CSV/XLSX locally before AI sees the data. Raw values are not written to the conversation or logs." }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", accept: ".csv,.xlsx", disabled: busy, onChange: onFile }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 13, opacity: 0.75 }, children: message }),
    scan?.sheets.map((sheet) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 18 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: sheet.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 }, children: [
        sheet.rows,
        " data rows"
      ] }),
      sheet.columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8, alignItems: "center", margin: "6px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: column.name }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 11, opacity: 0.65 }, children: [
            column.kind,
            " \xB7 matched ",
            column.matchedValues,
            "/",
            column.nonEmptyValues
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 12 }, children: [
          Math.round(column.confidence * 100),
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "select",
          {
            value: actions[key(sheet.name, column.index)] ?? column.recommendedAction,
            onChange: (event) => setActions((current) => ({ ...current, [key(sheet.name, column.index)]: event.target.value })),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "KEEP", children: "KEEP" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "MASK", children: "MASK" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "TOKENIZE", children: "TOKENIZE" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "REMOVE", children: "REMOVE" })
            ]
          }
        )
      ] }, column.index))
    ] }, sheet.name)),
    scan !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy || file === null, onClick: () => void redact(), style: { marginTop: 18 }, children: "Create Safe Copy" })
  ] });
}
function apply(ctx) {
  ctx.effect(() => {
    restore = startRestore(`${BASE}/mask/resolve`);
    restore.setEnabled(restoreWanted());
    return () => {
      restore?.dispose();
      restore = void 0;
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
      description: () => "Redact sensitive CSV/XLSX data locally before sending a safe copy to AI."
    }]
  }), "privacy-gateway: tab type");
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
    { name: "sidebar.right.pane.tab", key: TYPE_ID },
    GatewayBody
  )), "privacy-gateway: tab body");
  ctx.effect(() => ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register(
    { name: "conversation.session.header.utilities", id: "privacy-gateway", order: 80 },
    function PrivacyButton() {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { title: "Open Privacy Gateway", onClick: () => ctx.sidebarRight.openTab(KIND), children: "\u{1F512}" });
    }
  )), "privacy-gateway: header button");
}

    return module.exports;
  }
});
