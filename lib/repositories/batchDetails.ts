import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type IssueSeverity = "critical" | "warning" | "info";

const ISSUE_LEVELS: IssueSeverity[] = ["critical", "warning", "info"];

export type BatchMeta = {
  id: string;
  organisation_id: string;
  client_id: string;
  period_label: string;
  status: string;
  total_files: number;
  processed_files: number;
  created_at: string;
};

export type EmployeeIssueSummary = {
  employeeId: string;
  employeeName: string;
  employeeRef: string | null;
  payslipId: string;
  issues: Record<IssueSeverity, number>;
};

export type BatchDetail = {
  batch: BatchMeta;
  employees: EmployeeIssueSummary[];
  totals: {
    employeesProcessed: number;
    critical: number;
    warning: number;
    info: number;
  };
};

type PayslipRecord = {
  id: string;
  employee_id: string;
  employees: { name: string | null; external_employee_ref: string | null } | null;
  issues: { severity: IssueSeverity }[] | null;
};

const emptyIssueCounts = (): Record<IssueSeverity, number> => ({
  critical: 0,
  warning: 0,
  info: 0,
});

export async function fetchBatchDetail(
  organisationId: string,
  batchId: string
): Promise<BatchDetail> {
  const supabase = getSupabaseBrowserClient();

  const { data: batchRow, error: batchError } = await supabase
    .from("batches")
    .select(
      "id, organisation_id, client_id, period_label, status, total_files, processed_files, created_at"
    )
    .eq("organisation_id", organisationId)
    .eq("id", batchId)
    .maybeSingle();

  if (batchError) {
    throw new Error(batchError.message);
  }

  if (!batchRow) {
    throw new Error("Batch not found");
  }

  const { data: payslips, error: payslipError } = await supabase
    .from("payslips")
    .select(
      `
      id,
      employee_id,
      employees:employees (
        name,
        external_employee_ref
      ),
      issues:issues (
        severity
      )
    `
    )
    .eq("organisation_id", organisationId)
    .eq("batch_id", batchId);

  if (payslipError) {
    throw new Error(payslipError.message);
  }

  const employees: EmployeeIssueSummary[] = (payslips ?? []).map(
    (payslip) => {
      const issueCounts = (payslip.issues ?? []).reduce(
        (acc, issue) => {
          if (issue.severity && ISSUE_LEVELS.includes(issue.severity)) {
            const level = issue.severity as IssueSeverity;
            acc[level] = (acc[level] ?? 0) + 1;
          }
          return acc;
        },
        emptyIssueCounts()
      );

      return {
        employeeId: payslip.employee_id,
        employeeName:
          payslip.employees && !Array.isArray(payslip.employees)
            ? ((payslip.employees as PayslipRecord["employees"])?.name ?? "Employee")
            : "Employee",
        employeeRef:
          payslip.employees && !Array.isArray(payslip.employees)
            ? (payslip.employees as PayslipRecord["employees"])?.external_employee_ref ?? null
            : null,
        payslipId: payslip.id,
        issues: issueCounts,
      };
    }
  ) ?? [];

  const totals = employees.reduce(
    (acc, employee) => {
      ISSUE_LEVELS.forEach((level) => {
        acc[level] += employee.issues[level];
      });
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  return {
    batch: batchRow as BatchMeta,
    employees,
    totals: {
      employeesProcessed: employees.length,
      ...totals,
    },
  };
}

