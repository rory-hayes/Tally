import { describe, expect, it } from "vitest";
import { calculateDiff } from "@/lib/logic/payslipDiff";
import { runRules } from "@/lib/logic/rulesEngine";
import { getDefaultRuleConfig, mergeRuleConfig } from "@/lib/rules/config";
import { goldenDataset } from "@/lib/rules/goldenDataset";

describe("Rule config merging", () => {
  it("merges nested enrichment and severity overrides", () => {
    const base = getDefaultRuleConfig("IE");
    const merged = mergeRuleConfig(base, {
      enrichment: { includeEvidence: false },
      severityOverrides: { NET_CHANGE_LARGE: "critical" },
    });
    expect(merged.enrichment?.includeEvidence).toBe(false);
    expect(merged.enrichment?.includeBandBreakdown).toBe(true);
    expect(merged.severityOverrides?.NET_CHANGE_LARGE).toBe("critical");
  });

  it("applies severity overrides when running rules", () => {
    const base = getDefaultRuleConfig("IE");
    const config = mergeRuleConfig(base, {
      severityOverrides: { NET_CHANGE_LARGE: "critical" },
    });
    const previous = { net_pay: 1000, gross_pay: 1000 };
    const current = { net_pay: 1400, gross_pay: 1000 };
    const diff = calculateDiff(previous, current);
    const issues = runRules(current, previous, diff, {
      country: "IE",
      taxYear: 2025,
      config,
    });
    const overrideIssue = issues.find((issue) => issue.ruleCode === "NET_CHANGE_LARGE");
    expect(overrideIssue?.severity).toBe("critical");
  });

  it("exposes a golden dataset for settings UI", () => {
    expect(goldenDataset.length).toBeGreaterThan(0);
    expect(goldenDataset[0]).toHaveProperty("expectedIssues");
  });
});
