import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_ENTITIES, PLACEHOLDER, findEntities, maskText, restoreText } from "../src/core/textmask.js";

const secret = Buffer.alloc(32, 7);
const kinds = (text: string) => findEntities(text, [...DEFAULT_TEXT_ENTITIES, "IP"]).map(span => [span.kind, span.value]);

describe("findEntities", () => {
  it("finds contact details in running Chinese text", () => {
    expect(kinds("客户张三的手机是13812345678，邮箱 zhang.san@example.com")).toEqual([
      ["PERSON", "张三"],
      ["PHONE", "13812345678"],
      ["EMAIL", "zhang.san@example.com"],
    ]);
  });

  it("accepts spaced and prefixed phone numbers", () => {
    expect(kinds("电话 +86 138-1234-5678")).toEqual([["PHONE", "+86 138-1234-5678"]]);
    expect(kinds("电话 138 1234 5678")).toEqual([["PHONE", "138 1234 5678"]]);
  });

  it("takes names only with context", () => {
    expect(kinds("请联系王经理或李建国女士")).toEqual([["PERSON", "王"], ["PERSON", "李建国"]]);
    expect(kinds("客户张三的订单")).toEqual([["PERSON", "张三"]]);
    expect(kinds("给客户张三发邮件，客户李小明也来了")).toEqual([["PERSON", "张三"], ["PERSON", "李小明"]]);
    expect(kinds("联系人：欧阳")).toEqual([["PERSON", "欧阳"]]);
    expect(kinds("张开双臂，王道之路")).toEqual([]);
    expect(kinds("请李小姐确认")).toEqual([["PERSON", "李"]]);
  });

  it("validates ID card checksums and bank card Luhn", () => {
    expect(kinds("身份证 11010519491231002X")).toEqual([["ID_CARD", "11010519491231002X"]]);
    expect(kinds("编号 110105194912310021")).toEqual([]);
    expect(kinds("卡号 6222 0212 3456 7890 123")).toEqual([]);
    expect(kinds("卡号 4111 1111 1111 1111")).toEqual([["BANK_CARD", "4111 1111 1111 1111"]]);
  });

  it("leaves order numbers, timestamps and versions alone", () => {
    expect(kinds("订单号 202609301381234567890，时间戳 1727683200000，版本 1.2.3.4.5")).toEqual([]);
    expect(kinds("port 13812345678901")).toEqual([]);
  });
});

describe("maskText / restoreText", () => {
  it("round-trips through placeholders", () => {
    const text = "客户张三 13812345678，再次确认 138 1234 5678";
    const masked = maskText(text, DEFAULT_TEXT_ENTITIES, secret);
    expect(masked.text).not.toContain("13812345678");
    expect(masked.text).not.toContain("张三");
    const placeholders = masked.text.match(PLACEHOLDER) ?? [];
    expect(placeholders).toHaveLength(3);
    // the two spellings of one number share a placeholder
    expect(placeholders[1]).toBe(placeholders[2]);
    const restored = restoreText(masked.text, key => masked.entries.get(key));
    // one placeholder per value, so both spellings come back as the last one seen
    expect(restored).toBe("客户张三 138 1234 5678，再次确认 138 1234 5678");
  });

  it("is deterministic for a given secret", () => {
    const a = maskText("邮箱 a@b.co", DEFAULT_TEXT_ENTITIES, secret).text;
    const b = maskText("邮箱 A@B.CO", DEFAULT_TEXT_ENTITIES, secret).text;
    expect(a).toBe(b);
    expect(a).toMatch(/^邮箱 \[EMAIL_[0-9A-F]{10}\]$/);
  });

  it("does not re-mask placeholders", () => {
    const once = maskText("电话 13812345678", DEFAULT_TEXT_ENTITIES, secret).text;
    expect(maskText(once, DEFAULT_TEXT_ENTITIES, secret).replaced).toBe(0);
  });
});
