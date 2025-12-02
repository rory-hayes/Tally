import type { PayslipDiff, PayslipLike } from "@/lib/logic/payslipDiff";
import { calcIePaye } from "@/lib/rules/iePaye";
import { calcIeUsc } from "@/lib/rules/ieUsc";
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

const COUNTRY_ALL: CountryCode[] = ["IE", "UK"];
const IE_PAYE_MISMATCH_TOLERANCE = 1; // €1 tolerance for rounding
const IE_USC_MISMATCH_TOLERANCE = 1;

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
  severity?: IssueSeverity,
  data?: Record<string, unknown>
): RuleEvaluationOutcome => ({
  description,
  severity,
  data,
});

const buildSpikeData = (
  field: "paye" | "usc_or_ni",
  entry: DiffEntry,
  grossPercent: number | null
) => ({
  field,
  previousValue: entry.previous ?? null,
  currentValue: entry.current ?? null,
  difference: entry.delta ?? null,
  percentChange: entry.percentChange ?? null,
  grossPercentChange: grossPercent,
});

const baseRuleDefinitions: RuleDefinition[] = [
  {
    code: "NET_CHANGE_LARGE",
    descriptionTemplate: "Net pay changed significantly",
    severity: "warning",
    categories: ["net"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ diff, config }) => {
      const entry = diff.net_pay;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < config.largeNetChangePercent) return null;
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
    evaluate: ({ diff, config }) => {
      const entry = diff.gross_pay;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < config.largeGrossChangePercent) return null;
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
    evaluate: ({ diff, config }) => {
      const entry = diff.paye;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < config.payeSpikePercent) return null;
      const grossPercent = diff.gross_pay.percentChange;
      if (
        grossPercent !== null &&
        Math.abs(grossPercent) > config.maxGrossDeltaPercent
      ) {
        return null;
      }
      return applyIssue(
        `PAYE increased by ${formatPercent(entry.percentChange)} while gross pay stayed flat`,
        undefined,
        buildSpikeData("paye", entry, grossPercent)
      );
    },
  },
  {
    code: "USC_SPIKE_WITHOUT_GROSS",
    descriptionTemplate: "USC spike without gross movement",
    severity: "warning",
    categories: ["tax"],
    appliesTo: { countries: COUNTRY_ALL },
    evaluate: ({ diff, config }) => {
      const entry = diff.usc_or_ni;
      if (!hasPreviousData(entry) || entry.percentChange === null) return null;
      if (Math.abs(entry.percentChange) < config.uscSpikePercent) return null;
      const grossPercent = diff.gross_pay.percentChange;
      if (
        grossPercent !== null &&
        Math.abs(grossPercent) > config.maxGrossDeltaForUscPercent
      ) {
        return null;
      }
      return applyIssue(
        describeUscSpike(entry.percentChange, entry.previous, entry.current, grossPercent),
        undefined,
        buildSpikeData("usc_or_ni", entry, grossPercent)
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
    evaluate: ({ current, diff, config }) => {
      const grossCurrent = diff.gross_pay.current ?? null;
      if (!grossCurrent || grossCurrent === 0) return null;
      const pension = current.pension_employee ?? null;
      if (typeof pension !== "number") return null;
      const percent = (pension / grossCurrent) * 100;
      if (percent < config.pensionEmployeePercent) {
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
    evaluate: ({ current, diff, config }) => {
      const grossCurrent = diff.gross_pay.current ?? null;
      if (!grossCurrent || grossCurrent === 0) return null;
      const pension = current.pension_employer ?? null;
      if (typeof pension !== "number") return null;
      const percent = (pension / grossCurrent) * 100;
      if (percent < config.pensionEmployerPercent) {
        return null;
      }
      return applyIssue(
        describePensionPercent("Employer pension contribution", percent, pension, grossCurrent)
      );
    },
  },
  {
    code: "IE_PAYE_MISMATCH",
    descriptionTemplate: "PAYE does not match recalculated amount",
    severity: "warning",
    categories: ["tax", "compliance"],
    appliesTo: { countries: ["IE"] },
    evaluate: ({ current, config, ieContext }) => {
      if (!config.ieConfig) return null;
      const payeInputs = ieContext?.paye;
      if (!payeInputs) return null;
      const actualPaye =
        typeof current.paye === "number" && Number.isFinite(current.paye) ? current.paye : null;
      if (actualPaye === null) return null;
      const grossPay =
        typeof current.gross_pay === "number" && Number.isFinite(current.gross_pay)
          ? current.gross_pay
          : null;
      const calc = calcIePaye(grossPay, config.ieConfig, payeInputs);
      const delta = calc.netTax - actualPaye;
      if (Math.abs(delta) <= IE_PAYE_MISMATCH_TOLERANCE) {
        return null;
      }
      const formatNumber = (value: number) => Number(value.toFixed(2));
      return applyIssue(
        `PAYE expected ${formatAmount(calc.netTax)} but payslip shows ${formatAmount(actualPaye)}`,
        "warning",
        {
          expectedTax: formatNumber(calc.netTax),
          actualTax: formatNumber(actualPaye),
          difference: formatNumber(delta),
          standardBandUsed: formatNumber(calc.standardBandUsed),
          higherBandUsed: formatNumber(calc.higherBandUsed),
          standardTax: formatNumber(calc.standardTax),
          higherTax: formatNumber(calc.higherTax),
          creditsApplied: formatNumber(calc.creditsApplied),
        }
      );
    },
  },
  {
    code: "IE_USC_MISMATCH",
    descriptionTemplate: "USC does not match recalculated amount",
    severity: "warning",
    categories: ["tax", "compliance"],
    appliesTo: { countries: ["IE"] },
    evaluate: ({ current, config }) => {
      if (!config.ieConfig) return null;
      const actualUsc =
        typeof current.usc_or_ni === "number" && Number.isFinite(current.usc_or_ni)
          ? current.usc_or_ni
          : null;
      if (actualUsc === null) return null;
      const grossPay =
        typeof current.gross_pay === "number" && Number.isFinite(current.gross_pay)
          ? current.gross_pay
          : null;
      const calc = calcIeUsc(grossPay, config.ieConfig);
      const delta = calc.totalCharge - actualUsc;
      if (Math.abs(delta) <= IE_USC_MISMATCH_TOLERANCE) {
        return null;
      }
      const formatNumber = (value: number) => Number(value.toFixed(2));
      return applyIssue(
        `USC expected ${formatAmount(calc.totalCharge)} but payslip shows ${formatAmount(actualUsc)}`,
        "warning",
        {
          expectedUsc: formatNumber(calc.totalCharge),
          actualUsc: formatNumber(actualUsc),
          difference: formatNumber(delta),
          bands: calc.bandUsage.map((band) => ({
            rate: band.rate,
            amount: formatNumber(band.amount),
            charge: formatNumber(band.charge),
            upperLimit: band.upperLimit,
          })),
        }
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

