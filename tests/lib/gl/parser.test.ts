import { describe, it, expect } from "vitest";
import { parseGlCsv } from "@/lib/gl/parser";

describe("parseGlCsv", () => {
  it("aggregates GL wages, taxes, and pensions from CSV", () => {
    const csv = `wages,employer_taxes,pensions,other
5000,600,300,100
2000,200,100,0`;
    const totals = parseGlCsv(csv);
    expect(totals.wages).toBe(7000);
    expect(totals.employer_taxes).toBe(800);
    expect(totals.pensions).toBe(400);
    expect(totals.other).toBe(100);
  });
});
