import type { UkTaxYearConfig } from "@/lib/rules/ukConfig";

/**
 * Reference sources (HMRC):
 * - PAYE income tax rates and bands 2025/26: https://www.gov.uk/income-tax-rates
 * - Personal Allowance: https://www.gov.uk/income-tax-rates
 * - National Insurance thresholds and rates 2025/26: https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026
 * - Student loan and postgraduate loan thresholds: https://www.gov.uk/guidance/student-loan-and-postgraduate-loan-deductions-for-employers-2025-to-2026
 */
export const uk2025Config: UkTaxYearConfig = {
  year: 2025,
  references: [
    "https://www.gov.uk/income-tax-rates",
    "https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026",
    "https://www.gov.uk/guidance/student-loan-and-postgraduate-loan-deductions-for-employers-2025-to-2026",
  ],
  paye: {
    personalAllowance: 12570,
    bands: [
      { label: "basic_rate", rate: 0.2, upTo: 50270 },
      { label: "higher_rate", rate: 0.4, upTo: 125140 },
      { label: "additional_rate", rate: 0.45, upTo: null },
    ],
  },
  nic: {
    thresholds: {
      primaryThresholdWeekly: 242,
      secondaryThresholdWeekly: 175,
      upperEarningsLimitWeekly: 967,
      freePortUpperWeekly: 481,
    },
    rates: {
      employeeLowerRate: 0.08,
      employeeUpperRate: 0.02,
      employerRate: 0.138,
      employerFreePortRate: 0.00,
    },
  },
  studentLoans: [
    { plan: "Plan1", thresholdAnnual: 24990, rate: 0.09 },
    { plan: "Plan2", thresholdAnnual: 28999, rate: 0.09 },
    { plan: "Plan4", thresholdAnnual: 31995, rate: 0.09 },
    { plan: "Plan5", thresholdAnnual: 27029, rate: 0.09 },
    { plan: "Postgrad", thresholdAnnual: 25000, rate: 0.06 },
  ],
};
