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
