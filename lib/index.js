import { parseDocument, serializeDocument } from "./core/parser.js";
import { buildScan, redactDocument } from "./core/redactor.js";
import { loadOrCreateSecret } from "./core/tokenizer.js";
const BASE = "/api/privacy-gateway/v1";
const FILE_NAME_HEADER = "x-dpg-file-name";
const POLICY_HEADER = "x-dpg-policy";
export const inject = ["connection"];
function fileNameOf(request) {
    const encoded = request.headers.get(FILE_NAME_HEADER);
    if (encoded === null)
        throw new Error("missing x-dpg-file-name");
    return decodeURIComponent(encoded);
}
async function readBytes(request) {
    return new Uint8Array(await request.arrayBuffer());
}
function jsonError(error, status = 400) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status });
}
export function apply(ctx) {
    ctx.effect(() => ctx.connection.fetch.register({
        path: `${BASE}/scan`,
        methods: ["POST"],
        requestBody: "streaming",
        async fetch(request) {
            try {
                const fileName = fileNameOf(request);
                const document = await parseDocument(fileName, await readBytes(request));
                return Response.json({ ok: true, scan: buildScan(fileName, document) });
            }
            catch (error) {
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
                    : JSON.parse(decodeURIComponent(policyText));
                const document = await parseDocument(fileName, await readBytes(request));
                const scan = buildScan(fileName, document);
                const secret = await loadOrCreateSecret();
                const safe = redactDocument(document, scan, policies, secret);
                const body = await serializeDocument(safe);
                const safeName = fileName.replace(/(\.csv|\.xlsx)$/i, ".safe$1");
                const responseBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
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
            }
            catch (error) {
                return jsonError(error);
            }
        },
    }), "privacy-gateway: redact route");
}
