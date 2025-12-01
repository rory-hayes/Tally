import { describe, it, expect, afterEach } from "vitest";
import {
  __dangerousSetRuleDefinitionsForTesting,
  getActiveRules,
  type RuleDefinition,
} from "@/lib/rules/registry";

afterEach(() => {
  __dangerousSetRuleDefinitionsForTesting();
});

describe("rule registry", () => {
  it("filters rules by country and tax year", () => {
    const definitions: RuleDefinition[] = [
      {
        code: "NET_CHANGE_LARGE",
        descriptionTemplate: "Rule A",
        severity: "warning",
        categories: ["net"],
        appliesTo: { countries: ["IE"], taxYears: [2025] },
        evaluate: () => null,
      },
      {
        code: "GROSS_CHANGE_LARGE",
        descriptionTemplate: "Rule B",
        severity: "warning",
        categories: ["gross"],
        appliesTo: { countries: ["UK"], taxYears: [2024] },
        evaluate: () => null,
      },
    ];

    __dangerousSetRuleDefinitionsForTesting(definitions);

    const ieRules = getActiveRules("IE", 2025);
    expect(ieRules.map((rule) => rule.code)).toEqual(["NET_CHANGE_LARGE"]);

    const ukRules = getActiveRules("UK", 2024);
    expect(ukRules.map((rule) => rule.code)).toEqual(["GROSS_CHANGE_LARGE"]);

    const none = getActiveRules("IE", 2023);
    expect(none).toHaveLength(0);
  });
});

