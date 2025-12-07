export type BatchIssueCsvRow = {
  employeeName: string | null;
  employeeRef: string | null;
  ruleCode: string;
  severity: string;
  description: string;
  values?: string | null;
};

export type BatchIssueCsvSummary = {
  batchId: string;
  periodLabel: string | null;
  payDate: string | null;
  status: string | null;
  processedFiles: number | null;
  totalFiles: number | null;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
};

const SUMMARY_HEADERS = [
  "batch_id",
  "period_label",
  "pay_date",
  "status",
  "processed_files",
  "total_files",
  "critical_issues",
  "warning_issues",
  "info_issues",
];
const HEADERS = ["employee", "employee_ref", "rule_code", "severity", "description", "values"];

const sanitise = (value: string | null | undefined) => {
  if (!value) return "";
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const formatNullableNumber = (value: number | null) =>
  value === null || value === undefined ? "" : String(value);

export function buildBatchIssuesCsv(rows: BatchIssueCsvRow[], summary: BatchIssueCsvSummary): string {
  const lines = [
    SUMMARY_HEADERS.join(","),
    [
      summary.batchId,
      summary.periodLabel ?? "",
      summary.payDate ?? "",
      summary.status ?? "",
      formatNullableNumber(summary.processedFiles),
      formatNullableNumber(summary.totalFiles),
      formatNullableNumber(summary.criticalCount),
      formatNullableNumber(summary.warningCount),
      formatNullableNumber(summary.infoCount),
    ]
      .map(sanitise)
      .join(","),
    "",
    HEADERS.join(","),
  ];

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
