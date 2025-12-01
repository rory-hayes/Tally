import { describe, it, expect } from "vitest";
import {
  getDefaultRuleConfig,
  mergeRuleConfig,
} from "@/lib/rules/config";

describe("rule config defaults and overrides", () => {
  it("returns country defaults when tax year missing", () => {
    const config = getDefaultRuleConfig("IE");
    expect(config.largeNetChangePercent).toBeGreaterThan(0);
    expect(config.payeSpikePercent).toBeGreaterThan(0);
  });

  it("merges overrides onto defaults", () => {
    const base = getDefaultRuleConfig("IE");
    const merged = mergeRuleConfig(base, {
      largeNetChangePercent: 25,
    });
    expect(merged.largeNetChangePercent).toBe(25);
    expect(merged.payeSpikePercent).toBe(base.payeSpikePercent);
  });
});

