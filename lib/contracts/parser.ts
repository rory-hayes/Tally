export type ContractCsvRow = {
  employee_id: string;
  salary_amount?: number | null;
  salary_period?: string | null;
  hourly_rate?: number | null;
  standard_hours_per_week?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  metadata?: Record<string, unknown> | null;
};

const parseNumber = (value: string | undefined) => {
  const num = Number((value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : null;
};

const normalizeDate = (value: string | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed.slice(0, 10);
};

export const parseContractCsv = (csv: string): ContractCsvRow[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: ContractCsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = parts[idx] ?? "";
    });
    const employeeId = (record["employee_id"] || record["employee"] || "").trim();
    if (!employeeId) continue;
    rows.push({
      employee_id: employeeId,
      salary_amount: parseNumber(record["salary_amount"] ?? record["salary"]),
      salary_period: record["salary_period"]?.trim() || null,
      hourly_rate: parseNumber(record["hourly_rate"]),
      standard_hours_per_week: parseNumber(record["standard_hours_per_week"]),
      effective_from: normalizeDate(record["effective_from"]),
      effective_to: normalizeDate(record["effective_to"]),
    });
  }

  return rows;
};
