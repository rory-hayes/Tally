import { describe, it, expect } from "vitest";
import { calcUkStudentLoan } from "@/lib/rules/ukStudentLoan";
import { getUkConfigForYear } from "@/lib/rules/ukConfig";

const config2025 = getUkConfigForYear(2025);

describe("calcUkStudentLoan", () => {
  it("calculates Plan 2 deductions on monthly pay above threshold", () => {
    const result = calcUkStudentLoan(4000, config2025, "Plan2", false, "monthly");
    expect(result.planCharge).toBeGreaterThan(130);
    expect(result.planThresholdPerPeriod).toBeCloseTo(2416.58, 2);
  });

  it("returns zero when below threshold", () => {
    const result = calcUkStudentLoan(1500, config2025, "Plan1", false, "monthly");
    expect(result.planCharge).toBe(0);
  });

  it("adds postgraduate loan on top of plan charge", () => {
    const result = calcUkStudentLoan(5000, config2025, "Plan5", true, "monthly");
    expect(result.planCharge).toBeGreaterThan(190);
    expect(result.postgradCharge).toBeGreaterThan(100);
    expect(result.totalCharge).toBeCloseTo(result.planCharge + result.postgradCharge, 5);
  });
});
