import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Keep the secret and vault out of the real home directory.
const home = mkdtempSync(join(tmpdir(), "dpg-"));
vi.mock("node:os", async original => ({ ...(await original<typeof import("node:os")>()), homedir: () => home }));

type Listener = (...args: any[]) => Promise<any>;
interface Route { path: string; fetch(request: Request): Promise<Response> }

function fakeContext() {
  const listeners = new Map<string, Listener>();
  const routes = new Map<string, Route>();
  const ctx = {
    effect(setup: () => unknown) { setup(); },
    on(name: string, listener: Listener) { listeners.set(name, listener); return () => listeners.delete(name); },
    connection: { fetch: { register(route: Route) { routes.set(route.path, route); return () => routes.delete(route.path); } } },
  };
  return { ctx, listeners, routes };
}

async function call(routes: Map<string, Route>, path: string, body?: object) {
  const route = routes.get(`/api/privacy-gateway/v1${path}`);
  if (route === undefined) throw new Error(`no route ${path}`);
  const request = new Request(`http://localhost/api/privacy-gateway/v1${path}`, body === undefined
    ? {}
    : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  return (await route.fetch(request)).json() as Promise<any>;
}

describe("host plugin", () => {
  let apply: typeof import("../src/index.js").apply;
  beforeAll(async () => ({ apply } = await import("../src/index.js")));

  it("masks pre-step messages and resolves the placeholders back", async () => {
    const { ctx, listeners, routes } = fakeContext();
    apply(ctx as any, { persistVault: false });
    const next = async () => ({
      kind: "enter",
      messages: [
        { role: "user", content: [{ type: "text", text: "给客户张三发邮件 zs@example.com，电话13812345678" }, { type: "image", data: "x" }] },
        { role: "user", content: "身份证 11010519491231002X" },
      ],
    });
    const decision = await listeners.get("agent/pre-step")!({}, next);
    const first = decision.messages[0].content[0].text as string;
    expect(first).not.toMatch(/张三|zs@example.com|13812345678/);
    expect(decision.messages[0].content[1]).toEqual({ type: "image", data: "x" });
    expect(decision.messages[1].content).toMatch(/^身份证 \[ID_CARD_[0-9A-F]{10}\]$/);

    const placeholders = [...first.matchAll(/\[[A-Z_]+_[0-9A-F]{10}\]/g)].map(m => m[0]);
    const resolved = await call(routes, "/mask/resolve", { placeholders: [...placeholders, "[PHONE_0000000000]"] });
    expect(Object.values(resolved.values).sort()).toEqual(["13812345678", "zs@example.com", "张三"].sort());
    expect(resolved.values["[PHONE_0000000000]"]).toBeUndefined();

    const status = await call(routes, "/mask/status");
    expect(status).toMatchObject({ enabled: true, replaced: 4, vaultEntries: 4, toolResults: false });
    expect(listeners.has("tools/post-execute")).toBe(false);
  });

  it("passes rejects through and honours the runtime switch", async () => {
    const { ctx, listeners, routes } = fakeContext();
    apply(ctx as any, { persistVault: false });
    const hook = listeners.get("agent/pre-step")!;
    expect(await hook({}, async () => ({ kind: "reject" }))).toEqual({ kind: "reject" });
    await call(routes, "/mask/status", { enabled: false });
    const message = { content: "电话13812345678" };
    const decision = await hook({}, async () => ({ kind: "enter", messages: [message] }));
    expect(decision.messages[0]).toBe(message);
  });

  it("masks tool results only when enabled", async () => {
    const { ctx, listeners } = fakeContext();
    apply(ctx as any, { persistVault: false, maskToolResults: true });
    const decision = await listeners.get("tools/post-execute")!({}, {}, async () => ({ kind: "accept", content: [{ type: "text", text: "name,phone\n王五先生,13900001111" }] }));
    expect(decision.content[0].text).toMatch(/^name,phone\n\[PERSON_[0-9A-F]{10}\]先生,\[PHONE_[0-9A-F]{10}\]$/);
  });

  it("saves the word list privately and masks listed terms", async () => {
    const { ctx, listeners, routes } = fakeContext();
    apply(ctx as any, { persistVault: false });
    const saved = await call(routes, "/mask/dictionary", { terms: "字节跳动有限公司\n星河计划" });
    expect(saved.entries).toEqual([{ term: "字节跳动有限公司", kind: "ORG" }, { term: "星河计划", kind: "TERM" }]);
    const { statSync } = await import("node:fs");
    expect(statSync(join(home, ".dsh-privacy-gateway", "dictionary.json")).mode & 0o777).toBe(0o600);
    const decision = await listeners.get("agent/pre-step")!({}, async () => ({ kind: "enter", messages: [{ content: "字节跳动有限公司的星河计划" }] }));
    expect(decision.messages[0].content).toMatch(/^\[ORG_[0-9A-F]{10}\]的\[TERM_[0-9A-F]{10}\]$/);
    // a second plugin instance reads the same list back from disk
    const again = fakeContext();
    apply(again.ctx as any, { persistVault: false });
    expect((await call(again.routes, "/mask/dictionary")).terms).toBe("字节跳动有限公司\n星河计划");
  });

  it("lists column values of an uploaded CSV for import", async () => {
    const { ctx, routes } = fakeContext();
    apply(ctx as any, { persistVault: false });
    const route = routes.get("/api/privacy-gateway/v1/mask/columns")!;
    const response = await route.fetch(new Request("http://localhost/x", {
      method: "POST",
      headers: { "x-dpg-file-name": "c.csv" },
      body: "客户名称,金额\n字节跳动有限公司,1\n腾讯科技有限公司,2\n字节跳动有限公司,3\n",
    }));
    const payload = await response.json() as any;
    expect(payload.columns[0]).toEqual({ name: "客户名称", values: ["字节跳动有限公司", "腾讯科技有限公司"] });
  });

  it("persists the vault with private permissions", async () => {
    const { ctx, listeners, routes } = fakeContext();
    apply(ctx as any, {});
    await listeners.get("agent/pre-step")!({}, async () => ({ kind: "enter", messages: [{ content: "邮箱 keep@example.com" }] }));
    await new Promise(resolve => setTimeout(resolve, 50));
    const { statSync, readFileSync } = await import("node:fs");
    const file = join(home, ".dsh-privacy-gateway", "vault.json");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(Object.values(JSON.parse(readFileSync(file, "utf8")))).toContain("keep@example.com");
    await call(routes, "/mask/status", { clear: true });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({});
  });
});
