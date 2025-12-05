import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";
import { getDefaultRuleConfig } from "@/lib/rules/config";
import { getActiveRules } from "@/lib/rules/registry";
import type {
  CountryCode,
  IssueCandidate,
  RuleEvaluationOutcome,
  RuleConfig,
  IeRuleContext,
  UkRuleContext,
  ContractProfile,
} from "@/lib/rules/types";

export type RuleRuntimeOptions = {
  country?: CountryCode;
  taxYear?: number;
  config?: RuleConfig;
  ieContext?: IeRuleContext | null;
  ukContext?: UkRuleContext | null;
  contractProfile?: ContractProfile | null;
};

export type { IssueCandidate, RuleCode, IssueSeverity } from "@/lib/rules/types";

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
  const ieContext = options.ieContext ?? null;
  const ukContext = options.ukContext ?? null;
  const contractProfile = options.contractProfile ?? null;

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
        ieContext,
        ukContext,
        contractProfile,
      })
    );

    results.forEach((result) => {
      const severityOverride =
        derivedConfig.severityOverrides?.[rule.code] ?? null;
      issues.push({
        ruleCode: rule.code,
        severity: severityOverride ?? result.severity ?? rule.severity,
        description: result.description ?? rule.descriptionTemplate,
        data: result.data,
      });
    });
  });

  return issues;
};
