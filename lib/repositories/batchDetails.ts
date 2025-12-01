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

export type JobSummary = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  failedJobs: { id: string; storagePath: string; error: string | null }[];
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
  jobs: JobSummary;
};

type PayslipRecord = {
  id: string;
  employee_id: string;
  employees: { name: string | null; external_employee_ref: string | null } | null;
};

type IssueRow = {
  employee_id: string | null;
  severity: IssueSeverity | null;
};

type ProcessingJobRow = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  storage_path: string;
  error: string | null;
};

const emptyIssueCounts = (): Record<IssueSeverity, number> => ({
  critical: 0,
  warning: 0,
  info: 0,
});

export const buildEmployeeIssueSummaries = (
  payslips: PayslipRecord[] | null | undefined,
  issues: IssueRow[] | null | undefined
): { employees: EmployeeIssueSummary[]; totals: Record<IssueSeverity, number> } => {
  const issueMap = new Map<string, Record<IssueSeverity, number>>();
  (issues ?? []).forEach((issue) => {
    if (!issue.employee_id || !issue.severity || !ISSUE_LEVELS.includes(issue.severity)) {
      return;
    }
    const counts = issueMap.get(issue.employee_id) ?? emptyIssueCounts();
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
    issueMap.set(issue.employee_id, counts);
  });

  const employees: EmployeeIssueSummary[] =
    payslips?.map((payslip) => {
      const issueCounts = issueMap.get(payslip.employee_id) ?? emptyIssueCounts();
      const employeeData = payslip.employees as PayslipRecord["employees"];
      return {
        employeeId: payslip.employee_id,
        employeeName:
          employeeData && !Array.isArray(employeeData)
            ? employeeData.name ?? "Employee"
            : "Employee",
        employeeRef:
          employeeData && !Array.isArray(employeeData)
            ? employeeData.external_employee_ref ?? null
            : null,
        payslipId: payslip.id,
        issues: issueCounts,
      };
    }) ?? [];

  const totals = Array.from(issueMap.values()).reduce(
    (acc, counts) => {
      ISSUE_LEVELS.forEach((level) => {
        acc[level] += counts[level];
      });
      return acc;
    },
    emptyIssueCounts()
  );

  return { employees, totals };
};

const summarizeJobs = (jobs: ProcessingJobRow[] | null | undefined): JobSummary => {
  const summary: JobSummary = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    failedJobs: [],
  };

  (jobs ?? []).forEach((job) => {
    if (job.status === "pending") summary.pending += 1;
    if (job.status === "processing") summary.processing += 1;
    if (job.status === "completed") summary.completed += 1;
    if (job.status === "failed") {
      summary.failedJobs.push({
        id: job.id,
        storagePath: job.storage_path,
        error: job.error,
      });
    }
  });

  summary.failed = summary.failedJobs.length;
  return summary;
};

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

  const { data: issueRows, error: issuesError } = await supabase
    .from("issues")
    .select("employee_id, severity")
    .eq("organisation_id", organisationId)
    .eq("batch_id", batchId)
    .eq("resolved", false);

  if (issuesError) {
    throw new Error(`Failed to load issues: ${issuesError.message}`);
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
      )
    `
    )
    .eq("organisation_id", organisationId)
    .eq("batch_id", batchId);

  if (payslipError) {
    throw new Error(payslipError.message);
  }

  const { data: processingJobs, error: jobsError } = await supabase
    .from("processing_jobs")
    .select("id, status, storage_path, error")
    .eq("organisation_id", organisationId)
    .eq("batch_id", batchId);

  if (jobsError) {
    throw new Error(`Failed to load processing jobs: ${jobsError.message}`);
  }

  const { employees, totals } = buildEmployeeIssueSummaries(
    payslips as PayslipRecord[] | null,
    issueRows as IssueRow[] | null
  );
  const jobs = summarizeJobs(processingJobs as ProcessingJobRow[] | null);

  return {
    batch: batchRow as BatchMeta,
    employees,
    totals: {
      employeesProcessed: employees.length,
      ...totals,
    },
    jobs,
  };
}

