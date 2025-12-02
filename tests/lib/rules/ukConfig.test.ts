import { describe, it, expect } from "vitest";
import { getUkConfigForYear } from "@/lib/rules/ukConfig";

describe("UK tax config loader", () => {
  it("returns 2025 config with expected PAYE bands", () => {
    const config = getUkConfigForYear(2025);
    expect(config.year).toBe(2025);
    expect(config.paye.personalAllowance).toBe(12570);
    const basicBand = config.paye.bands.find((band) => band.label === "basic_rate");
    expect(basicBand?.rate).toBeCloseTo(0.2);
    expect(basicBand?.upTo).toBe(50270);
  });

  it("exposes NIC thresholds and rates in ascending order", () => {
    const config = getUkConfigForYear(2025);
    const { thresholds, rates } = config.nic;
    expect(thresholds.primaryThresholdWeekly).toBeLessThan(thresholds.upperEarningsLimitWeekly);
    expect(thresholds.secondaryThresholdWeekly).toBeLessThan(thresholds.upperEarningsLimitWeekly);
    expect(rates.employeeLowerRate).toBeGreaterThanOrEqual(0);
    expect(rates.employerRate).toBeGreaterThan(0);
  });

  it("includes student loan thresholds and rates", () => {
    const config = getUkConfigForYear(2025);
    const plan2 = config.studentLoans.find((loan) => loan.plan === "Plan2");
    expect(plan2?.thresholdAnnual).toBe(28999);
    expect(plan2?.rate).toBeCloseTo(0.09);
    const postgrad = config.studentLoans.find((loan) => loan.plan === "Postgrad");
    expect(postgrad?.rate).toBeCloseTo(0.06);
  });
});
