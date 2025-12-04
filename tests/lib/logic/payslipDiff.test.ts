import { describe, it, expect } from "vitest";
import { calculateDiff } from "@/lib/logic/payslipDiff";

const basePrevious = {
  gross_pay: 3000,
  net_pay: 2100,
  paye: 600,
  usc_or_ni: 135,
  pension_employee: 150,
  pension_employer: 180,
  ytd_gross: 15000,
  ytd_net: 12000,
  ytd_tax: 3000,
  ytd_usc_or_ni: 700,
};

const baseCurrent = {
  gross_pay: 3300,
  net_pay: 2205,
  paye: 660,
  usc_or_ni: 150,
  pension_employee: 180,
  pension_employer: 210,
  ytd_gross: 18300,
  ytd_net: 14205,
  ytd_tax: 3660,
  ytd_usc_or_ni: 850,
};

describe("calculateDiff", () => {
  it("computes deltas and percentage changes for key fields", () => {
    const diff = calculateDiff(basePrevious, baseCurrent);

    expect(diff.gross_pay).toEqual({
      previous: 3000,
      current: 3300,
      delta: 300,
      percentChange: 10,
    });

    expect(diff.net_pay).toEqual({
      previous: 2100,
      current: 2205,
      delta: 105,
      percentChange: 5,
    });

    expect(diff.ytd_tax).toEqual({
      previous: 3000,
      current: 3660,
      delta: 660,
      percentChange: 22,
    });
  });

  it("handles null/undefined previous values", () => {
    const current = { ...baseCurrent, gross_pay: 1500 };
    const diff = calculateDiff(null, current);

    expect(diff.gross_pay).toEqual({
      previous: null,
      current: 1500,
      delta: 1500,
      percentChange: null,
    });
  });

  it("handles zero previous values without dividing by zero", () => {
    const previous = { ...basePrevious, pension_employee: 0 };
    const current = { ...baseCurrent, pension_employee: 200 };
    const diff = calculateDiff(previous, current);

    expect(diff.pension_employee).toEqual({
      previous: 0,
      current: 200,
      delta: 200,
      percentChange: null,
    });
  });

  it("allows missing fields in current payslip but requires object", () => {
    const diff = calculateDiff(basePrevious, { gross_pay: 1000 } as any);
    expect(diff.gross_pay).toEqual({
      previous: 3000,
      current: 1000,
      delta: -2000,
      percentChange: -66.66666666666666,
    });
  });

  it("throws if current payslip is missing", () => {
    expect(() => calculateDiff(basePrevious, null as any)).toThrow(
      "Current payslip is required to calculate diff"
    );
  });
});
