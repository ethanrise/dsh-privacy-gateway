import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { startRestore } from "./restore.js";
const KIND = "privacy-gateway";
const TYPE_ID = "dsh-privacy-gateway";
// Document-relative, like built-in DSH routes, so it works under a sub-path.
const BASE = "api/privacy-gateway/v1";
export const inject = ["slots", "sidebarRight", "sidebarRightTabs"];
function key(sheet, index) {
    return `${sheet}:${index}`;
}
function safeDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const RESTORE_KEY = "dsh-privacy-gateway:restore";
let restore;
function restoreWanted() {
    try {
        return localStorage.getItem(RESTORE_KEY) !== "off";
    }
    catch {
        return true;
    }
}
async function maskRequest(body) {
    const response = await fetch(`${BASE}/mask/status`, body === undefined
        ? { credentials: "include" }
        : { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? "status request failed");
    return payload;
}
function ConversationMaskSection() {
    const [status, setStatus] = useState(null);
    const [showOriginals, setShowOriginals] = useState(restoreWanted);
    const [error, setError] = useState(null);
    function run(body) {
        maskRequest(body).then(next => {
            setStatus(next);
            setError(null);
        }, (failure) => setError(failure instanceof Error ? failure.message : String(failure)));
    }
    useEffect(() => run(), []);
    function toggleOriginals(next) {
        setShowOriginals(next);
        try {
            localStorage.setItem(RESTORE_KEY, next ? "on" : "off");
        }
        catch {
            // storage blocked: the choice lasts for this page only
        }
        restore?.setEnabled(next);
    }
    function clearVault() {
        if (window.confirm("Forget every stored original? Placeholders already in conversations can no longer be shown as originals."))
            run({ clear: true });
    }
    const kinds = status === null ? "" : Object.entries(status.byKind).map(([kind, count]) => `${kind} ${count}`).join(" · ");
    return (_jsxs("section", { style: { borderBottom: "1px solid rgba(128,128,128,.25)", paddingBottom: 14, marginBottom: 14 }, children: [_jsx("h3", { style: { margin: "0 0 6px" }, children: "Conversation masking" }), _jsx("p", { style: { fontSize: 12, opacity: 0.75, lineHeight: 1.45, margin: "0 0 8px" }, children: "Names, phone numbers, emails, ID and bank card numbers in your messages are replaced with placeholders such as [PHONE_1A2B3C4D5E] before the model sees them. Originals stay on this machine." }), _jsxs("label", { style: { display: "block", margin: "4px 0" }, children: [_jsx("input", { type: "checkbox", checked: status?.enabled ?? false, disabled: status === null, onChange: event => run({ enabled: event.target.checked }) }), " ", "Mask messages before sending"] }), _jsxs("label", { style: { display: "block", margin: "4px 0" }, children: [_jsx("input", { type: "checkbox", checked: showOriginals, onChange: event => toggleOriginals(event.target.checked) }), " ", "Show originals in this window (highlighted)"] }), status !== null && (_jsxs("div", { style: { fontSize: 12, opacity: 0.75, marginTop: 6 }, children: [_jsxs("div", { children: ["Masked this run: ", status.replaced, kinds ? ` (${kinds})` : ""] }), _jsxs("div", { children: ["Stored originals: ", status.vaultEntries] }), _jsxs("div", { children: ["Tool results: ", status.toolResults ? "masked" : "not masked (enable maskToolResults in the plugin config)"] }), _jsx("button", { style: { marginTop: 6 }, onClick: clearVault, children: "Forget stored originals" })] })), error !== null && _jsx("div", { style: { fontSize: 12, color: "#d33", marginTop: 6 }, children: error })] }));
}
function GatewayBody() {
    const [file, setFile] = useState(null);
    const [scan, setScan] = useState(null);
    const [actions, setActions] = useState({});
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("Raw files stay local and are never added to the DSH conversation.");
    const policies = useMemo(() => {
        if (scan === null)
            return [];
        return scan.sheets.flatMap(sheet => sheet.columns.map(column => ({
            sheet: sheet.name,
            columnIndex: column.index,
            action: actions[key(sheet.name, column.index)] ?? column.recommendedAction,
            kind: column.kind,
        })));
    }, [scan, actions]);
    async function runScan(target) {
        setBusy(true);
        setMessage("Scanning locally...");
        try {
            const response = await fetch(`${BASE}/scan`, {
                method: "POST",
                credentials: "include",
                headers: { "x-dpg-file-name": encodeURIComponent(target.name) },
                body: target,
            });
            const payload = await response.json();
            if (!response.ok || payload.scan === undefined)
                throw new Error(payload.error ?? "scan failed");
            setScan(payload.scan);
            const defaults = {};
            for (const sheet of payload.scan.sheets) {
                for (const column of sheet.columns)
                    defaults[key(sheet.name, column.index)] = column.recommendedAction;
            }
            setActions(defaults);
            setMessage("Scan complete. Review policies before creating a safe copy.");
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        }
        finally {
            setBusy(false);
        }
    }
    function onFile(event) {
        const target = event.target.files?.[0] ?? null;
        setFile(target);
        setScan(null);
        if (target !== null)
            void runScan(target);
    }
    async function redact() {
        if (file === null)
            return;
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
                const payload = await response.json();
                throw new Error(payload.error ?? "redaction failed");
            }
            const blob = await response.blob();
            const safeName = decodeURIComponent(response.headers.get("x-dpg-safe-name") ?? "safe-output");
            safeDownload(blob, safeName);
            setMessage(`Safe copy created: ${safeName}. Only this copy should be sent to AI.`);
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { style: { padding: 16, fontFamily: "system-ui", overflow: "auto", height: "100%" }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "\uD83D\uDD12 Privacy Gateway" }), _jsx(ConversationMaskSection, {}), _jsx("h3", { style: { margin: "0 0 6px" }, children: "Spreadsheet safe copy" }), _jsx("p", { style: { opacity: 0.78, lineHeight: 1.45 }, children: "Process CSV/XLSX locally before AI sees the data. Raw values are not written to the conversation or logs." }), _jsx("input", { type: "file", accept: ".csv,.xlsx", disabled: busy, onChange: onFile }), _jsx("p", { style: { fontSize: 13, opacity: 0.75 }, children: message }), scan?.sheets.map(sheet => (_jsxs("div", { style: { marginTop: 18 }, children: [_jsx("strong", { children: sheet.name }), _jsxs("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 }, children: [sheet.rows, " data rows"] }), sheet.columns.map(column => (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8, alignItems: "center", margin: "6px 0" }, children: [_jsxs("div", { children: [_jsx("div", { children: column.name }), _jsxs("div", { style: { fontSize: 11, opacity: 0.65 }, children: [column.kind, " \u00B7 matched ", column.matchedValues, "/", column.nonEmptyValues] })] }), _jsxs("span", { style: { fontSize: 12 }, children: [Math.round(column.confidence * 100), "%"] }), _jsxs("select", { value: actions[key(sheet.name, column.index)] ?? column.recommendedAction, onChange: event => setActions(current => ({ ...current, [key(sheet.name, column.index)]: event.target.value })), children: [_jsx("option", { value: "KEEP", children: "KEEP" }), _jsx("option", { value: "MASK", children: "MASK" }), _jsx("option", { value: "TOKENIZE", children: "TOKENIZE" }), _jsx("option", { value: "REMOVE", children: "REMOVE" })] })] }, column.index)))] }, sheet.name))), scan !== null && (_jsx("button", { disabled: busy || file === null, onClick: () => void redact(), style: { marginTop: 18 }, children: "Create Safe Copy" }))] }));
}
export function apply(ctx) {
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
    ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: TYPE_ID }, GatewayBody)), "privacy-gateway: tab body");
    ctx.effect(() => ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({ name: "conversation.session.header.utilities", id: "privacy-gateway", order: 80 }, function PrivacyButton() {
        return (_jsx("button", { title: "Open Privacy Gateway", onClick: () => ctx.sidebarRight.openTab(KIND), children: "\uD83D\uDD12" }));
    })), "privacy-gateway: header button");
}
