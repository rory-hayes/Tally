import { describe, it, expect } from "vitest";
import { calcIePaye } from "@/lib/rules/iePaye";
import { ie2025Config } from "@/config/ie/2025";

describe("calcIePaye", () => {
  it("calculates PAYE across standard and higher bands", () => {
    const result = calcIePaye(4000, ie2025Config, {
      standardRateCutoff: 3500,
      taxCredits: 300,
    });

    expect(result.standardBandUsed).toBeCloseTo(3500);
    expect(result.higherBandUsed).toBeCloseTo(500);
    expect(result.standardTax).toBeCloseTo(700); // 3500 * 20%
    expect(result.higherTax).toBeCloseTo(200); // 500 * 40%
    expect(result.grossTax).toBeCloseTo(900);
    expect(result.netTax).toBeCloseTo(600);
  });

  it("never returns negative net tax when credits exceed gross tax", () => {
    const result = calcIePaye(1000, ie2025Config, {
      standardRateCutoff: 3500,
      taxCredits: 1000,
    });
    expect(result.netTax).toBe(0);
  });
});

