import { stableToken } from "./tokenizer.js";

/** Entity kinds recognised in free text (conversation messages and tool results). */
export type TextEntity = "PERSON" | "PHONE" | "EMAIL" | "ID_CARD" | "BANK_CARD" | "IP";

export const TEXT_ENTITIES: readonly TextEntity[] = ["PERSON", "PHONE", "EMAIL", "ID_CARD", "BANK_CARD", "IP"];
export const DEFAULT_TEXT_ENTITIES: readonly TextEntity[] = ["PERSON", "PHONE", "EMAIL", "ID_CARD", "BANK_CARD"];

/**
 * Placeholders use square brackets: Markdown renders them literally, whereas
 * `<PHONE_1>` would be parsed as an HTML tag and disappear from the page.
 */
export const PLACEHOLDER = /\[(PERSON|PHONE|EMAIL|ID_CARD|BANK_CARD|IP)_[0-9A-F]{10}\]/g;

interface Span {
  readonly start: number;
  readonly end: number;
  readonly kind: TextEntity;
  readonly value: string;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// Digits must not continue on either side, so order numbers and timestamps are left alone.
const CN_MOBILE = /(?<![\d])(?:\+?86[- ]?)?1[3-9]\d(?:[- ]?\d{4}){2}(?![\d])/g;
const CN_ID = /(?<![\dA-Za-z])\d{17}[\dXx](?![\dA-Za-z])/g;
const BANK_CARD = /(?<![\d])(?:\d[ -]?){15,18}\d(?![\d])/g;
const IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g;

// Chinese names have no fixed shape, so only names anchored by context are taken:
// a label before them ("客户：张三") or a title after them ("王经理").
const SURNAMES = "王李张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤常温康施文牛樊葛邢安齐易乔伍庞颜倪庄聂章鲁岳翟殷詹申欧耿关兰焦俞左柳甘祝包宁尚符舒阮柯纪梅童凌毕单季裴霍涂成苗谷盛曲翁冉骆蓝路游辛靳管柴蒙鲍华喻祁蒲房滕屈饶解牟艾尤阳时穆农司卓古吉缪简车项连芦麦褚娄窦戚岑景党宫费卜冷晏席卫米柏宗瞿桂全佟应臧闵苟邬边卞姬师和仇栾隋商刁沙荣巫寇桑郎甄丛仲虞敖巩明佘池查麻苑迟邝";
// A given-name character, excluding particles and words that usually follow a name.
const GIVEN_CHAR = "(?:(?![的是在和与及跟给电手号邮地住说要已先女老经总主医律同发打来去让把被对向问回买签付等也都还就才又今昨，。、])[\\u4e00-\\u9fa5])";
const GIVEN = `${GIVEN_CHAR}{1,2}`;
const NAME_AFTER_LABEL = new RegExp(
  `(?:客户|联系人|姓名|收件人|收货人|寄件人|负责人|经办人|申请人|患者|学生|员工|用户|我叫|名叫|叫做)(?:姓名)?[是为：:\\s]{0,2}([${SURNAMES}]${GIVEN})`,
  "g",
);
const NAME_BEFORE_TITLE = new RegExp(
  `([${SURNAMES}]${GIVEN_CHAR}{0,2}?)(?:先生|女士|小姐|老师|经理|总监|主任|医生|律师|同学)`,
  "g",
);

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function validId(value: string): boolean {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = "10X98765432";
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(value[i]) * (weights[i] ?? 0);
  return checks[sum % 11] === value[17]?.toUpperCase();
}

function collect(text: string, pattern: RegExp, kind: TextEntity, spans: Span[], accept?: (value: string) => boolean, group = 0): void {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const value = match[group];
    if (value === undefined || match.index === undefined) continue;
    if (accept !== undefined && !accept(value)) continue;
    const start = match.index + match[0].indexOf(value);
    spans.push({ start, end: start + value.length, kind, value });
  }
}

/** Sensitive values in `text`, earliest first, without overlaps. */
export function findEntities(text: string, kinds: readonly TextEntity[]): Span[] {
  const on = new Set(kinds);
  const spans: Span[] = [];
  // Order matters for overlaps: the more specific pattern wins on a tie.
  if (on.has("EMAIL")) collect(text, EMAIL, "EMAIL", spans);
  if (on.has("ID_CARD")) collect(text, CN_ID, "ID_CARD", spans, validId);
  if (on.has("BANK_CARD")) collect(text, BANK_CARD, "BANK_CARD", spans, value => luhn(value.replace(/\D/g, "")));
  if (on.has("PHONE")) collect(text, CN_MOBILE, "PHONE", spans);
  if (on.has("IP")) collect(text, IPV4, "IP", spans);
  if (on.has("PERSON")) {
    collect(text, NAME_AFTER_LABEL, "PERSON", spans, undefined, 1);
    collect(text, NAME_BEFORE_TITLE, "PERSON", spans, undefined, 1);
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    kept.push(span);
    cursor = span.end;
  }
  return kept;
}

/** Canonical form so "138 1234 5678" and "13812345678" share one placeholder. */
function canonical(kind: TextEntity, value: string): string {
  switch (kind) {
    case "PHONE":
    case "BANK_CARD":
      return value.replace(/[\s-]/g, "").replace(/^\+?86/, "");
    case "EMAIL":
      return value.toLowerCase();
    case "ID_CARD":
      return value.toUpperCase();
    default:
      return value;
  }
}

export interface MaskResult {
  readonly text: string;
  readonly replaced: number;
  /** placeholder -> original, for every value replaced in this call */
  readonly entries: ReadonlyMap<string, string>;
}

export function maskText(text: string, kinds: readonly TextEntity[], secret: Buffer): MaskResult {
  const spans = findEntities(text, kinds);
  if (spans.length === 0) return { text, replaced: 0, entries: new Map() };
  const entries = new Map<string, string>();
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    const placeholder = `[${stableToken(secret, span.kind, canonical(span.kind, span.value))}]`;
    entries.set(placeholder, span.value);
    out += text.slice(cursor, span.start) + placeholder;
    cursor = span.end;
  }
  return { text: out + text.slice(cursor), replaced: spans.length, entries };
}

/** Replace known placeholders with their originals; unknown ones stay as they are. */
export function restoreText(text: string, lookup: (placeholder: string) => string | undefined): string {
  return text.replace(PLACEHOLDER, placeholder => lookup(placeholder) ?? placeholder);
}
