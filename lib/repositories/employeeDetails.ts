import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { calculateDiff, type PayslipLike, type PayslipDiff } from "@/lib/logic/payslipDiff";
import { logAuditEvent } from "@/lib/repositories/auditLogs";

export type IssueSeverity = "critical" | "warning" | "info";

export type IssueRow = {
  id: string;
  rule_code: string;
  severity: IssueSeverity;
  description: string;
  data: Record<string, unknown> | null;
  resolved: boolean;
  note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type EmployeeComparison = {
  employeeId: string;
  employeeName: string;
  employeeRef: string | null;
  batchId: string;
  clientId: string;
  currentBatchPeriodLabel: string | null;
  previousBatchPeriodLabel: string | null;
  currentBatchPayDate: string | null;
  previousBatchPayDate: string | null;
  currentPayslip: PayslipLike & { id: string; pay_date?: string | null };
  previousPayslip: (PayslipLike & { id: string; pay_date?: string | null }) | null;
  diff: PayslipDiff;
  issues: IssueRow[];
};

type PayslipRecord = {
  id: string;
  organisation_id: string;
  client_id: string;
  employee_id: string;
  batch_id: string;
  pay_date?: string | null;
  gross_pay?: number | null;
  net_pay?: number | null;
  paye?: number | null;
  usc_or_ni?: number | null;
  nic_employee?: number | null;
  nic_employer?: number | null;
  student_loan?: number | null;
  postgrad_loan?: number | null;
  pension_employee?: number | null;
  pension_employer?: number | null;
  ytd_gross?: number | null;
  ytd_net?: number | null;
  ytd_tax?: number | null;
  ytd_usc_or_ni?: number | null;
  prsi_or_ni_category?: string | null;
  employees: { name: string | null; external_employee_ref: string | null } | null;
};

export const pickPreviousPayslip = (
  payslips: PayslipRecord[] | null | undefined,
  currentBatchId: string
): PayslipRecord | null => {
  if (!payslips?.length) return null;
  const current = payslips.find((p) => p.batch_id === currentBatchId);
  if (!current) return null;
  const otherPayslips = payslips.filter((p) => p.batch_id !== currentBatchId);
  if (!otherPayslips.length) return null;

  if (current.pay_date) {
    const currentDate = new Date(`${current.pay_date}T00:00:00`);
    const earlier = otherPayslips.find(
      (p) => p.pay_date && new Date(`${p.pay_date}T00:00:00`) < currentDate
    );
    if (earlier) {
      return earlier;
    }
    return null;
  }

  return otherPayslips[0] ?? null;
};

export async function fetchEmployeeComparison(args: {
  organisationId: string;
  employeeId: string;
  batchId: string;
}): Promise<EmployeeComparison> {
  const supabase = getSupabaseBrowserClient();
  const { organisationId, employeeId, batchId } = args;

  const { data: payslips, error } = await supabase
    .from("payslips")
    .select(
      `
        id,
        organisation_id,
        client_id,
        employee_id,
        batch_id,
        pay_date,
        gross_pay,
        net_pay,
        paye,
        usc_or_ni,
        nic_employee,
        nic_employer,
        student_loan,
        postgrad_loan,
        pension_employee,
        pension_employer,
        ytd_gross,
        ytd_net,
        ytd_tax,
        ytd_usc_or_ni,
        prsi_or_ni_category,
        employees:employees (
          name,
          external_employee_ref
        )
      `
    )
    .eq("organisation_id", organisationId)
    .eq("employee_id", employeeId)
    .order("pay_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const currentPayslip = (payslips ?? []).find((p) => p.batch_id === batchId);

  if (!currentPayslip) {
    throw new Error("Payslip not found for employee in this batch");
  }

  const previousPayslip = pickPreviousPayslip(
    payslips as PayslipRecord[] | null | undefined,
    batchId
  );
  const employeeName =
    currentPayslip.employees && !Array.isArray(currentPayslip.employees)
      ? (currentPayslip.employees as PayslipRecord["employees"])?.name ?? "Employee"
      : "Employee";
  const employeeRef =
    currentPayslip.employees && !Array.isArray(currentPayslip.employees)
      ? (currentPayslip.employees as PayslipRecord["employees"])?.external_employee_ref ?? null
      : null;

  const diff = calculateDiff(
    (previousPayslip as PayslipLike | null | undefined),
    currentPayslip as PayslipLike
  );

  const batchIds = Array.from(
    new Set(
      [currentPayslip.batch_id, previousPayslip?.batch_id].filter(
        (value): value is string => typeof value === "string" && value.length > 0
      )
    )
  );
  const batchMetadata = new Map<string, { period_label: string | null; pay_date: string | null }>();
  if (batchIds.length > 0) {
    const { data: batchRows, error: batchLookupError } = await supabase
      .from("batches")
      .select("id, period_label, pay_date")
      .in("id", batchIds);

    if (batchLookupError) {
      throw new Error(batchLookupError.message);
    }

    batchRows?.forEach((row) => {
      batchMetadata.set(row.id, {
        period_label: row.period_label ?? null,
        pay_date: row.pay_date ?? null,
      });
    });
  }

  const { data: issuesData, error: issuesError } = await supabase
    .from("issues")
    .select(
      `
        id,
        rule_code,
        severity,
        description,
        data,
        resolved,
        note,
        resolved_at,
        resolved_by
      `
    )
    .eq("organisation_id", organisationId)
    .eq("batch_id", batchId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: true });

  if (issuesError) {
    throw new Error(`Failed to load issues: ${issuesError.message}`);
  }

  const filteredIssues = ((issuesData ?? []) as IssueRow[]).filter(
    (issue) => issue.rule_code !== "ocr_ingest"
  );

  return {
    employeeId,
    employeeName,
    employeeRef,
    batchId,
    clientId: currentPayslip.client_id,
    currentBatchPeriodLabel: batchMetadata.get(currentPayslip.batch_id)?.period_label ?? null,
    currentBatchPayDate: batchMetadata.get(currentPayslip.batch_id)?.pay_date ?? null,
    previousBatchPeriodLabel: previousPayslip?.batch_id
      ? batchMetadata.get(previousPayslip.batch_id)?.period_label ?? null
      : null,
    previousBatchPayDate: previousPayslip?.batch_id
      ? batchMetadata.get(previousPayslip.batch_id)?.pay_date ?? null
      : null,
    currentPayslip,
    previousPayslip,
    diff,
    issues: filteredIssues,
  };
}

export async function updateIssueResolution(args: {
  issueId: string;
  resolved: boolean;
  note?: string | null;
  audit?: {
    organisationId: string;
    actorId: string;
    batchId: string;
    employeeId: string;
  };
}) {
  const supabase = getSupabaseBrowserClient();
  const { issueId, resolved, note, audit } = args;
  const resolvedAt = resolved ? new Date().toISOString() : null;
  const resolvedBy = resolved ? audit?.actorId ?? null : null;
  const updatePayload = {
    resolved,
    note: note ?? null,
    resolved_at: resolvedAt,
    resolved_by: resolvedBy,
  };
  const { error } = await supabase
    .from("issues")
    .update(updatePayload)
    .eq("id", issueId);

  if (error) {
    throw new Error(error.message);
  }

  if (audit) {
    await logAuditEvent({
      organisationId: audit.organisationId,
      actorId: audit.actorId,
      action: resolved ? "issue_resolved" : "issue_unresolved",
      metadata: {
        issueId,
        batchId: audit.batchId,
        employeeId: audit.employeeId,
        note: note ?? null,
      },
    });
  }
}
