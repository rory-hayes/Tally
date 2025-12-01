import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";
import type {
  CountryCode,
  IssueSeverity,
  RuleCode,
  RuleEvaluationContext,
  RuleEvaluationOutcome,
  RuleEvaluationResult,
} from "@/lib/rules/types";

export type RuleDefinition = {
  code: RuleCode;
  descriptionTemplate: string;
  severity: IssueSeverity;
  categories: string[];
  appliesTo?: {
    countries?: CountryCode[];
    taxYears?: number[];
  };
  evaluate: (context: RuleEvaluationContext) => RuleEvaluationResult;
};

const NET_CHANGE_THRESHOLD = 15; // %
const GROSS_CHANGE_THRESHOLD = 15; // %
const TAX_SPIKE_THRESHOLD = 20; // %
const USC_SPIKE_THRESHOLD = 20; // %
const MAX_GROSS_DELTA_FOR_TAX_SPIKE = 5; // %
const MAX_GROSS_DELTA_FOR_USC_SPIKE = 5; // %
const PENSION_EMPLOYEE_THRESHOLD = 10; // %
const PENSION_EMPLOYER_THRESHOLD = 12; // %

const COUNTRY_ALL: CountryCode[] = ["IE", "UK"];

const formatAmount = (value: number | null | undefined) =>
  typeof value === "number" ? `€${value.toFixed(2)}` : "n/a";

const formatPercent = (value: number | null | undefined) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "n/a";

const formatSignedPercent = (value: number | null | undefined) =>
  typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` : "n/a";

type DiffEntry = PayslipDiff[keyof PayslipDiff];

const hasPreviousData = (entry: DiffEntry | undefined) => typeof entry?.previous === "number";

const describeUscSpike = (
  uscPercent: number | null,
  uscPrevious: number | null,
  uscCurrent: number | null,
  grossPercent: number | null
) => {
  const grossDescriptor =
    grossPercent === null
      ? "stayed flat"
      : `changed by ${formatSignedPercent(grossPercent)}`;
  return `USC/NI increased by ${formatSignedPercent(uscPercent)} (${formatAmount(
    uscPrevious
  )} → ${formatAmount(uscCurrent)}) while gross pay ${grossDescriptor}`;
};

const describePensionPercent = (
  label: string,
  percent: number,
  contribution: number | null | undefined,
  gross: number | null | undefined
) =>
  `${label} is ${percent.toFixed(1)}% of gross pay (${formatAmount(
    contribution
  )} / ${formatAmount(gross)})`;

const applyIssue = (
  description: string,
  severity?: IssueSeverity
): RuleEvaluationOutcome => ({
  description,
  severity,
});

const baseRuleDefinitions: RuleDefinition[] = [
  {
    code: "NET_CHANGE_LARGE",
    descriptionTemplate: "Net pay changed significantly",
    severity: "warning",
    categories: ["net"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ diff }) => {
      const entry = diff.net_pay;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < NET_CHANGE_THRESHOLD) return null;
      return applyIssue(
        `Net pay changed by ${formatPercent(entry.percentChange)} (${formatAmount(
          entry.previous
        )} → ${formatAmount(entry.current)})`
      );
    },
  },
  {
    code: "GROSS_CHANGE_LARGE",
    descriptionTemplate: "Gross pay changed significantly",
    severity: "warning",
    categories: ["gross"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ diff }) => {
      const entry = diff.gross_pay;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < GROSS_CHANGE_THRESHOLD) return null;
      return applyIssue(
        `Gross pay changed by ${formatPercent(entry.percentChange)} (${formatAmount(
          entry.previous
        )} → ${formatAmount(entry.current)})`
      );
    },
  },
  {
    code: "TAX_SPIKE_WITHOUT_GROSS",
    descriptionTemplate: "PAYE spike without gross movement",
    severity: "warning",
    categories: ["tax"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ diff }) => {
      const entry = diff.paye;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < TAX_SPIKE_THRESHOLD) return null;
      const grossPercent = diff.gross_pay.percentChange;
      if (grossPercent !== null && Math.abs(grossPercent) > MAX_GROSS_DELTA_FOR_TAX_SPIKE) {
        return null;
      }
      return applyIssue(
        `PAYE increased by ${formatPercent(entry.percentChange)} while gross pay stayed flat`
      );
    },
  },
  {
    code: "USC_SPIKE_WITHOUT_GROSS",
    descriptionTemplate: "USC spike without gross movement",
    severity: "warning",
    categories: ["tax"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ diff }) => {
      const entry = diff.usc_or_ni;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < USC_SPIKE_THRESHOLD) return null;
      const grossPercent = diff.gross_pay.percentChange;
      if (grossPercent !== null && Math.abs(grossPercent) > MAX_GROSS_DELTA_FOR_USC_SPIKE) {
        return null;
      }
      return applyIssue(
        describeUscSpike(entry.percentChange, entry.previous, entry.current, grossPercent)
      );
    },
  },
  {
    code: "YTD_REGRESSION",
    descriptionTemplate: "YTD value regressed",
    severity: "critical",
    categories: ["ytd"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ diff }) => {
      const fields: (keyof PayslipDiff)[] = ["ytd_gross", "ytd_net", "ytd_tax", "ytd_usc_or_ni"];
      const issues: RuleEvaluationOutcome[] = [];
      fields.forEach((field) => {
        const entry = diff[field];
        if (!hasPreviousData(entry) || entry.current === null) {
          return;
        }
        if (entry.previous !== null && entry.current < entry.previous) {
          issues.push(
            applyIssue(
              `${field.replace("ytd_", "YTD ").toUpperCase()} decreased (${formatAmount(
                entry.previous
              )} → ${formatAmount(entry.current)})`
            )
          );
        }
      });
      return issues.length ? issues : null;
    },
  },
  {
    code: "PRSI_CATEGORY_CHANGE",
    descriptionTemplate: "PRSI/NI category changed",
    severity: "info",
    categories: ["compliance"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ current, previous }) => {
      const prevCategory = previous?.prsi_or_ni_category?.trim().toUpperCase();
      const currCategory = current?.prsi_or_ni_category?.trim().toUpperCase();
      if (prevCategory && currCategory && prevCategory !== currCategory) {
        return applyIssue(`PRSI/NI category changed ${prevCategory} → ${currCategory}`);
      }
      return null;
    },
  },
  {
    code: "PENSION_EMPLOYEE_HIGH",
    descriptionTemplate: "Employee pension contribution is high",
    severity: "warning",
    categories: ["pension"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ current, diff }) => {
      const grossCurrent = diff.gross_pay.current ?? null;
      if (!grossCurrent || grossCurrent === 0) return null;
      const pension = current.pension_employee ?? null;
      if (typeof pension !== "number") return null;
      const percent = (pension / grossCurrent) * 100;
      if (percent < PENSION_EMPLOYEE_THRESHOLD) {
        return null;
      }
      return applyIssue(
        describePensionPercent("Employee pension contribution", percent, pension, grossCurrent)
      );
    },
  },
  {
    code: "PENSION_EMPLOYER_HIGH",
    descriptionTemplate: "Employer pension contribution is high",
    severity: "info",
    categories: ["pension"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ current, diff }) => {
      const grossCurrent = diff.gross_pay.current ?? null;
      if (!grossCurrent || grossCurrent === 0) return null;
      const pension = current.pension_employer ?? null;
      if (typeof pension !== "number") return null;
      const percent = (pension / grossCurrent) * 100;
      if (percent < PENSION_EMPLOYER_THRESHOLD) {
        return null;
      }
      return applyIssue(
        describePensionPercent("Employer pension contribution", percent, pension, grossCurrent)
      );
    },
  },
];

let activeDefinitions = [...baseRuleDefinitions];

export const getActiveRules = (
  country?: CountryCode,
  taxYear?: number | null
): RuleDefinition[] =>
  activeDefinitions.filter((definition) => {
    const countries = definition.appliesTo?.countries;
    if (countries && countries.length > 0) {
      if (!country || !countries.includes(country)) {
        return false;
      }
    }
    const taxYears = definition.appliesTo?.taxYears;
    if (taxYears && taxYears.length > 0) {
      if (typeof taxYear !== "number" || !taxYears.includes(taxYear)) {
        return false;
      }
    }
    return true;
  });

export const __dangerousSetRuleDefinitionsForTesting = (definitions?: RuleDefinition[]) => {
  activeDefinitions = definitions && definitions.length ? definitions : [...baseRuleDefinitions];
};

export const __getAllRuleDefinitions = () => [...activeDefinitions];

