import { describe, expect, it } from "vitest";
import { compileDictionary, kindOf, parseDictionary } from "../src/core/dictionary.js";
import { DEFAULT_TEXT_ENTITIES, PLACEHOLDER, maskText } from "../src/core/textmask.js";

const secret = Buffer.alloc(32, 7);
const mask = (text: string, list: string) => maskText(text, DEFAULT_TEXT_ENTITIES, secret, { dictionary: compileDictionary(parseDictionary(list)) });

describe("word list", () => {
  it("parses one term per line, skipping blanks, comments and duplicates", () => {
    expect(parseDictionary("字节跳动有限公司\n\n# 注释\n 王小二 \nACME Inc.\nacme inc.\n星河计划").map(e => [e.term, e.kind])).toEqual([
      ["字节跳动有限公司", "ORG"],
      ["王小二", "PERSON"],
      ["ACME Inc.", "ORG"],
      ["星河计划", "TERM"],
    ]);
    expect(kindOf("阿里巴巴（中国）有限公司")).toBe("ORG");
  });

  it("matches terms exactly and does not derive short forms", () => {
    const result = mask("字节跳动有限公司和字节跳动是两种写法", "字节跳动有限公司");
    expect(result.text).toMatch(/^\[ORG_[0-9A-F]{10}\]和字节跳动是两种写法$/);
  });

  it("prefers the longest listed term", () => {
    const result = mask("与字节跳动有限公司签约", "字节跳动\n字节跳动有限公司");
    expect(result.text.match(PLACEHOLDER)).toHaveLength(1);
    expect([...result.entries.values()]).toEqual(["字节跳动有限公司"]);
  });

  it("gives each term its own stable placeholder and restores the listed spelling", () => {
    const a = mask("ACME Inc. 与 acme inc. 与 字节跳动有限公司", "ACME Inc.\n字节跳动有限公司");
    const placeholders = a.text.match(PLACEHOLDER) ?? [];
    expect(placeholders[0]).toBe(placeholders[1]);
    expect(placeholders[0]).not.toBe(placeholders[2]);
    expect(a.entries.get(placeholders[0]!)).toBe("ACME Inc.");
    expect(mask("字节跳动有限公司", "字节跳动有限公司").text).toBe(placeholders[2]);
  });

  it("keeps Latin terms inside word boundaries", () => {
    expect(mask("ACMEX and ACME", "ACME").text).toMatch(/^ACMEX and \[TERM_[0-9A-F]{10}\]$/);
  });

  it("beats a rule hit on the same text and leaves regex characters literal", () => {
    expect(mask("客户王小二的邮箱", "王小二").text).toMatch(/^客户\[PERSON_[0-9A-F]{10}\]的邮箱$/);
    expect(mask("a.b 和 a+b", "a+b").text).toMatch(/^a\.b 和 \[TERM_[0-9A-F]{10}\]$/);
  });
});
