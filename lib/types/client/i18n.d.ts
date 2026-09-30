/**
 * DSH's locale service mirrors the active UI language onto <html lang>
 * ("zh-CN" or "en"), while navigator.language reflects Electron's launch flag
 * and can stay "en-US" in a Chinese UI. Follow the attribute, live.
 */
export type Lang = "zh" | "en";
export declare function currentLang(): Lang;
export declare function useLang(): Lang;
declare const zh: {
    guideDescription: string;
    openButton: string;
    maskTitle: string;
    maskIntro: string;
    maskEnabled: string;
    showOriginals: string;
    maskedThisRun: (count: number, kinds: string) => string;
    storedOriginals: (count: number) => string;
    toolResultsOn: string;
    toolResultsOff: string;
    forget: string;
    forgetConfirm: string;
    statusFailed: string;
    wordTitle: string;
    wordIntro: string;
    wordPlaceholder: string;
    shortWarning: (terms: string) => string;
    save: string;
    importColumn: string;
    addToList: string;
    cancel: string;
    saved: (count: number) => string;
    added: (fresh: number, existing: number) => string;
    inEffect: (count: number, kinds: string) => string;
    kindLabel: Record<string, string>;
    wordFailed: string;
    importFailed: string;
    sheetTitle: string;
    sheetIntro: string;
    sheetIdle: string;
    scanning: string;
    scanDone: string;
    scanFailed: string;
    dataRows: (count: number) => string;
    matched: (kind: string, matched: number, total: number) => string;
    createSafeCopy: string;
    creating: string;
    created: (name: string) => string;
    redactFailed: string;
    actions: Record<string, string>;
};
export type Strings = typeof zh;
export declare const STRINGS: Record<Lang, Strings>;
export declare function useStrings(): Strings;
export {};
