import { describe, it, expect } from "vitest";
import { calcIePrsi } from "@/lib/rules/iePrsi";
import { getIeConfigForYear } from "@/lib/rules/ieConfig";

const config2025 = getIeConfigForYear(2025);

describe("calcIePrsi", () => {
  it("returns zero PRSI below the class A weekly threshold", () => {
    const result = calcIePrsi(
      { gross_pay: 300, prsi_or_ni_category: "A1" },
      config2025
    );
    expect(result).toBeTruthy();
    expect(result?.employeeCharge).toBe(0);
    expect(result?.employerCharge).toBe(0);
  });

  it("applies PRSI credit taper for class A earnings between €352-€424", () => {
    const result = calcIePrsi(
      { gross_pay: 380, prsi_or_ni_category: "A" },
      config2025
    );
    expect(result?.classCode).toBe("A");
    expect(result?.employeeCredit).toBeGreaterThan(0);
    expect(result?.employeeCharge).toBeCloseTo(7.87, 2);
    expect(result?.employerCharge).toBeCloseTo(41.99, 2);
  });

  it("calculates class S contributions without employer PRSI", () => {
    const result = calcIePrsi(
      { gross_pay: 1200, prsi_or_ni_category: "S1" },
      config2025
    );
    expect(result?.classCode).toBe("S");
    expect(result?.employeeCharge).toBeCloseTo(48, 2);
    expect(result?.employerCharge).toBe(0);
  });

  it("derives weekly earnings from monthly frequency for PRSI checks", () => {
    const result = calcIePrsi(
      { gross_pay: 4000, prsi_or_ni_category: "A1" },
      config2025,
      { payFrequency: "monthly" }
    );
    expect(result?.weeklyEarnings).toBeCloseTo(920.6, 1);
    expect(result?.employeeCharge).toBeGreaterThan(35);
  });
});
