export type PaymentRecord = {
  employee_id: string | null;
  employee_ref?: string | null;
  amount: number;
  currency?: string | null;
  reference?: string | null;
};

const parseNumber = (value: string | undefined) => {
  const num = Number((value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

export const parsePaymentCsv = (csv: string): PaymentRecord[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const records: PaymentRecord[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = parts[idx] ?? "";
    });
    records.push({
      employee_id: (record["employee_id"] || record["employee"] || "").trim() || null,
      employee_ref: record["employee_ref"] ?? null,
      amount: parseNumber(record["amount"] ?? record["net_pay"]),
      currency: record["currency"] ?? null,
      reference: record["reference"] ?? record["ref"] ?? null,
    });
  }
  return records;
};
