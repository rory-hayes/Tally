import { describe, it, expect } from "vitest";
import { parseSubmissionCsv } from "@/lib/submissions/parser";

describe("parseSubmissionCsv", () => {
  it("parses submission totals", () => {
    const csv = `paye_total,usc_or_ni_total,employee_count,tax_year
1000,200,10,2025`;
    const summary = parseSubmissionCsv(csv);
    expect(summary.paye_total).toBe(1000);
    expect(summary.usc_or_ni_total).toBe(200);
    expect(summary.employee_count).toBe(10);
    expect(summary.tax_year).toBe(2025);
  });
});
