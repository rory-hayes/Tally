type Numeric = number | string | null | undefined;

export type NormalizedPayslip = {
  employeeName: string;
  employeeExternalRef?: string;
  payDate: string;
  grossPay?: number;
  netPay?: number;
  paye?: number;
  uscOrNi?: number;
  pensionEmployee?: number;
  pensionEmployer?: number;
  ytdGross?: number;
  ytdNet?: number;
  ytdTax?: number;
  ytdUscOrNi?: number;
  taxCode?: string;
  prsiOrNiCategory?: string;
  raw: Record<string, unknown>;
};

const asNumber = (value: Numeric): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const deriveEmployeeRef = (storagePath: string) => {
  const fileName = storagePath.split("/").pop() ?? "payslip.pdf";
  const match = fileName.match(/(EMP[\w\d]+)/i);
  return match?.[0] ?? fileName.replace(/\.pdf$/i, "");
};

export const normalizeOcrPayload = (
  payload: unknown,
  storagePath: string
): NormalizedPayslip => {
  const data = (payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const employee =
    (data.employee as Record<string, unknown> | undefined) ?? undefined;

  const employeeName =
    (data.employee_name as string | undefined) ??
    (employee?.name as string | undefined) ??
    deriveEmployeeRef(storagePath);

  const employeeExternalRef =
    (data.employee_ref as string | undefined) ??
    (employee?.external_id as string | undefined) ??
    deriveEmployeeRef(storagePath);

  const payDate =
    (data.pay_date as string | undefined) ??
    new Date().toISOString().slice(0, 10);

  return {
    employeeName,
    employeeExternalRef,
    payDate,
    grossPay: asNumber(data.gross_pay as Numeric),
    netPay: asNumber(data.net_pay as Numeric),
    paye: asNumber((data.paye ?? data.tax) as Numeric),
    uscOrNi: asNumber((data.usc_or_ni ?? data.ni) as Numeric),
    pensionEmployee: asNumber(data.pension_employee as Numeric),
    pensionEmployer: asNumber(data.pension_employer as Numeric),
    ytdGross: asNumber(data.ytd_gross as Numeric),
    ytdNet: asNumber(data.ytd_net as Numeric),
    ytdTax: asNumber(data.ytd_tax as Numeric),
    ytdUscOrNi: asNumber((data.ytd_usc_or_ni ?? data.ytd_ni) as Numeric),
    taxCode:
      (data.tax_code as string | undefined) ??
      (employee?.tax_code as string | undefined),
    prsiOrNiCategory:
      (data.prsi_or_ni_category as string | undefined) ??
      (employee?.category as string | undefined),
    raw: data,
  };
};

export const createStubPayslip = (storagePath: string): NormalizedPayslip => {
  const ref = deriveEmployeeRef(storagePath);
  return {
    employeeName: `Employee ${ref}`,
    employeeExternalRef: ref,
    payDate: new Date().toISOString().slice(0, 10),
    grossPay: 0,
    netPay: 0,
    raw: { stub: true, source: storagePath },
  };
};

export const shouldCompleteBatch = (
  processedFiles: number,
  totalFiles: number
) => processedFiles >= totalFiles && totalFiles > 0;

export const buildJobStatusUpdate = (
  success: boolean,
  error?: string
) => ({
  status: success ? "completed" : "failed",
  error: success ? null : error?.slice(0, 500) ?? null,
});

export type SupabaseUpdater = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<unknown>;
    };
  };
};

export const markJobStatusRecord = async (
  client: SupabaseUpdater,
  jobId: string,
  success: boolean,
  errorMessage?: string
) => {
  const update = buildJobStatusUpdate(success, errorMessage);
  await client.from("processing_jobs").update(update).eq("id", jobId);
};

export const buildBatchUpdatePayload = (
  processedFiles: number,
  totalFiles: number
) => {
  const updates: Record<string, unknown> = {
    processed_files: processedFiles,
  };

  if (shouldCompleteBatch(processedFiles, totalFiles)) {
    updates.status = "completed";
    updates.completed_at = new Date().toISOString();
  }

  return updates;
};

