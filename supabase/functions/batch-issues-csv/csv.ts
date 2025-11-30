export type BatchIssueCsvRow = {
  employeeName: string | null;
  employeeRef: string | null;
  ruleCode: string;
  severity: string;
  description: string;
  values?: string | null;
};

const HEADERS = ["employee", "employee_ref", "rule_code", "severity", "description", "values"];

const sanitise = (value: string | null | undefined) => {
  if (!value) return "";
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export function buildBatchIssuesCsv(rows: BatchIssueCsvRow[]): string {
  const lines = [HEADERS.join(",")];

  rows.forEach((row) => {
    const cells = [
      sanitise(row.employeeName),
      sanitise(row.employeeRef),
      sanitise(row.ruleCode),
      sanitise(row.severity),
      sanitise(row.description),
      sanitise(row.values ?? null),
    ];
    lines.push(cells.join(","));
  });

  return lines.join("\r\n");
}

