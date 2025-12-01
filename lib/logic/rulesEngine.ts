import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";
import { getDefaultRuleConfig } from "@/lib/rules/config";
import { getActiveRules } from "@/lib/rules/registry";
import type {
  CountryCode,
  IssueCandidate,
  IssueSeverity,
  RuleCode,
  RuleEvaluationOutcome,
  RuleConfig,
} from "@/lib/rules/types";

export type RuleRuntimeOptions = {
  country?: CountryCode;
  taxYear?: number;
  config?: RuleConfig;
};

export type { IssueCandidate, IssueSeverity, RuleCode } from "@/lib/rules/types";

const normalizeResult = (
  outcome: RuleEvaluationOutcome | RuleEvaluationOutcome[] | null | undefined
): RuleEvaluationOutcome[] => {
  if (!outcome) return [];
  return Array.isArray(outcome) ? outcome : [outcome];
};

export const runRules = (
  current: PayslipLike,
  previous: PayslipLike | null,
  diff: PayslipDiff,
  options: RuleRuntimeOptions = {}
): IssueCandidate[] => {
  const issues: IssueCandidate[] = [];
  const derivedCountry = options.country ?? ("IE" as CountryCode);
  const derivedTaxYear =
    typeof options.taxYear === "number" ? options.taxYear : null;
  const derivedConfig =
    options.config ?? getDefaultRuleConfig(derivedCountry, derivedTaxYear);

  const activeRules = getActiveRules(derivedCountry, derivedTaxYear);

  activeRules.forEach((rule) => {
    const results = normalizeResult(
      rule.evaluate({
        current,
        previous,
        diff,
        country: derivedCountry,
        taxYear: derivedTaxYear,
        config: derivedConfig,
      })
    );

    results.forEach((result) => {
      issues.push({
        ruleCode: rule.code,
        severity: result.severity ?? rule.severity,
        description: result.description ?? rule.descriptionTemplate,
      });
    });
  });

  return issues;
};

