// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startRestore, type RestoreHandle } from "../src/client/restore.js";

const VALUES: Record<string, string> = {
  "[PHONE_1A2B3C4D5E]": "13812345678",
  "[PERSON_0123456789]": "张三",
};

const settle = () => new Promise(resolve => setTimeout(resolve, 40));
let handle: RestoreHandle | undefined;
let calls: string[][];

beforeEach(() => {
  document.body.innerHTML = "";
  calls = [];
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 0));
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const { placeholders } = JSON.parse(String(init.body)) as { placeholders: string[] };
    calls.push(placeholders);
    const values = Object.fromEntries(placeholders.filter(p => p in VALUES).map(p => [p, VALUES[p]]));
    return new Response(JSON.stringify({ ok: true, values }), { status: 200 });
  }));
});

afterEach(() => {
  handle?.dispose();
  handle = undefined;
  vi.unstubAllGlobals();
});

describe("display restore", () => {
  it("restores placeholders already on the page and ones added later", async () => {
    document.body.innerHTML = "<p id=a>客户[PERSON_0123456789]的电话是[PHONE_1A2B3C4D5E]</p>";
    handle = startRestore("api/privacy-gateway/v1/mask/resolve");
    await settle();
    expect(document.getElementById("a")!.textContent).toBe("客户张三的电话是13812345678");

    const later = document.createElement("p");
    later.textContent = "再打给 [PHONE_1A2B3C4D5E]";
    document.body.append(later);
    await settle();
    expect(later.textContent).toBe("再打给 13812345678");
    // the second sighting is served from cache
    expect(calls).toHaveLength(1);
  });

  it("re-restores when a renderer rewrites the text node (streaming)", async () => {
    document.body.innerHTML = "<p id=a></p>";
    const text = document.createTextNode("");
    document.getElementById("a")!.append(text);
    handle = startRestore("x");
    text.data = "号码 [PHONE_1A2B";          // half a placeholder mid-stream
    await settle();
    expect(text.data).toBe("号码 [PHONE_1A2B");
    text.data = "号码 [PHONE_1A2B3C4D5E] 已确认";
    await settle();
    expect(text.data).toBe("号码 13812345678 已确认");
  });

  it("leaves unknown placeholders and editable fields alone", async () => {
    document.body.innerHTML = "<p id=a>[PHONE_FFFFFFFFFF]</p><textarea id=t>[PHONE_1A2B3C4D5E]</textarea><div contenteditable=true id=c>[PHONE_1A2B3C4D5E]</div>";
    handle = startRestore("x");
    await settle();
    expect(document.getElementById("a")!.textContent).toBe("[PHONE_FFFFFFFFFF]");
    expect((document.getElementById("t") as HTMLTextAreaElement).value).toBe("[PHONE_1A2B3C4D5E]");
    expect(document.getElementById("c")!.textContent).toBe("[PHONE_1A2B3C4D5E]");
    // an unknown placeholder is asked for once, not on every mutation
    document.getElementById("a")!.append(document.createTextNode(" [PHONE_FFFFFFFFFF]"));
    await settle();
    expect(calls.flat().filter(p => p === "[PHONE_FFFFFFFFFF]")).toHaveLength(1);
  });

  it("puts placeholders back when turned off and restores again when turned on", async () => {
    document.body.innerHTML = "<p id=a>[PERSON_0123456789]</p>";
    handle = startRestore("x");
    await settle();
    const p = document.getElementById("a")!;
    expect(p.textContent).toBe("张三");
    handle.setEnabled(false);
    expect(p.textContent).toBe("[PERSON_0123456789]");
    handle.setEnabled(true);
    await settle();
    expect(p.textContent).toBe("张三");
  });

  it("keeps placeholders visible when the host is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    document.body.innerHTML = "<p id=a>[PERSON_0123456789]</p>";
    handle = startRestore("x");
    await settle();
    expect(document.getElementById("a")!.textContent).toBe("[PERSON_0123456789]");
  });
});
