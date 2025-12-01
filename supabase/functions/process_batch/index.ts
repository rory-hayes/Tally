import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import {
  TextractClient,
  DetectDocumentTextCommand,
} from "npm:@aws-sdk/client-textract";
import {
  NormalizedTextractResult,
  buildBatchUpdatePayload,
  buildPayslipInsert,
  deriveIdentifierFromPath,
  derivePayDateFromBatch,
  ensureNormalizedHasContent,
  listMissingFields,
  normalizeTextractResponse,
} from "./helpers.ts";
import {
  PAYSLIP_SELECT_FIELDS,
  buildIssuesForPayslip,
  type PayslipForRules,
} from "./rules.ts";

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
    const payDate =
      normalized.pay_date ?? derivePayDateFromBatch(batchMeta.period_label, batchMeta.created_at);
    const currentPayslip = await insertPayslip(supabase, job, employeeId, normalized, payDate);
    await insertInfoIssue(supabase, job, employeeId, normalized);
    await insertRuleIssues(supabase, currentPayslip, previousPayslip);
    await markJobStatus(supabase, job.id, true);
    await updateBatchProgress(supabase, job.batch_id);

    console.log(`[process_batch] Job ${job.id} completed`);
    return { id: job.id, status: "completed" as const };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown processing error";
    console.error(`[process_batch] Job ${job.id} failed`, message);
    await markJobStatus(supabase, job.id, false, message);
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
  const rows = buildIssuesForPayslip(currentPayslip, previousPayslip);
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

async function updateBatchProgress(
  supabase: ReturnType<typeof createClient>,
  batchId: string
) {
  const { data: batch, error } = await supabase
    .from("batches")
    .select("processed_files, total_files")
    .eq("id", batchId)
    .maybeSingle();

  if (error || !batch) {
    throw new Error(error?.message ?? "Unable to load batch");
  }

  const nextProcessed = (batch.processed_files ?? 0) + 1;
  const updates = buildBatchUpdatePayload(
    nextProcessed,
    batch.total_files ?? 0
  );

  await supabase.from("batches").update(updates).eq("id", batchId);
}

type BatchMeta = {
  period_label: string | null;
  created_at: string | null;
};

async function fetchBatchMeta(
  supabase: ReturnType<typeof createClient>,
  batchId: string,
  organisationId: string
): Promise<BatchMeta> {
  const { data, error } = await supabase
    .from("batches")
    .select("period_label, created_at, organisation_id")
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
  };
}

