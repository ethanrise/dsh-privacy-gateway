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
var import_react2 = require("react");

// src/client/restore.ts
var TOKEN = "(?:PERSON|PHONE|EMAIL|ID_CARD|BANK_CARD|IP|ORG|TERM)_[0-9A-F]{10}";
var PATTERN = new RegExp(`\\[(${TOKEN})\\]|(?<![A-Za-z0-9_])(${TOKEN})(?![A-Za-z0-9_])`, "g");
function keyOf(match) {
  return `[${match[1] ?? match[2]}]`;
}
var HAS_PLACEHOLDER = new RegExp(PATTERN.source);
var HIGHLIGHT = "dsh-privacy-restored";
var RESOLVE_BATCH = 200;
var LOCK = "\u{1F512}";
var IGNORE = "data-dpg-ignore";
var LABELS = {
  zh: { PERSON: "\u59D3\u540D", PHONE: "\u624B\u673A\u53F7", EMAIL: "\u90AE\u7BB1", ID_CARD: "\u8EAB\u4EFD\u8BC1\u53F7", BANK_CARD: "\u94F6\u884C\u5361\u53F7", IP: "IP \u5730\u5740", ORG: "\u516C\u53F8", TERM: "\u8BCD\u5E93\u8BCD\u6761", saw: "\u6A21\u578B\u770B\u5230\u7684", original: "\u5B9E\u9645\u5185\u5BB9", copyOriginal: "\u590D\u5236\u539F\u6587", copyPlaceholder: "\u590D\u5236\u5360\u4F4D\u7B26", copied: "\u5DF2\u590D\u5236", note: "\u539F\u6587\u53EA\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u6CA1\u6709\u53D1\u9001\u7ED9\u6A21\u578B\u3002" },
  en: { PERSON: "Name", PHONE: "Phone", EMAIL: "Email", ID_CARD: "ID card", BANK_CARD: "Bank card", IP: "IP address", ORG: "Company", TERM: "Word list term", saw: "Model saw", original: "Original", copyOriginal: "Copy original", copyPlaceholder: "Copy placeholder", copied: "Copied", note: "The original stays on this machine and was not sent to the model." }
};
function labels() {
  return document.documentElement.lang.toLowerCase().startsWith("zh") ? LABELS.zh : LABELS.en;
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
        const key2 = keyOf(match);
        if (!known.has(key2) && !missing.has(key2)) unknown.add(key2);
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
      const key2 = keyOf(match);
      const value = known.get(key2);
      if (value === void 0 || match.index === void 0) continue;
      out += source.slice(cursor, match.index);
      const start = out.length;
      out += LOCK + value;
      found.push({ start, end: out.length, placeholder: key2, value });
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

// src/client/i18n.ts
var import_react = require("react");
function currentLang() {
  const lang = typeof document === "undefined" ? "" : document.documentElement.lang;
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}
function useLang() {
  const [lang, setLang] = (0, import_react.useState)(currentLang);
  (0, import_react.useEffect)(() => {
    const observer = new MutationObserver(() => setLang(currentLang()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return lang;
}
var zh = {
  guideDescription: "\u5728\u672C\u5730\u8131\u654F\u5BF9\u8BDD\u548C CSV/XLSX \u4E2D\u7684\u654F\u611F\u4FE1\u606F\uFF0C\u518D\u4EA4\u7ED9 AI\u3002",
  openButton: "\u6253\u5F00 Privacy Gateway",
  maskTitle: "\u5BF9\u8BDD\u8131\u654F",
  maskIntro: "\u4F60\u6D88\u606F\u4E2D\u7684\u59D3\u540D\u3001\u624B\u673A\u53F7\u3001\u90AE\u7BB1\u3001\u8EAB\u4EFD\u8BC1\u53F7\u548C\u94F6\u884C\u5361\u53F7\uFF0C\u4F1A\u5728\u53D1\u7ED9\u6A21\u578B\u524D\u66FF\u6362\u6210 [PHONE_1A2B3C4D5E] \u8FD9\u6837\u7684\u5360\u4F4D\u7B26\u3002\u539F\u6587\u53EA\u4FDD\u5B58\u5728\u672C\u673A\u3002",
  maskEnabled: "\u53D1\u9001\u524D\u8131\u654F",
  showOriginals: "\u5728\u672C\u7A97\u53E3\u663E\u793A\u539F\u6587\uFF08\u5E26 \u{1F512} \u6807\u8BB0\uFF09",
  maskedThisRun: (count, kinds) => `\u672C\u6B21\u8FD0\u884C\u5DF2\u8131\u654F\uFF1A${count}${kinds ? `\uFF08${kinds}\uFF09` : ""}`,
  storedOriginals: (count) => `\u5DF2\u4FDD\u5B58\u7684\u539F\u6587\uFF1A${count} \u6761`,
  toolResultsOn: "\u5DE5\u5177\u7ED3\u679C\uFF1A\u5DF2\u8131\u654F",
  toolResultsOff: "\u5DE5\u5177\u7ED3\u679C\uFF1A\u672A\u8131\u654F\uFF08\u53EF\u5728\u63D2\u4EF6\u914D\u7F6E\u4E2D\u5F00\u542F maskToolResults\uFF09",
  forget: "\u6E05\u9664\u5DF2\u4FDD\u5B58\u7684\u539F\u6587",
  forgetConfirm: "\u786E\u5B9A\u6E05\u9664\u6240\u6709\u5DF2\u4FDD\u5B58\u7684\u539F\u6587\u5417\uFF1F\u5BF9\u8BDD\u4E2D\u5DF2\u6709\u7684\u5360\u4F4D\u7B26\u5C06\u65E0\u6CD5\u518D\u663E\u793A\u4E3A\u539F\u6587\u3002",
  statusFailed: "\u83B7\u53D6\u72B6\u6001\u5931\u8D25",
  wordTitle: "\u8131\u654F\u8BCD\u5E93",
  wordIntro: "\u4E00\u884C\u4E00\u4E2A\u8BCD\uFF1A\u516C\u53F8\u540D\u3001\u4EBA\u540D\u3001\u9879\u76EE\u4EE3\u53F7\u7B49\u3002\u6BCF\u4E2A\u8BCD\u7CBE\u786E\u5339\u914D\uFF0C\u5E76\u81EA\u52A8\u751F\u6210\u4E13\u5C5E\u5360\u4F4D\u7B26\u3002\u4EE5 # \u5F00\u5934\u7684\u884C\u662F\u6CE8\u91CA\u3002",
  wordPlaceholder: "\u5B57\u8282\u8DF3\u52A8\u6709\u9650\u516C\u53F8\n\u738B\u5C0F\u4E8C\n\u661F\u6CB3\u8BA1\u5212",
  shortWarning: (terms) => `\u8F83\u77ED\u7684\u8BCD\u53EF\u80FD\u8BEF\u4F24\u65E0\u5173\u6587\u5B57\uFF1A${terms}`,
  save: "\u4FDD\u5B58",
  importColumn: "\u4ECE CSV/XLSX \u5BFC\u5165\u4E00\u5217\uFF1A",
  addToList: "\u52A0\u5165\u8BCD\u5E93",
  cancel: "\u53D6\u6D88",
  saved: (count) => `\u5DF2\u4FDD\u5B58 ${count} \u4E2A\u8BCD\uFF0C\u5BF9\u4E4B\u540E\u53D1\u9001\u7684\u6D88\u606F\u751F\u6548\u3002`,
  added: (fresh, existing) => `\u5DF2\u52A0\u5165 ${fresh} \u4E2A\u8BCD\uFF08${existing} \u4E2A\u5DF2\u5B58\u5728\uFF09\uFF0C\u70B9\u51FB"\u4FDD\u5B58"\u540E\u751F\u6548\u3002`,
  inEffect: (count, kinds) => `\u751F\u6548\u4E2D\uFF1A${count} \u4E2A\u8BCD\uFF08${kinds}\uFF09`,
  kindLabel: { ORG: "\u516C\u53F8", PERSON: "\u4EBA\u540D", TERM: "\u8BCD\u6761", PHONE: "\u624B\u673A\u53F7", EMAIL: "\u90AE\u7BB1", ID_CARD: "\u8EAB\u4EFD\u8BC1", BANK_CARD: "\u94F6\u884C\u5361", IP: "IP", ADDRESS: "\u5730\u5740", UNKNOWN: "\u672A\u8BC6\u522B" },
  wordFailed: "\u8BCD\u5E93\u8BF7\u6C42\u5931\u8D25",
  importFailed: "\u5BFC\u5165\u5931\u8D25",
  sheetTitle: "\u8868\u683C\u5B89\u5168\u526F\u672C",
  sheetIntro: "\u5728 AI \u770B\u5230\u6570\u636E\u4E4B\u524D\uFF0C\u5148\u5728\u672C\u5730\u5904\u7406 CSV/XLSX\u3002\u539F\u59CB\u503C\u4E0D\u4F1A\u5199\u5165\u5BF9\u8BDD\u6216\u65E5\u5FD7\u3002",
  sheetIdle: "\u539F\u59CB\u6587\u4EF6\u53EA\u5728\u672C\u5730\u5904\u7406\uFF0C\u4E0D\u4F1A\u52A0\u5165 DSH \u5BF9\u8BDD\u3002",
  scanning: "\u6B63\u5728\u672C\u5730\u626B\u63CF\u2026",
  scanDone: "\u626B\u63CF\u5B8C\u6210\u3002\u8BF7\u68C0\u67E5\u6BCF\u5217\u7684\u5904\u7406\u65B9\u5F0F\uFF0C\u518D\u751F\u6210\u5B89\u5168\u526F\u672C\u3002",
  scanFailed: "\u626B\u63CF\u5931\u8D25",
  dataRows: (count) => `${count} \u884C\u6570\u636E`,
  matched: (kind, matched, total) => `${kind} \xB7 \u547D\u4E2D ${matched}/${total}`,
  createSafeCopy: "\u751F\u6210\u5B89\u5168\u526F\u672C",
  creating: "\u6B63\u5728\u751F\u6210\u5B89\u5168\u526F\u672C\u2026",
  created: (name) => `\u5DF2\u751F\u6210\u5B89\u5168\u526F\u672C\uFF1A${name}\u3002\u53EA\u5E94\u628A\u8FD9\u4EFD\u526F\u672C\u53D1\u7ED9 AI\u3002`,
  redactFailed: "\u8131\u654F\u5931\u8D25",
  actions: { KEEP: "\u4FDD\u7559", MASK: "\u6253\u7801", TOKENIZE: "\u4EE4\u724C\u5316", REMOVE: "\u5220\u9664" }
};
var en = {
  guideDescription: "Redact sensitive data in conversations and CSV/XLSX files locally before AI sees it.",
  openButton: "Open Privacy Gateway",
  maskTitle: "Conversation masking",
  maskIntro: "Names, phone numbers, emails, ID and bank card numbers in your messages are replaced with placeholders such as [PHONE_1A2B3C4D5E] before the model sees them. Originals stay on this machine.",
  maskEnabled: "Mask messages before sending",
  showOriginals: "Show originals in this window (marked with \u{1F512})",
  maskedThisRun: (count, kinds) => `Masked this run: ${count}${kinds ? ` (${kinds})` : ""}`,
  storedOriginals: (count) => `Stored originals: ${count}`,
  toolResultsOn: "Tool results: masked",
  toolResultsOff: "Tool results: not masked (enable maskToolResults in the plugin config)",
  forget: "Forget stored originals",
  forgetConfirm: "Forget every stored original? Placeholders already in conversations can no longer be shown as originals.",
  statusFailed: "status request failed",
  wordTitle: "Word list",
  wordIntro: "One term per line: company names, people, project code names. Each is matched exactly and masked with its own placeholder, generated automatically. Lines starting with # are comments.",
  wordPlaceholder: "ByteDance Ltd.\nJane Doe\nProject Nebula",
  shortWarning: (terms) => `Short terms can also mask unrelated text: ${terms}`,
  save: "Save",
  importColumn: "Import a column from CSV/XLSX: ",
  addToList: "Add to list",
  cancel: "Cancel",
  saved: (count) => `Saved ${count} terms. They apply to messages sent from now on.`,
  added: (fresh, existing) => `Added ${fresh} terms (${existing} already listed). Click Save to apply.`,
  inEffect: (count, kinds) => `In effect: ${count} terms (${kinds})`,
  kindLabel: { ORG: "company", PERSON: "name", TERM: "term", PHONE: "phone", EMAIL: "email", ID_CARD: "ID card", BANK_CARD: "bank card", IP: "IP", ADDRESS: "address", UNKNOWN: "unknown" },
  wordFailed: "word list request failed",
  importFailed: "import failed",
  sheetTitle: "Spreadsheet safe copy",
  sheetIntro: "Process CSV/XLSX locally before AI sees the data. Raw values are not written to the conversation or logs.",
  sheetIdle: "Raw files stay local and are never added to the DSH conversation.",
  scanning: "Scanning locally...",
  scanDone: "Scan complete. Review policies before creating a safe copy.",
  scanFailed: "scan failed",
  dataRows: (count) => `${count} data rows`,
  matched: (kind, matched, total) => `${kind} \xB7 matched ${matched}/${total}`,
  createSafeCopy: "Create Safe Copy",
  creating: "Creating safe copy...",
  created: (name) => `Safe copy created: ${name}. Only this copy should be sent to AI.`,
  redactFailed: "redaction failed",
  actions: { KEEP: "KEEP", MASK: "MASK", TOKENIZE: "TOKENIZE", REMOVE: "REMOVE" }
};
var STRINGS = { zh, en };
function useStrings() {
  return STRINGS[useLang()];
}

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var KIND = "privacy-gateway";
var TYPE_ID = "dsh-privacy-gateway";
var BASE = "api/privacy-gateway/v1";
var inject = ["slots", "sidebarRight", "sidebarRightTabs"];
var literal = (text) => () => text;
var errorText = (error) => literal(error instanceof Error ? error.message : String(error));
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
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? STRINGS[currentLang()].statusFailed);
  return payload;
}
function ConversationMaskSection() {
  const t = useStrings();
  const [status, setStatus] = (0, import_react2.useState)(null);
  const [showOriginals, setShowOriginals] = (0, import_react2.useState)(restoreWanted);
  const [error, setError] = (0, import_react2.useState)(null);
  function run(body) {
    maskRequest(body).then((next) => {
      setStatus(next);
      setError(null);
    }, (failure) => setError(failure instanceof Error ? failure.message : String(failure)));
  }
  (0, import_react2.useEffect)(() => run(), []);
  function toggleOriginals(next) {
    setShowOriginals(next);
    try {
      localStorage.setItem(RESTORE_KEY, next ? "on" : "off");
    } catch {
    }
    restore?.setEnabled(next);
  }
  function clearVault() {
    if (window.confirm(t.forgetConfirm)) run({ clear: true });
  }
  const kinds = status === null ? "" : Object.entries(status.byKind).map(([kind, count]) => `${t.kindLabel[kind] ?? kind} ${count}`).join(" \xB7 ");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: { borderBottom: "1px solid rgba(128,128,128,.25)", paddingBottom: 14, marginBottom: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 6px" }, children: t.maskTitle }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: "0 0 8px" }, children: t.maskIntro }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block", margin: "4px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: status?.enabled ?? false, disabled: status === null, onChange: (event) => run({ enabled: event.target.checked }) }),
      " ",
      t.maskEnabled
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "block", margin: "4px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: showOriginals, onChange: (event) => toggleOriginals(event.target.checked) }),
      " ",
      t.showOriginals
    ] }),
    status !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, opacity: 0.75, marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t.maskedThisRun(status.replaced, kinds) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t.storedOriginals(status.vaultEntries) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: status.toolResults ? t.toolResultsOn : t.toolResultsOff }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: { marginTop: 6 }, onClick: clearVault, children: t.forget })
    ] }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "#d33", marginTop: 6 }, children: error })
  ] });
}
var textareaStyle = { width: "100%", boxSizing: "border-box", minHeight: 120, fontFamily: "ui-monospace, monospace", fontSize: 12, resize: "vertical" };
function WordListSection() {
  const t = useStrings();
  const [saved, setSaved] = (0, import_react2.useState)(null);
  const [terms, setTerms] = (0, import_react2.useState)("");
  const [note, setNote] = (0, import_react2.useState)(null);
  const [columns, setColumns] = (0, import_react2.useState)(null);
  const [column, setColumn] = (0, import_react2.useState)(0);
  async function request(body) {
    try {
      const response = await fetch(`${BASE}/mask/dictionary`, body === void 0 ? { credentials: "include" } : { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? t.wordFailed);
      setSaved(payload);
      setTerms(payload.terms);
      const count = payload.entries.length;
      if (body !== void 0) setNote(() => (s) => s.saved(count));
    } catch (error) {
      setNote(() => errorText(error));
    }
  }
  (0, import_react2.useEffect)(() => void request(), []);
  async function pickImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === void 0) return;
    try {
      const response = await fetch(`${BASE}/mask/columns`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dpg-file-name": encodeURIComponent(file.name) },
        body: file
      });
      const payload = await response.json();
      if (!response.ok || payload.columns === void 0) throw new Error(payload.error ?? t.importFailed);
      setColumns(payload.columns);
      setColumn(0);
    } catch (error) {
      setNote(() => errorText(error));
    }
  }
  function addColumn() {
    const values = columns?.[column]?.values ?? [];
    const existing = new Set(terms.split(/\r?\n/).map((line) => line.trim().toLowerCase()));
    const fresh = values.filter((value) => !existing.has(value.toLowerCase()));
    setTerms((current) => [current.trimEnd(), ...fresh].filter(Boolean).join("\n"));
    setColumns(null);
    const existingCount = values.length - fresh.length;
    setNote(() => (s) => s.added(fresh.length, existingCount));
  }
  const dirty = saved !== null && terms !== saved.terms;
  const short = terms.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0 && line.length <= 2 && !line.startsWith("#"));
  const counts = (saved?.entries ?? []).reduce((all, entry) => ({ ...all, [entry.kind]: (all[entry.kind] ?? 0) + 1 }), {});
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: { borderBottom: "1px solid rgba(128,128,128,.25)", paddingBottom: 14, marginBottom: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 6px" }, children: t.wordTitle }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: "0 0 8px" }, children: t.wordIntro }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { style: textareaStyle, value: terms, onChange: (event) => setTerms(event.target.value), placeholder: t.wordPlaceholder }),
    short.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 11, color: "#c80", margin: "2px 0 6px" }, children: t.shortWarning(short.slice(0, 5).join("\u3001") + (short.length > 5 ? " \u2026" : "")) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: !dirty, onClick: () => void request({ terms }), children: t.save }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { fontSize: 12 }, children: [
        t.importColumn,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", accept: ".csv,.xlsx", onChange: (event) => void pickImport(event) })
      ] })
    ] }),
    columns !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 8, fontSize: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: column, onChange: (event) => setColumn(Number(event.target.value)), children: columns.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: index, children: [
        item.name,
        " (",
        item.values.length,
        ")"
      ] }, index)) }),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: addColumn, children: t.addToList }),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => setColumns(null), children: t.cancel }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { opacity: 0.7, marginTop: 4 }, children: [
        columns[column]?.values.slice(0, 5).join("\u3001"),
        (columns[column]?.values.length ?? 0) > 5 ? " \u2026" : ""
      ] })
    ] }),
    saved !== null && saved.entries.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.7, marginTop: 6 }, children: t.inEffect(saved.entries.length, Object.entries(counts).map(([kind, count]) => `${t.kindLabel[kind] ?? kind} ${count}`).join(" \xB7 ")) }),
    note !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.8, marginTop: 6 }, children: note(t) })
  ] });
}
function GatewayBody() {
  const t = useStrings();
  const [file, setFile] = (0, import_react2.useState)(null);
  const [scan, setScan] = (0, import_react2.useState)(null);
  const [actions, setActions] = (0, import_react2.useState)({});
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [message, setMessage] = (0, import_react2.useState)(() => (s) => s.sheetIdle);
  const policies = (0, import_react2.useMemo)(() => {
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
    setMessage(() => (s) => s.scanning);
    try {
      const response = await fetch(`${BASE}/scan`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dpg-file-name": encodeURIComponent(target.name) },
        body: target
      });
      const payload = await response.json();
      if (!response.ok || payload.scan === void 0) throw new Error(payload.error ?? t.scanFailed);
      setScan(payload.scan);
      const defaults = {};
      for (const sheet of payload.scan.sheets) {
        for (const column of sheet.columns) defaults[key(sheet.name, column.index)] = column.recommendedAction;
      }
      setActions(defaults);
      setMessage(() => (s) => s.scanDone);
    } catch (error) {
      setMessage(() => errorText(error));
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
    setMessage(() => (s) => s.creating);
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
        throw new Error(payload.error ?? t.redactFailed);
      }
      const blob = await response.blob();
      const safeName = decodeURIComponent(response.headers.get("x-dpg-safe-name") ?? "safe-output");
      safeDownload(blob, safeName);
      setMessage(() => (s) => s.created(safeName));
    } catch (error) {
      setMessage(() => errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 16, fontFamily: "system-ui", overflow: "auto", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { marginTop: 0 }, children: "\u{1F512} Privacy Gateway" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConversationMaskSection, {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WordListSection, {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: "0 0 6px" }, children: t.sheetTitle }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: "0 0 8px" }, children: t.sheetIntro }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", accept: ".csv,.xlsx", disabled: busy, onChange: onFile }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, opacity: 0.75 }, children: message(t) }),
    scan?.sheets.map((sheet) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 18 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: sheet.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 }, children: t.dataRows(sheet.rows) }),
      sheet.columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8, alignItems: "center", margin: "6px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: column.name }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 11, opacity: 0.65 }, children: t.matched(t.kindLabel[column.kind] ?? column.kind, column.matchedValues, column.nonEmptyValues) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 12 }, children: [
          Math.round(column.confidence * 100),
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            value: actions[key(sheet.name, column.index)] ?? column.recommendedAction,
            onChange: (event) => setActions((current) => ({ ...current, [key(sheet.name, column.index)]: event.target.value })),
            children: ["KEEP", "MASK", "TOKENIZE", "REMOVE"].map((action) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: action, children: t.actions[action] }, action))
          }
        )
      ] }, column.index))
    ] }, sheet.name)),
    scan !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { disabled: busy || file === null, onClick: () => void redact(), style: { marginTop: 18 }, children: t.createSafeCopy })
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
      description: () => STRINGS[currentLang()].guideDescription
    }]
  }), "privacy-gateway: tab type");
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
    { name: "sidebar.right.pane.tab", key: TYPE_ID },
    GatewayBody
  )), "privacy-gateway: tab body");
  ctx.effect(() => ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register(
    { name: "conversation.session.header.utilities", id: "privacy-gateway", order: 80 },
    function PrivacyButton() {
      const t = useStrings();
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { title: t.openButton, onClick: () => ctx.sidebarRight.openTab(KIND), children: "\u{1F512}" });
    }
  )), "privacy-gateway: header button");
}

    return module.exports;
  }
});
