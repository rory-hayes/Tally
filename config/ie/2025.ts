import type { IeTaxYearConfig } from "@/lib/rules/ieConfig";

/**
 * Reference sources:
 * - Revenue.ie “Income tax rates and rate bands” (Tax and Duty Manual Part 44-01-01)
 *   https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-rates-bands-and-reliefs/income-tax-rates-and-rate-bands.aspx
 * - Revenue.ie “Universal Social Charge (USC)” (Tax and Duty Manual Part 18C-00-01)
 *   https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/usc/index.aspx
 * - Revenue.ie “PRSI contribution rates” (Department of Social Protection guide SW14)
 *   https://www.gov.ie/en/publication/34f4a-social-insurance-prsi-rates/
 */
export const ie2025Config: IeTaxYearConfig = {
  year: 2025,
  references: [
    "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-rates-bands-and-reliefs/income-tax-rates-and-rate-bands.aspx",
    "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/usc/index.aspx",
    "https://www.gov.ie/en/publication/34f4a-social-insurance-prsi-rates/",
  ],
  paye: {
    standardRate: 0.2,
    higherRate: 0.4,
    bands: [
      {
        category: "single",
        standardRateCutoff: 42000,
        notes: "Single or widowed without dependent child.",
      },
      {
        category: "married_one_income",
        standardRateCutoff: 49000,
        notes: "Married/civil partnership single-earner household.",
      },
      {
        category: "married_two_income",
        standardRateCutoff: 84000,
        notes: "Married/civil partnership dual-earner (up to €33k transferable).",
      },
      {
        category: "single_parent",
        standardRateCutoff: 46000,
        notes: "Single parent / widowed parent.",
      },
    ],
  },
  usc: {
    bands: [
      { upTo: 12012, rate: 0.005 },
      { upTo: 25760, rate: 0.02 },
      { upTo: 70044, rate: 0.045 },
      { upTo: Infinity, rate: 0.08 },
    ],
    surcharge: {
      rate: 0.11,
      appliesAbove: 100000,
      note: "Self-employed surcharge on income above €100k.",
    },
    reducedRates: [
      {
        label: "Full medical card",
        rate: 0.02,
        appliesUpTo: 92543,
      },
    ],
  },
  prsi: {
    classes: {
      A: {
        class: "A",
        employeeRate: 0.04,
        employerRate: 0.1105,
        weeklyThreshold: 352,
        note: "Most private-sector employees.",
      },
      S: {
        class: "S",
        employeeRate: 0.04,
        employerRate: 0,
        weeklyThreshold: 0,
        note: "Self-employed earners; 4% on all reckonable income.",
      },
      J: {
        class: "J",
        employeeRate: 0.005,
        employerRate: 0.005,
        weeklyThreshold: 0,
        note: "Certain civil/public servants recruited pre-April 1995.",
      },
    },
    credit: {
      maxWeeklyCredit: 12,
      tapersToZeroAt: 424,
    },
  },
};

