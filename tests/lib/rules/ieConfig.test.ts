import { describe, it, expect } from "vitest";
import { getIeConfigForYear } from "@/lib/rules/ieConfig";

describe("IE tax config loader", () => {
  it("returns 2025 config with expected PAYE bands", () => {
    const config = getIeConfigForYear(2025);
    expect(config.year).toBe(2025);
    const singleBand = config.paye.bands.find((band) => band.category === "single");
    expect(singleBand?.standardRateCutoff).toBe(42000);
    expect(config.paye.standardRate).toBeCloseTo(0.2);
    expect(config.paye.higherRate).toBeCloseTo(0.4);
  });

  it("ensures USC bands are ascending and non-negative", () => {
    const config = getIeConfigForYear(2025);
    const { bands } = config.usc;
    bands.forEach((band, index) => {
      if (index > 0) {
        expect(band.upTo).toBeGreaterThanOrEqual(bands[index - 1].upTo);
      }
      expect(band.rate).toBeGreaterThanOrEqual(0);
    });
  });

  it("exposes PRSI class A rates", () => {
    const config = getIeConfigForYear(2025);
    const classA = config.prsi.classes.A;
    expect(classA.employeeRate).toBeCloseTo(0.04);
    expect(classA.employerRate).toBeGreaterThan(0.1);
    expect(classA.weeklyThreshold).toBe(352);
  });
});

