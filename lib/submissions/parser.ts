export type SubmissionSummary = {
  paye_total: number;
  usc_or_ni_total: number;
  employee_count: number;
  tax_year?: number | null;
};

const parseNumber = (value: string | undefined) => {
  const num = Number((value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

export const parseSubmissionCsv = (csv: string): SubmissionSummary => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return { paye_total: 0, usc_or_ni_total: 0, employee_count: 0, tax_year: null };
  }
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const parts = lines[1].split(",");
  const record: Record<string, string> = {};
  headers.forEach((header, idx) => {
    record[header] = parts[idx] ?? "";
  });
  return {
    paye_total: parseNumber(record["paye_total"] ?? record["paye"]),
    usc_or_ni_total: parseNumber(record["usc_or_ni_total"] ?? record["usc"] ?? record["ni"]),
    employee_count: Number(record["employee_count"] ?? 0),
    tax_year: record["tax_year"] ? Number(record["tax_year"]) : null,
  };
};
