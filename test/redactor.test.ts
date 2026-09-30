import { describe, expect, it } from "vitest";
import { buildScan, redactDocument } from "../src/core/redactor.js";

describe("redactDocument", () => {
  it("keeps deterministic tokens inside one document", () => {
    const document = {
      format: "csv" as const,
      sheets: [{
        name: "CSV",
        headers: ["客户姓名", "数量"],
        rows: [["张三", 1], ["张三", 2], ["李四", 3]],
      }],
    };
    const scan = buildScan("customers.csv", document);
    const safe = redactDocument(document, scan, [], Buffer.alloc(32, 7));
    expect(safe.sheets[0]?.rows[0]?.[0]).toEqual(safe.sheets[0]?.rows[1]?.[0]);
    expect(safe.sheets[0]?.rows[0]?.[0]).not.toEqual(safe.sheets[0]?.rows[2]?.[0]);
    expect(safe.sheets[0]?.rows[0]?.[1]).toBe(1);
  });
});
