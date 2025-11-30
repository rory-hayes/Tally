const NUMERIC_FIELDS = [
  "gross_pay",
  "net_pay",
  "paye",
  "usc_or_ni",
  "pension_employee",
  "pension_employer",
  "ytd_gross",
  "ytd_net",
  "ytd_tax",
  "ytd_usc_or_ni",
] as const;

export type PayslipNumericField = (typeof NUMERIC_FIELDS)[number];

export type PayslipLike = Partial<Record<PayslipNumericField, number | null | undefined>>;

export type DiffEntry = {
  previous: number | null;
  current: number | null;
  delta: number | null;
  percentChange: number | null;
};

export type PayslipDiff = Record<PayslipNumericField, DiffEntry>;

const normaliseValue = (value: number | null | undefined) =>
  typeof value === "number" ? value : null;

const calculateDelta = (current: number | null, previous: number | null) => {
  if (current === null || previous === null) {
    return current !== null && previous === null
      ? current
      : current === null && previous !== null
      ? -previous
      : null;
  }
  return current - previous;
};

const calculatePercentChange = (delta: number | null, previous: number | null) => {
  if (delta === null || previous === null || previous === 0) {
    return null;
  }
  return (delta / Math.abs(previous)) * 100;
};

/**
 * Calculates the numeric deltas between two payslips for the key payroll fields.
 * All operations are pure and do not mutate the provided inputs.
 */
export const calculateDiff = (
  previous: PayslipLike | null | undefined,
  current: PayslipLike | null | undefined
): PayslipDiff => {
  if (!current) {
    throw new Error("Current payslip is required to calculate diff");
  }

  const prevValues = previous ?? {};
  const currValues = current;

  return NUMERIC_FIELDS.reduce<PayslipDiff>((acc, field) => {
    const prevValue = normaliseValue(prevValues[field]);
    const currValue = normaliseValue(currValues[field]);
    const delta = calculateDelta(currValue, prevValue);
    acc[field] = {
      previous: prevValue,
      current: currValue,
      delta,
      percentChange: calculatePercentChange(delta, prevValue),
    };
    return acc;
  }, {} as PayslipDiff);
};

