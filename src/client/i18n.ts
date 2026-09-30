import { useEffect, useState } from "react";

/**
 * DSH's locale service mirrors the active UI language onto <html lang>
 * ("zh-CN" or "en"), while navigator.language reflects Electron's launch flag
 * and can stay "en-US" in a Chinese UI. Follow the attribute, live.
 */
export type Lang = "zh" | "en";

export function currentLang(): Lang {
  const lang = typeof document === "undefined" ? "" : document.documentElement.lang;
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function useLang(): Lang {
  const [lang, setLang] = useState(currentLang);
  useEffect(() => {
    const observer = new MutationObserver(() => setLang(currentLang()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return lang;
}

const zh = {
  guideDescription: "在本地脱敏对话和 CSV/XLSX 中的敏感信息，再交给 AI。",
  openButton: "打开 Privacy Gateway",

  maskTitle: "对话脱敏",
  maskIntro: "你消息中的姓名、手机号、邮箱、身份证号和银行卡号，会在发给模型前替换成 [PHONE_1A2B3C4D5E] 这样的占位符。原文只保存在本机。",
  maskEnabled: "发送前脱敏",
  showOriginals: "在本窗口显示原文（带 🔒 标记）",
  maskedThisRun: (count: number, kinds: string) => `本次运行已脱敏：${count}${kinds ? `（${kinds}）` : ""}`,
  storedOriginals: (count: number) => `已保存的原文：${count} 条`,
  toolResultsOn: "工具结果：已脱敏",
  toolResultsOff: "工具结果：未脱敏（可在插件配置中开启 maskToolResults）",
  forget: "清除已保存的原文",
  forgetConfirm: "确定清除所有已保存的原文吗？对话中已有的占位符将无法再显示为原文。",
  statusFailed: "获取状态失败",

  wordTitle: "脱敏词库",
  wordIntro: "一行一个词：公司名、人名、项目代号等。每个词精确匹配，并自动生成专属占位符。以 # 开头的行是注释。",
  wordPlaceholder: "字节跳动有限公司\n王小二\n星河计划",
  shortWarning: (terms: string) => `较短的词可能误伤无关文字：${terms}`,
  save: "保存",
  importColumn: "从 CSV/XLSX 导入一列：",
  addToList: "加入词库",
  cancel: "取消",
  saved: (count: number) => `已保存 ${count} 个词，对之后发送的消息生效。`,
  added: (fresh: number, existing: number) => `已加入 ${fresh} 个词（${existing} 个已存在），点击"保存"后生效。`,
  inEffect: (count: number, kinds: string) => `生效中：${count} 个词（${kinds}）`,
  kindLabel: { ORG: "公司", PERSON: "人名", TERM: "词条", PHONE: "手机号", EMAIL: "邮箱", ID_CARD: "身份证", BANK_CARD: "银行卡", IP: "IP", ADDRESS: "地址", UNKNOWN: "未识别" } as Record<string, string>,
  wordFailed: "词库请求失败",
  importFailed: "导入失败",

  sheetTitle: "表格安全副本",
  sheetIntro: "在 AI 看到数据之前，先在本地处理 CSV/XLSX。原始值不会写入对话或日志。",
  sheetIdle: "原始文件只在本地处理，不会加入 DSH 对话。",
  scanning: "正在本地扫描…",
  scanDone: "扫描完成。请检查每列的处理方式，再生成安全副本。",
  scanFailed: "扫描失败",
  dataRows: (count: number) => `${count} 行数据`,
  matched: (kind: string, matched: number, total: number) => `${kind} · 命中 ${matched}/${total}`,
  createSafeCopy: "生成安全副本",
  creating: "正在生成安全副本…",
  created: (name: string) => `已生成安全副本：${name}。只应把这份副本发给 AI。`,
  redactFailed: "脱敏失败",
  actions: { KEEP: "保留", MASK: "打码", TOKENIZE: "令牌化", REMOVE: "删除" } as Record<string, string>,
};

export type Strings = typeof zh;

const en: Strings = {
  guideDescription: "Redact sensitive data in conversations and CSV/XLSX files locally before AI sees it.",
  openButton: "Open Privacy Gateway",

  maskTitle: "Conversation masking",
  maskIntro: "Names, phone numbers, emails, ID and bank card numbers in your messages are replaced with placeholders such as [PHONE_1A2B3C4D5E] before the model sees them. Originals stay on this machine.",
  maskEnabled: "Mask messages before sending",
  showOriginals: "Show originals in this window (marked with 🔒)",
  maskedThisRun: (count, kinds) => `Masked this run: ${count}${kinds ? ` (${kinds})` : ""}`,
  storedOriginals: count => `Stored originals: ${count}`,
  toolResultsOn: "Tool results: masked",
  toolResultsOff: "Tool results: not masked (enable maskToolResults in the plugin config)",
  forget: "Forget stored originals",
  forgetConfirm: "Forget every stored original? Placeholders already in conversations can no longer be shown as originals.",
  statusFailed: "status request failed",

  wordTitle: "Word list",
  wordIntro: "One term per line: company names, people, project code names. Each is matched exactly and masked with its own placeholder, generated automatically. Lines starting with # are comments.",
  wordPlaceholder: "ByteDance Ltd.\nJane Doe\nProject Nebula",
  shortWarning: terms => `Short terms can also mask unrelated text: ${terms}`,
  save: "Save",
  importColumn: "Import a column from CSV/XLSX: ",
  addToList: "Add to list",
  cancel: "Cancel",
  saved: count => `Saved ${count} terms. They apply to messages sent from now on.`,
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
  dataRows: count => `${count} data rows`,
  matched: (kind, matched, total) => `${kind} · matched ${matched}/${total}`,
  createSafeCopy: "Create Safe Copy",
  creating: "Creating safe copy...",
  created: name => `Safe copy created: ${name}. Only this copy should be sent to AI.`,
  redactFailed: "redaction failed",
  actions: { KEEP: "KEEP", MASK: "MASK", TOKENIZE: "TOKENIZE", REMOVE: "REMOVE" },
};

export const STRINGS: Record<Lang, Strings> = { zh, en };

export function useStrings(): Strings {
  return STRINGS[useLang()];
}
