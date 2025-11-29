import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import {
  NormalizedPayslip,
  SupabaseUpdater,
  buildBatchUpdatePayload,
  createStubPayslip,
  markJobStatusRecord,
  normalizeOcrPayload,
} from "./helpers.ts";

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
const OCR_API_URL = Deno.env.get("OCR_API_URL");
const OCR_API_KEY = Deno.env.get("OCR_API_KEY");
const JOB_PROCESSOR_BATCH_SIZE = Number(
  Deno.env.get("JOB_PROCESSOR_BATCH_SIZE") ?? "5"
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL/PROJECT_URL or SERVICE_ROLE_KEY environment variables"
  );
}

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

  const {
    data: pendingJobs,
    error: jobsError,
  } = await supabase
    .from("processing_jobs")
    .select("id, organisation_id, client_id, batch_id, storage_path")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(JOB_PROCESSOR_BATCH_SIZE);

  if (jobsError) {
    return new Response(JSON.stringify({ error: jobsError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, failed: 0, message: "No pending jobs." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const jobIds = pendingJobs.map((job) => job.id);
  await supabase
    .from("processing_jobs")
    .update({ status: "processing" })
    .in("id", jobIds);

  const results = [];
  for (const job of pendingJobs) {
    const result = await processJob(supabase, job);
    results.push(result);
  }

  const summary = results.reduce(
    (acc, job) => {
      if (job.status === "completed") acc.completed += 1;
      if (job.status === "failed") acc.failed += 1;
      return acc;
    },
    { completed: 0, failed: 0 }
  );

  return new Response(
    JSON.stringify({ ...summary, processed: pendingJobs.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

async function processJob(supabase: ReturnType<typeof createClient>, job: JobRow) {
  try {
    const fileBlob = await downloadJobFile(supabase, job.storage_path);
    const normalized = await runOcrPipeline(fileBlob, job.storage_path);
    const employeeId = await resolveEmployee(supabase, job, normalized);
    await insertPayslip(supabase, job, normalized, employeeId);
    await markJobStatusRecord(
      supabase as unknown as SupabaseUpdater,
      job.id,
      true
    );
    await updateBatchProgress(supabase, job.batch_id);
    return { id: job.id, status: "completed" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";
    await markJobStatusRecord(
      supabase as unknown as SupabaseUpdater,
      job.id,
      false,
      message
    );
    return { id: job.id, status: "failed", error: message };
  }
}

async function downloadJobFile(
  supabase: ReturnType<typeof createClient>,
  storagePath: string
) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "Unable to fetch file from storage.");
  }
  return data;
}

async function runOcrPipeline(
  file: Blob,
  storagePath: string
): Promise<NormalizedPayslip> {
  if (!OCR_API_URL) {
    return createStubPayslip(storagePath);
  }

  const fileName = storagePath.split("/").pop() ?? "document.pdf";
  const upload = new File([file], fileName, {
    type: file.type || "application/pdf",
  });

  const formData = new FormData();
  formData.append("file", upload);

  const response = await fetch(OCR_API_URL, {
    method: "POST",
    headers: OCR_API_KEY ? { Authorization: `Bearer ${OCR_API_KEY}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `OCR request failed (${response.status}): ${await response.text()}`
    );
  }

  const payload = await response.json();
  return normalizeOcrPayload(payload, storagePath);
}

async function resolveEmployee(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  payslip: NormalizedPayslip
) {
  const identifier = payslip.employeeExternalRef ?? payslip.employeeName;
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("organisation_id", job.organisation_id)
    .eq("client_id", job.client_id)
    .or(
      `external_employee_ref.eq.${identifier},name.eq.${payslip.employeeName}`
    )
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
      name: payslip.employeeName,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create employee record.");
  }

  return data.id;
}

async function insertPayslip(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  payslip: NormalizedPayslip,
  employeeId: string
) {
  const { error } = await supabase.from("payslips").insert({
    organisation_id: job.organisation_id,
    client_id: job.client_id,
    batch_id: job.batch_id,
    employee_id: employeeId,
    pay_date: payslip.payDate,
    gross_pay: payslip.grossPay,
    net_pay: payslip.netPay,
    paye: payslip.paye,
    usc_or_ni: payslip.uscOrNi,
    pension_employee: payslip.pensionEmployee,
    pension_employer: payslip.pensionEmployer,
    ytd_gross: payslip.ytdGross,
    ytd_net: payslip.ytdNet,
    ytd_tax: payslip.ytdTax,
    ytd_usc_or_ni: payslip.ytdUscOrNi,
    tax_code: payslip.taxCode,
    prsi_or_ni_category: payslip.prsiOrNiCategory,
    raw_ocr_json: payslip.raw,
    storage_path: job.storage_path,
  });

  if (error) {
    throw new Error(error.message);
  }
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
    throw new Error(error?.message ?? "Unable to load batch.");
  }

  const nextProcessed = (batch.processed_files ?? 0) + 1;
  const updates = buildBatchUpdatePayload(
    nextProcessed,
    batch.total_files ?? 0
  );

  await supabase.from("batches").update(updates).eq("id", batchId);
}

