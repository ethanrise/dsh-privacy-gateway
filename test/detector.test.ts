import { describe, expect, it } from "vitest";
import { scanSheet } from "../src/core/detector.js";

describe("scanSheet", () => {
  it("detects sensitive columns from schema and values", () => {
    const result = scanSheet({
      name: "customers",
      headers: ["客户姓名", "phone", "email", "quantity"],
      rows: [
        ["张三", "13812345678", "a@example.com", 100],
        ["李四", "13912345678", "b@example.com", 200],
      ],
    });
    expect(result.map(item => item.kind)).toEqual(["PERSON", "PHONE", "EMAIL", "UNKNOWN"]);
    expect(result.map(item => item.recommendedAction)).toEqual(["TOKENIZE", "MASK", "TOKENIZE", "KEEP"]);
  });
});
