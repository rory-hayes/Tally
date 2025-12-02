import { describe, it, expect } from "vitest";
import { calcIeUsc } from "@/lib/rules/ieUsc";
import { ie2025Config } from "@/config/ie/2025";

describe("calcIeUsc", () => {
  it("applies USC bands progressively", () => {
    const result = calcIeUsc(80000, ie2025Config);
    const charges = result.bandUsage.map((band) => Number(band.charge.toFixed(2)));
    expect(charges[0]).toBeCloseTo(60.06); // 12012 * 0.5%
    expect(charges[1]).toBeCloseTo((25760 - 12012) * 0.02, 2);
    expect(result.totalCharge).toBeGreaterThan(0);
  });

  it("caps final band at income amount", () => {
    const result = calcIeUsc(20000, ie2025Config);
    const total = result.bandUsage.reduce((sum, band) => sum + band.amount, 0);
    expect(total).toBeCloseTo(20000);
  });
});

