import { describe, it, expect } from "vitest";
import { calcUkNic } from "@/lib/rules/ukNic";
import { getUkConfigForYear } from "@/lib/rules/ukConfig";

const config2025 = getUkConfigForYear(2025);

describe("calcUkNic", () => {
  it("calculates NIC for category A with earnings above UEL", () => {
    const result = calcUkNic(1000, config2025, "A", "weekly");
    expect(result.employeeCharge).toBeCloseTo(58.66, 2);
    expect(result.employerCharge).toBeCloseTo(113.85, 2);
  });

  it("applies zero employee NIC for category C pensioners", () => {
    const result = calcUkNic(800, config2025, "C", "weekly");
    expect(result.employeeCharge).toBe(0);
    expect(result.employerCharge).toBeGreaterThan(0);
  });

  it("applies employer relief for under-21 category M up to upper secondary threshold", () => {
    const result = calcUkNic(800, config2025, "M", "weekly");
    expect(result.employerCharge).toBe(0);
    expect(result.employeeCharge).toBeGreaterThan(0);
  });
});
