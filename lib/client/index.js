import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
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
    return (_jsxs("div", { style: { padding: 16, fontFamily: "system-ui", overflow: "auto", height: "100%" }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "\uD83D\uDD12 Privacy Gateway" }), _jsx("p", { style: { opacity: 0.78, lineHeight: 1.45 }, children: "Process CSV/XLSX locally before AI sees the data. Raw values are not written to the conversation or logs." }), _jsx("input", { type: "file", accept: ".csv,.xlsx", disabled: busy, onChange: onFile }), _jsx("p", { style: { fontSize: 13, opacity: 0.75 }, children: message }), scan?.sheets.map(sheet => (_jsxs("div", { style: { marginTop: 18 }, children: [_jsx("strong", { children: sheet.name }), _jsxs("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 }, children: [sheet.rows, " data rows"] }), sheet.columns.map(column => (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8, alignItems: "center", margin: "6px 0" }, children: [_jsxs("div", { children: [_jsx("div", { children: column.name }), _jsxs("div", { style: { fontSize: 11, opacity: 0.65 }, children: [column.kind, " \u00B7 matched ", column.matchedValues, "/", column.nonEmptyValues] })] }), _jsxs("span", { style: { fontSize: 12 }, children: [Math.round(column.confidence * 100), "%"] }), _jsxs("select", { value: actions[key(sheet.name, column.index)] ?? column.recommendedAction, onChange: event => setActions(current => ({ ...current, [key(sheet.name, column.index)]: event.target.value })), children: [_jsx("option", { value: "KEEP", children: "KEEP" }), _jsx("option", { value: "MASK", children: "MASK" }), _jsx("option", { value: "TOKENIZE", children: "TOKENIZE" }), _jsx("option", { value: "REMOVE", children: "REMOVE" })] })] }, column.index)))] }, sheet.name))), scan !== null && (_jsx("button", { disabled: busy || file === null, onClick: () => void redact(), style: { marginTop: 18 }, children: "Create Safe Copy" }))] }));
}
export function apply(ctx) {
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
