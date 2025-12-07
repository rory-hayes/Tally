import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import {
  TextractClient,
  DetectDocumentTextCommand,
} from "npm:@aws-sdk/client-textract";
import {
  NormalizedTextractResult,
  buildPayslipInsert,
  deriveIdentifierFromPath,
  ensureNormalizedHasContent,
  listMissingFields,
  normalizeTextractResponse,
  resolvePayDate,
} from "./helpers.ts";
import {
  PAYSLIP_SELECT_FIELDS,
  buildIssuesForPayslip,
  type PayslipForRules,
} from "./rules.ts";
import {
  getDefaultRuleConfig,
  mergeRuleConfig,
} from "../../../lib/rules/config.ts";
import type { CountryCode, RuleConfig } from "../../../lib/rules/types.ts";

type JobRow = {
  id: string;
  organisation_id: string;
  client_id: string;
  batch_id: string;
  storage_path: string;
};

const SUPABASE_URL =
  Deno.env.get("PROJECT_URL") ??
  Deno.env.get("SERVICE_SUPABASE_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const STORAGE_BUCKET = Deno.env.get("STORAGE_BUCKET") ?? "payslips";
const JOB_PROCESSOR_BATCH_SIZE = Number(
  Deno.env.get("JOB_PROCESSOR_BATCH_SIZE") ?? "5"
);

const AWS_REGION = Deno.env.get("AWS_REGION");
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL/PROJECT_URL or SERVICE_ROLE_KEY environment variables."
  );
}

if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  throw new Error(
    "Missing AWS credentials. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
  );
}

const textractClient = new TextractClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: jobs, error } = await supabase
    .from("processing_jobs")
    .select("id, organisation_id, client_id, batch_id, storage_path")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(JOB_PROCESSOR_BATCH_SIZE);

  if (error) {
    console.error("[process_batch] Failed to fetch jobs", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!jobs || jobs.length === 0) {
    console.log("[process_batch] No pending jobs");
    return new Response(
      JSON.stringify({ processed: 0, completed: 0, failed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const processedResults = [];

  for (const job of jobs) {
    console.log(`[process_batch] Starting job ${job.id}`);
    const result = await handleJob(supabase, job);
    processedResults.push(result);
  }

  const summary = processedResults.reduce(
    (acc, curr) => {
      if (curr.status === "completed") {
        acc.completed += 1;
      } else {
        acc.failed += 1;
      }
      return acc;
    },
    { completed: 0, failed: 0 }
  );

  return new Response(
    JSON.stringify({ processed: jobs.length, ...summary }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

async function handleJob(
  supabase: ReturnType<typeof createClient>,
  job: JobRow
) {
  try {
    const batchMeta = await fetchBatchMeta(supabase, job.batch_id, job.organisation_id);
    const bytes = await loadFileFromStorage(supabase, job.storage_path);
    console.log(`[process_batch] Downloaded ${job.storage_path}`);

    const rawOcr = await ocrFile(bytes);
    console.log(`[process_batch] Textract call finished for ${job.id}`);

    const normalized = normalizeTextractResponse(rawOcr);
    ensureNormalizedHasContent(normalized);
    console.log(`[process_batch] Normalised response for ${job.id}`);
    const missingFields = listMissingFields(normalized);
    if (missingFields.length) {
      console.warn(
        `[process_batch] Missing numeric fields for job ${job.id}: ${missingFields.join(
          ", "
        )}`
      );
    }

    const employeeId = await resolveEmployee(supabase, job);
    const previousPayslip = await fetchPreviousPayslip(supabase, job, employeeId);
    const payDate = resolvePayDate(
      batchMeta.pay_date,
      normalized.pay_date,
      batchMeta.period_label,
      batchMeta.created_at
    );
    if (!payDate) {
      throw new Error("Unable to determine pay date for payslip");
    }
    const currentPayslip = await insertPayslip(supabase, job, employeeId, normalized, payDate);
    await insertPayDateMismatchIssue(
      supabase,
      job,
      employeeId,
      payDate,
      normalized.pay_date
    );
    await insertInfoIssue(supabase, job, employeeId, normalized);
    await insertRuleIssues(supabase, currentPayslip, previousPayslip);
    await markJobStatus(supabase, job.id, true);
    await refreshBatchProgress(supabase, job.batch_id);

    console.log(`[process_batch] Job ${job.id} completed`);
    return { id: job.id, status: "completed" as const };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown processing error";
    console.error(`[process_batch] Job ${job.id} failed`, message);
    await markJobStatus(supabase, job.id, false, message);
    await refreshBatchProgress(supabase, job.batch_id);
    return { id: job.id, status: "failed" as const, error: message };
  }
}

async function loadFileFromStorage(
  supabase: ReturnType<typeof createClient>,
  storagePath: string
) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(
      error?.message ?? `Unable to download file at ${storagePath}`
    );
  }
  const buffer = await data.arrayBuffer();
  return new Uint8Array(buffer);
}

async function ocrFile(bytes: Uint8Array) {
  const command = new DetectDocumentTextCommand({
    Document: { Bytes: bytes },
  });
  return textractClient.send(command);
}

async function resolveEmployee(
  supabase: ReturnType<typeof createClient>,
  job: JobRow
) {
  const identifier = deriveIdentifierFromPath(job.storage_path);
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("organisation_id", job.organisation_id)
    .eq("client_id", job.client_id)
    .eq("external_employee_ref", identifier)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("employees")
    .insert({
      organisation_id: job.organisation_id,
      client_id: job.client_id,
      external_employee_ref: identifier,
      name: identifier,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create employee record");
  }

  return data.id;
}

async function insertPayslip(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  employeeId: string,
  normalized: NormalizedTextractResult,
  payDate: string
) {
  const payload = buildPayslipInsert(job, employeeId, normalized, payDate);
  const { data, error } = await supabase
    .from("payslips")
    .insert(payload)
    .select(PAYSLIP_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to insert payslip");
  }

  return data as PayslipForRules;
}

async function insertPayDateMismatchIssue(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  employeeId: string,
  batchPayDate: string,
  parsedPayDate: string | null
) {
  if (!parsedPayDate || parsedPayDate === batchPayDate) {
    return;
  }

  await supabase.from("issues").insert({
    organisation_id: job.organisation_id,
    client_id: job.client_id,
    batch_id: job.batch_id,
    employee_id: employeeId,
    rule_code: "pay_date_mismatch",
    severity: "warning",
    description: `Payslip pay date ${parsedPayDate} differs from batch pay date ${batchPayDate}. Using batch date.`,
    data: {
      batchPayDate,
      parsedPayDate,
    },
    note: null,
  });
}

async function insertInfoIssue(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  employeeId: string,
  normalized: NormalizedTextractResult
) {
  await supabase.from("issues").insert({
    organisation_id: job.organisation_id,
    client_id: job.client_id,
    batch_id: job.batch_id,
    employee_id: employeeId,
    rule_code: "ocr_ingest",
    severity: "info",
    description: `OCR ingestion captured ${normalized.raw_text.length} characters`,
    data: null,
    note: null,
  });
}

async function fetchPreviousPayslip(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  employeeId: string
) {
  const { data, error } = await supabase
    .from("payslips")
    .select(PAYSLIP_SELECT_FIELDS)
    .eq("organisation_id", job.organisation_id)
    .eq("client_id", job.client_id)
    .eq("employee_id", employeeId)
    .order("pay_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PayslipForRules) ?? null;
}

async function insertRuleIssues(
  supabase: ReturnType<typeof createClient>,
  currentPayslip: PayslipForRules,
  previousPayslip: PayslipForRules | null
) {
  const country =
    (currentPayslip.clients && !Array.isArray(currentPayslip.clients)
      ? (currentPayslip.clients?.country as CountryCode | null)
      : null) ?? null;
  const taxYear = currentPayslip.pay_date
    ? new Date(currentPayslip.pay_date).getUTCFullYear()
    : null;
  const { config, overrideCountry } = await loadRuleConfigForBatch(
    supabase,
    currentPayslip.organisation_id,
    currentPayslip.client_id,
    currentPayslip.batch_id,
    country,
    taxYear
  );
  const rows = buildIssuesForPayslip(currentPayslip, previousPayslip, {
    country: overrideCountry ?? country,
    taxYear,
    config,
  });
  if (!rows.length) return;
  const { error } = await supabase.from("issues").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}

async function markJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  success: boolean,
  errorMessage?: string
) {
  await supabase
    .from("processing_jobs")
    .update({
      status: success ? "completed" : "failed",
      error: success ? null : (errorMessage ?? null),
    })
    .eq("id", jobId);
}

async function refreshBatchProgress(
  supabase: ReturnType<typeof createClient>,
  batchId: string
) {
  const { data: jobs, error: jobsError } = await supabase
    .from("processing_jobs")
    .select("status")
    .eq("batch_id", batchId);

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const statuses = jobs ?? [];
  const processed = statuses.filter((job) =>
    job.status === "completed" || job.status === "failed"
  ).length;
  const failed = statuses.filter((job) => job.status === "failed").length;
  const total = statuses.length;

  const updates: Record<string, unknown> = {
    processed_files: processed,
  };

  if (total > 0) {
    updates.total_files = total;
  }

  if (processed >= total && total > 0) {
    updates.status = failed > 0 ? "failed" : "completed";
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("batches")
    .update(updates)
    .eq("id", batchId);

  if (error) {
    throw new Error(error.message);
  }
}

type BatchMeta = {
  period_label: string | null;
  created_at: string | null;
  pay_date: string | null;
};

async function fetchBatchMeta(
  supabase: ReturnType<typeof createClient>,
  batchId: string,
  organisationId: string
): Promise<BatchMeta> {
  const { data, error } = await supabase
    .from("batches")
    .select("period_label, created_at, organisation_id, pay_date")
    .eq("id", batchId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Batch not found");
  }

  if (data.organisation_id !== organisationId) {
    throw new Error("Batch does not belong to organisation");
  }

  return {
    period_label: data.period_label ?? null,
    created_at: data.created_at ?? null,
    pay_date: data.pay_date ?? null,
  };
}

type ClientRuleConfigRow = {
  config: Partial<RuleConfig> | null;
};

async function loadRuleConfigForClient(
  supabase: ReturnType<typeof createClient>,
  organisationId: string,
  clientId: string,
  country: CountryCode | null,
  taxYear: number | null
): Promise<RuleConfig> {
  const derivedCountry = country ?? ("IE" as CountryCode);
  const baseConfig = getDefaultRuleConfig(derivedCountry, taxYear);

  const { data, error } = await supabase
    .from("client_rule_config")
    .select("config")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(
      error.message ?? "Unable to load client rule configuration overrides"
    );
  }

  const override = (data as ClientRuleConfigRow | null)?.config ?? null;
  return mergeRuleConfig(baseConfig, override);
}

async function loadRuleConfigForBatch(
  supabase: ReturnType<typeof createClient>,
  organisationId: string,
  clientId: string,
  batchId: string,
  country: CountryCode | null,
  taxYear: number | null
): Promise<{ config: RuleConfig; overrideCountry: CountryCode | null }> {
  const { data, error } = await supabase
    .from("batch_rule_config_snapshot")
    .select("country, resolved_config")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("batch_id", batchId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  if (data && data.resolved_config) {
    return {
      config: data.resolved_config as RuleConfig,
      overrideCountry: (data.country as CountryCode | null) ?? country,
    };
  }

  const fallback = await loadRuleConfigForClient(
    supabase,
    organisationId,
    clientId,
    country,
    taxYear
  );
  return { config: fallback, overrideCountry: country };
}
