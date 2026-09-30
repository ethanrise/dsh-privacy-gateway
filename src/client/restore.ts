/**
 * Display-layer restore. Messages are stored and sent in placeholder form; this
 * rewrites placeholder text nodes in place (nodeValue only, never adding or
 * removing nodes, so React's reconciliation is not disturbed) and marks the
 * restored ranges with a CSS highlight. When React re-renders a node back to
 * placeholder form, the observer sees the change and restores it again.
 *
 * Each restored value is prefixed with a lock inside the same text node, and
 * clicking one opens a card (outside the conversation tree) showing the
 * placeholder the model saw next to the original.
 */
// Models often repeat a placeholder without its brackets (tables especially),
// so both "[PHONE_1A2B3C4D5E]" and a bare "PHONE_1A2B3C4D5E" are restored.
const TOKEN = "(?:PERSON|PHONE|EMAIL|ID_CARD|BANK_CARD|IP)_[0-9A-F]{10}";
const PATTERN = new RegExp(`\\[(${TOKEN})\\]|(?<![A-Za-z0-9_])(${TOKEN})(?![A-Za-z0-9_])`, "g");

/** Vault key for a match, which is always the bracketed form. */
function keyOf(match: RegExpMatchArray): string {
  return `[${match[1] ?? match[2]}]`;
}
// Non-global twin for presence checks: test() on a /g regex moves lastIndex,
// and matchAll() starts its copy from there, silently skipping earlier matches.
const HAS_PLACEHOLDER = new RegExp(PATTERN.source);
const HIGHLIGHT = "dsh-privacy-restored";
const RESOLVE_BATCH = 200;
export const LOCK = "\u{1F512}";
const IGNORE = "data-dpg-ignore";

interface Segment {
  readonly start: number;
  readonly end: number;
  readonly placeholder: string;
  readonly value: string;
}

const LABELS = {
  zh: { PERSON: "姓名", PHONE: "手机号", EMAIL: "邮箱", ID_CARD: "身份证号", BANK_CARD: "银行卡号", IP: "IP 地址", saw: "模型看到的", original: "实际内容", copyOriginal: "复制原文", copyPlaceholder: "复制占位符", copied: "已复制", note: "原文只保存在本机，没有发送给模型。" },
  en: { PERSON: "Name", PHONE: "Phone", EMAIL: "Email", ID_CARD: "ID card", BANK_CARD: "Bank card", IP: "IP address", saw: "Model saw", original: "Original", copyOriginal: "Copy original", copyPlaceholder: "Copy placeholder", copied: "Copied", note: "The original stays on this machine and was not sent to the model." },
};
type Labels = typeof LABELS.en;

function labels(): Labels {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? LABELS.zh : LABELS.en;
}

function kindOf(placeholder: string): keyof typeof LABELS.en {
  return placeholder.slice(1, placeholder.lastIndexOf("_")) as keyof typeof LABELS.en;
}

type HighlightRegistry = Map<string, unknown>;
type HighlightCtor = new (...ranges: Range[]) => { add(range: Range): void; clear(): void };

export interface RestoreHandle {
  dispose(): void;
  setEnabled(enabled: boolean): void;
}

export function startRestore(resolveUrl: string): RestoreHandle {
  const known = new Map<string, string>();
  const missing = new Set<string>();
  const pending = new Set<Text>();
  const originals = new WeakMap<Text, string>();
  const segments = new WeakMap<Text, Segment[]>();
  let card: HTMLElement | undefined;
  let enabled = true;
  let scheduled = false;
  let inFlight = false;

  const registry = typeof CSS === "undefined" ? undefined : (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  const Highlight = (globalThis as unknown as { Highlight?: HighlightCtor }).Highlight;
  const highlight = registry !== undefined && Highlight !== undefined ? new Highlight() : undefined;
  if (highlight !== undefined) registry?.set(HIGHLIGHT, highlight);
  const style = document.createElement("style");
  style.textContent = [
    `::highlight(${HIGHLIGHT}){background-color:rgba(46,160,67,.28);text-decoration:underline dotted rgba(46,160,67,.95)}`,
    `.dpg-card{position:fixed;z-index:2147483000;min-width:240px;max-width:360px;padding:12px 14px;border-radius:10px;font:13px/1.5 system-ui,sans-serif;`
      + `background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2328);border:1px solid rgba(128,128,128,.35);box-shadow:0 8px 24px rgba(0,0,0,.25)}`,
    `.dpg-card h4{margin:0 0 8px;font-size:13px}`,
    `.dpg-card dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 10px}`,
    `.dpg-card dt{opacity:.65}.dpg-card dd{margin:0;word-break:break-all;font-family:ui-monospace,monospace}`,
    `.dpg-card .dpg-actions{display:flex;gap:8px;margin-top:10px}`,
    `.dpg-card button{font:inherit;font-size:12px;padding:2px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;cursor:pointer}`,
    `.dpg-card p{margin:8px 0 0;font-size:11px;opacity:.6}`,
  ].join("\n");
  document.head.append(style);

  function editable(node: Node): boolean {
    const parent = node.parentElement;
    return parent === null || parent.closest(`textarea,input,[contenteditable=''],[contenteditable='true'],script,style,[${IGNORE}]`) !== null;
  }

  function queue(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (HAS_PLACEHOLDER.test(text.data) && !editable(text)) pending.add(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) queue(current);
  }

  function schedule(): void {
    if (scheduled || !enabled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      void flush();
    });
  }

  async function resolve(placeholders: string[]): Promise<void> {
    for (let i = 0; i < placeholders.length; i += RESOLVE_BATCH) {
      const batch = placeholders.slice(i, i + RESOLVE_BATCH);
      const response = await fetch(resolveUrl, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeholders: batch }),
      });
      if (!response.ok) return;
      const payload = await response.json() as { values?: Record<string, string> };
      for (const placeholder of batch) {
        const value = payload.values?.[placeholder];
        if (value === undefined) missing.add(placeholder);
        else known.set(placeholder, value);
      }
    }
  }

  async function flush(): Promise<void> {
    if (inFlight) return schedule();
    const nodes = [...pending].filter(node => node.isConnected);
    pending.clear();
    const unknown = new Set<string>();
    for (const node of nodes) {
      for (const match of node.data.matchAll(PATTERN)) {
        const key = keyOf(match);
        if (!known.has(key) && !missing.has(key)) unknown.add(key);
      }
    }
    if (unknown.size > 0) {
      inFlight = true;
      try {
        await resolve([...unknown]);
      } catch {
        // Host unreachable: leave placeholders visible and retry on the next change.
      } finally {
        inFlight = false;
      }
    }
    if (!enabled) return;
    for (const node of nodes) apply(node);
  }

  function apply(node: Text): void {
    if (!node.isConnected) return;
    const source = node.data;
    const found: Segment[] = [];
    let out = "";
    let cursor = 0;
    for (const match of source.matchAll(PATTERN)) {
      const key = keyOf(match);
      const value = known.get(key);
      if (value === undefined || match.index === undefined) continue;
      out += source.slice(cursor, match.index);
      const start = out.length;
      out += LOCK + value;
      found.push({ start, end: out.length, placeholder: key, value });
      cursor = match.index + match[0].length;
    }
    if (found.length === 0) return;
    out += source.slice(cursor);
    silently(() => {
      originals.set(node, source);
      segments.set(node, found);
      node.data = out;
    });
    if (highlight !== undefined) {
      for (const segment of found) {
        const range = document.createRange();
        range.setStart(node, segment.start);
        range.setEnd(node, segment.end);
        highlight.add(range);
      }
    }
  }

  function handle(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === "characterData") {
        // React rewrote the node; what we saved as its original is stale now.
        originals.delete(record.target as Text);
        segments.delete(record.target as Text);
        queue(record.target);
      } else {
        record.addedNodes.forEach(queue);
      }
    }
    if (pending.size > 0) schedule();
  }

  const observer = new MutationObserver(handle);

  /** Write without observing our own change, keeping records that arrived before it. */
  function silently(write: () => void): void {
    handle(observer.takeRecords());
    observer.disconnect();
    write();
    observe();
  }

  function observe(): void {
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function restoreAll(): void {
    queue(document.body);
    schedule();
  }

  /** Put placeholder text back, e.g. when the user turns display restore off. */
  function revertAll(): void {
    handle(observer.takeRecords());
    observer.disconnect();
    pending.clear();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
      const original = originals.get(current as Text);
      if (original !== undefined) (current as Text).data = original;
      segments.delete(current as Text);
    }
    highlight?.clear();
    closeCard();
  }

  function segmentAt(x: number, y: number): Segment | undefined {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    let node: Node | undefined;
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
    if (node === undefined || node.nodeType !== Node.TEXT_NODE) return undefined;
    // A caret sits between characters, so a click on the last character of a
    // segment reports offset === end; treat the end as inside.
    return segments.get(node as Text)?.find(segment => offset >= segment.start && offset <= segment.end);
  }

  function closeCard(): void {
    card?.remove();
    card = undefined;
  }

  function copyButton(text: string, label: string, done: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      void navigator.clipboard?.writeText(text).then(() => {
        button.textContent = done;
      }, () => undefined);
    });
    return button;
  }

  function openCard(segment: Segment, x: number, y: number): void {
    closeCard();
    const t = labels();
    const element = document.createElement("div");
    element.className = "dpg-card";
    element.setAttribute(IGNORE, "");
    element.setAttribute("role", "dialog");
    const title = document.createElement("h4");
    title.textContent = `${LOCK} ${t[kindOf(segment.placeholder)] ?? kindOf(segment.placeholder)}`;
    const list = document.createElement("dl");
    for (const [term, value] of [[t.saw, segment.placeholder], [t.original, segment.value]] as const) {
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

  function onClick(event: MouseEvent): void {
    if (card?.contains(event.target as Node)) return;
    if (window.getSelection()?.isCollapsed === false) return closeCard();
    const segment = segmentAt(event.clientX, event.clientY);
    if (segment === undefined) return closeCard();
    openCard(segment, event.clientX, event.clientY);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") closeCard();
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey);
  // User scrolling only: streaming replies auto-scroll the transcript, and a
  // scroll listener would close the card as soon as it opened.
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
    },
  };
}
