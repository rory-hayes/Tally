import { describe, it, expect } from "vitest";
import { calculateDiff } from "@/lib/logic/payslipDiff";
import { runRules } from "@/lib/logic/rulesEngine";
import { goldenScenarios } from "@/tests/fixtures/rulesGolden";
import { getDefaultRuleConfig } from "@/lib/rules/config";

const normalize = (
  issues: { ruleCode: string; severity: string }[]
): { ruleCode: string; severity: string }[] =>
  [...issues].sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));

describe("golden rule scenarios", () => {
  goldenScenarios.forEach((scenario) => {
    it(`produces expected issues for ${scenario.name}`, () => {
      const diff = calculateDiff(scenario.previous, scenario.current);
      const baseOptions = {
        country: scenario.country,
        taxYear: scenario.runtimeOptions?.taxYear ?? (scenario.country === "IE" ? 2025 : undefined),
        ...scenario.runtimeOptions,
      };
      baseOptions.config ??= getDefaultRuleConfig(
        baseOptions.country ?? "IE",
        baseOptions.taxYear ?? undefined
      );
      const issues = runRules(scenario.current, scenario.previous, diff, baseOptions);

      const simplified = normalize(
        issues.map((issue) => ({
          ruleCode: issue.ruleCode,
          severity: issue.severity,
        }))
      );

      expect(simplified).toEqual(normalize(scenario.expectedIssues));
    });
  });
});

