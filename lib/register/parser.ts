import type { PayslipLike } from "@/lib/logic/payslipDiff";

export type RegisterEntry = {
  employee_id: string | null;
  entry_type: "employee" | "batch_total";
  gross_pay: number;
  net_pay: number;
  paye: number;
  usc_or_ni?: number;
  nic_employee?: number;
  nic_employer?: number;
  student_loan?: number;
  postgrad_loan?: number;
};

const parseNumber = (value: string | undefined) => {
  const num = Number(value?.trim() ?? "");
  return Number.isFinite(num) ? num : 0;
};

export const parseRegisterCsv = (csv: string): RegisterEntry[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const entries: RegisterEntry[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = parts[index] ?? "";
    });
    const employeeId = (record["employee_id"] || record["employee"] || "").trim();
    const entry_type = employeeId ? ("employee" as const) : ("batch_total" as const);
    entries.push({
      employee_id: employeeId || null,
      entry_type,
      gross_pay: parseNumber(record["gross_pay"] ?? record["gross"]),
      net_pay: parseNumber(record["net_pay"] ?? record["net"]),
      paye: parseNumber(record["paye"] ?? record["tax"]),
      usc_or_ni: parseNumber(record["usc_or_ni"] ?? record["usc"] ?? record["ni"]),
      nic_employee: parseNumber(record["nic_employee"] ?? record["ee_ni"]),
      nic_employer: parseNumber(record["nic_employer"] ?? record["er_ni"]),
      student_loan: parseNumber(record["student_loan"] ?? record["sl"]),
      postgrad_loan: parseNumber(record["postgrad_loan"] ?? record["pg"]),
    });
  }

  return entries;
};

export const sumPayslipTotals = (payslips: PayslipLike[]) => {
  return payslips.reduce(
    (acc, p) => {
      acc.gross_pay += p.gross_pay ?? 0;
      acc.net_pay += p.net_pay ?? 0;
      acc.paye += p.paye ?? 0;
      acc.usc_or_ni += p.usc_or_ni ?? 0;
      return acc;
    },
    { gross_pay: 0, net_pay: 0, paye: 0, usc_or_ni: 0 }
  );
};
