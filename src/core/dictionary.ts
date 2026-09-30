/**
 * User-maintained word list: one term per line, matched exactly (Latin text
 * case-insensitively). Placeholders are derived from the term automatically,
 * so the user only maintains which words to mask.
 */
export type DictionaryKind = "PERSON" | "ORG" | "TERM";

export interface DictionaryEntry {
  readonly term: string;
  readonly kind: DictionaryKind;
}

const ORG_SUFFIX = /(?:公司|集团|控股|工作室|事务所|研究院|研究所|合伙企业|银行|医院|大学|学院)$|[,\s](?:co\.?,?\s*ltd\.?|company\s+limited|limited|ltd\.?|inc\.?|corp\.?|corporation|llc|gmbh|plc|group|holdings?)$/i;
const SURNAME_START = /^[王李张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤常温康施文牛樊葛邢安齐易乔伍庞颜倪庄聂章鲁岳翟殷詹申欧耿关兰焦俞左柳甘祝包宁尚符舒阮柯纪梅童凌毕单季裴霍涂成苗谷盛曲翁冉骆蓝路游辛靳管柴蒙鲍华喻祁蒲房滕屈饶解牟艾尤阳时穆农司卓古吉缪简车项连芦麦褚娄窦戚岑景党宫费卜冷晏席卫米柏宗瞿桂全佟应臧闵苟邬边卞姬师和仇栾隋商刁沙荣巫寇桑郎甄丛仲虞敖巩明佘池查麻苑迟邝]/;

/** Label shown on the inspect card; it does not change what gets masked. */
export function kindOf(term: string): DictionaryKind {
  if (ORG_SUFFIX.test(term.replace(/[（(][^）)]*[）)]$/, "").trim())) return "ORG";
  if (/^[一-龥·]{2,4}$/.test(term) && SURNAME_START.test(term)) return "PERSON";
  return "TERM";
}

/** Non-empty, non-comment lines, trimmed and de-duplicated. */
export function parseDictionary(text: string): DictionaryEntry[] {
  const seen = new Set<string>();
  const entries: DictionaryEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (term.length === 0 || term.startsWith("#") || seen.has(key)) continue;
    seen.add(key);
    entries.push({ term, kind: kindOf(term) });
  }
  return entries;
}

export interface DictionaryMatch {
  readonly start: number;
  readonly end: number;
  readonly entry: DictionaryEntry;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Longest term first, so a list holding both "字节跳动" and "字节跳动有限公司"
 * masks the full name as one piece. A term starting or ending with a Latin
 * letter or digit needs a non-alphanumeric neighbour on that side, so "ACME"
 * does not match inside "ACMEX"; Chinese terms match anywhere.
 */
export function compileDictionary(entries: readonly DictionaryEntry[]): (text: string) => DictionaryMatch[] {
  const byTerm = new Map(entries.map(entry => [entry.term.toLowerCase(), entry]));
  if (byTerm.size === 0) return () => [];
  const alternatives = [...byTerm.keys()].sort((a, b) => b.length - a.length).map(term => {
    const lead = /^[a-z0-9]/i.test(term) ? "(?<![A-Za-z0-9])" : "";
    const tail = /[a-z0-9]$/i.test(term) ? "(?![A-Za-z0-9])" : "";
    return `${lead}${escape(term)}${tail}`;
  });
  const pattern = new RegExp(alternatives.join("|"), "gi");
  return text => {
    const found: DictionaryMatch[] = [];
    for (const match of text.matchAll(pattern)) {
      const entry = byTerm.get(match[0].toLowerCase());
      if (entry !== undefined && match.index !== undefined) found.push({ start: match.index, end: match.index + match[0].length, entry });
    }
    return found;
  };
}
