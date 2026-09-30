/**
 * Display-layer restore. Messages are stored and sent in placeholder form; this
 * rewrites placeholder text nodes in place (nodeValue only, never adding or
 * removing nodes, so React's reconciliation is not disturbed) and marks the
 * restored ranges with a CSS highlight. When React re-renders a node back to
 * placeholder form, the observer sees the change and restores it again.
 */
const PATTERN = /\[(?:PERSON|PHONE|EMAIL|ID_CARD|BANK_CARD|IP)_[0-9A-F]{10}\]/g;
// Non-global twin for presence checks: test() on a /g regex moves lastIndex,
// and matchAll() starts its copy from there, silently skipping earlier matches.
const HAS_PLACEHOLDER = new RegExp(PATTERN.source);
const HIGHLIGHT = "dsh-privacy-restored";
const RESOLVE_BATCH = 200;
export function startRestore(resolveUrl) {
    const known = new Map();
    const missing = new Set();
    const pending = new Set();
    const originals = new WeakMap();
    let enabled = true;
    let scheduled = false;
    let inFlight = false;
    const registry = typeof CSS === "undefined" ? undefined : CSS.highlights;
    const Highlight = globalThis.Highlight;
    const highlight = registry !== undefined && Highlight !== undefined ? new Highlight() : undefined;
    if (highlight !== undefined)
        registry?.set(HIGHLIGHT, highlight);
    const style = document.createElement("style");
    style.textContent = `::highlight(${HIGHLIGHT}){background-color:rgba(46,160,67,.18);text-decoration:underline dotted rgba(46,160,67,.9)}`;
    document.head.append(style);
    function editable(node) {
        const parent = node.parentElement;
        return parent === null || parent.closest("textarea,input,[contenteditable=''],[contenteditable='true'],script,style") !== null;
    }
    function queue(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node;
            if (HAS_PLACEHOLDER.test(text.data) && !editable(text))
                pending.add(text);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
            return;
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        for (let current = walker.nextNode(); current !== null; current = walker.nextNode())
            queue(current);
    }
    function schedule() {
        if (scheduled || !enabled)
            return;
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
                body: JSON.stringify({ placeholders: batch }),
            });
            if (!response.ok)
                return;
            const payload = await response.json();
            for (const placeholder of batch) {
                const value = payload.values?.[placeholder];
                if (value === undefined)
                    missing.add(placeholder);
                else
                    known.set(placeholder, value);
            }
        }
    }
    async function flush() {
        if (inFlight)
            return schedule();
        const nodes = [...pending].filter(node => node.isConnected);
        pending.clear();
        const unknown = new Set();
        for (const node of nodes) {
            for (const match of node.data.matchAll(PATTERN)) {
                if (!known.has(match[0]) && !missing.has(match[0]))
                    unknown.add(match[0]);
            }
        }
        if (unknown.size > 0) {
            inFlight = true;
            try {
                await resolve([...unknown]);
            }
            catch {
                // Host unreachable: leave placeholders visible and retry on the next change.
            }
            finally {
                inFlight = false;
            }
        }
        if (!enabled)
            return;
        for (const node of nodes)
            apply(node);
    }
    function apply(node) {
        if (!node.isConnected)
            return;
        const source = node.data;
        const ranges = [];
        let out = "";
        let cursor = 0;
        for (const match of source.matchAll(PATTERN)) {
            const value = known.get(match[0]);
            if (value === undefined || match.index === undefined)
                continue;
            out += source.slice(cursor, match.index);
            ranges.push([out.length, out.length + value.length]);
            out += value;
            cursor = match.index + match[0].length;
        }
        if (ranges.length === 0)
            return;
        out += source.slice(cursor);
        silently(() => {
            originals.set(node, source);
            node.data = out;
        });
        if (highlight !== undefined) {
            for (const [start, end] of ranges) {
                const range = document.createRange();
                range.setStart(node, start);
                range.setEnd(node, end);
                highlight.add(range);
            }
        }
    }
    function handle(records) {
        for (const record of records) {
            if (record.type === "characterData") {
                // React rewrote the node; what we saved as its original is stale now.
                originals.delete(record.target);
                queue(record.target);
            }
            else {
                record.addedNodes.forEach(queue);
            }
        }
        if (pending.size > 0)
            schedule();
    }
    const observer = new MutationObserver(handle);
    /** Write without observing our own change, keeping records that arrived before it. */
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
    /** Put placeholder text back, e.g. when the user turns display restore off. */
    function revertAll() {
        handle(observer.takeRecords());
        observer.disconnect();
        pending.clear();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
            const original = originals.get(current);
            if (original !== undefined)
                current.data = original;
        }
        highlight?.clear();
    }
    observe();
    restoreAll();
    return {
        dispose() {
            enabled = false;
            revertAll();
            registry?.delete(HIGHLIGHT);
            style.remove();
        },
        setEnabled(next) {
            if (next === enabled)
                return;
            enabled = next;
            if (enabled) {
                observe();
                restoreAll();
            }
            else {
                revertAll();
            }
        },
    };
}
