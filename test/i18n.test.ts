// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { STRINGS, currentLang } from "../src/client/i18n.js";

describe("i18n", () => {
  it("follows <html lang> set by DSH", () => {
    document.documentElement.lang = "zh-CN";
    expect(currentLang()).toBe("zh");
    document.documentElement.lang = "en";
    expect(currentLang()).toBe("en");
    document.documentElement.lang = "";
    expect(currentLang()).toBe("en");
  });

  it("has the same keys in both languages", () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.zh).sort());
    expect(STRINGS.zh.maskedThisRun(3, "PHONE 3")).toBe("本次运行已脱敏：3（PHONE 3）");
  });
});
