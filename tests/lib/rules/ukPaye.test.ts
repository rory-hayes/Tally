import { describe, it, expect } from "vitest";
import { calcUkPaye } from "@/lib/rules/ukPaye";
import { getUkConfigForYear } from "@/lib/rules/ukConfig";

const config2025 = getUkConfigForYear(2025);

describe("calcUkPaye", () => {
  it("computes PAYE for tax code 1257L on monthly pay", () => {
    const result = calcUkPaye(3000, config2025, "1257L", "monthly");
    expect(result.taxDue).toBeCloseTo(390.5, 1);
    expect(result.allowancePerPeriod).toBeCloseTo(1047.5, 1);
  });

  it("applies basic rate only for BR tax code", () => {
    const result = calcUkPaye(4000, config2025, "BR", "monthly");
    expect(result.taxDue).toBeCloseTo(800, 2); // 20% of full pay
    expect(result.allowancePerPeriod).toBe(0);
  });

  it("handles higher rate when income exceeds basic band", () => {
    const result = calcUkPaye(10000, config2025, "1257L", "monthly");
    expect(result.taxDue).toBeGreaterThan(2500);
    expect(result.taxDue).toBeLessThan(2800);
  });
});
