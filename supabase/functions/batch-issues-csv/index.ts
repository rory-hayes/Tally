import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { buildBatchIssuesCsv, type BatchIssueCsvRow } from "../../../lib/logic/batchIssuesCsv.ts";

const SUPABASE_URL =
  Deno.env.get("PROJECT_URL") ??
  Deno.env.get("SERVICE_SUPABASE_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL/PROJECT_URL or SERVICE_ROLE_KEY environment variables.");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const batchId = url.searchParams.get("batch_id");
  if (!batchId) {
    return new Response(JSON.stringify({ error: "batch_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unable to verify user" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organisation_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, organisation_id, client_id")
    .eq("id", batchId)
    .maybeSingle();

  if (batchError || !batch) {
    return new Response(JSON.stringify({ error: "Batch not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (batch.organisation_id !== profile.organisation_id) {
    return new Response(JSON.stringify({ error: "Not authorized for this batch" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: issueRows, error: issueError } = await supabase
    .from("issues")
    .select(
      `
      rule_code,
      severity,
      description,
      note,
      employees:employees (
        name,
        external_employee_ref
      )
    `
    )
    .eq("batch_id", batchId)
    .eq("organisation_id", profile.organisation_id)
    .order("created_at", { ascending: true });

  if (issueError) {
    return new Response(JSON.stringify({ error: issueError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const csvRows: BatchIssueCsvRow[] = (issueRows ?? []).map((issue) => {
    const employeeData = Array.isArray(issue.employees) ? issue.employees[0] : issue.employees;
    return {
      employeeName: employeeData?.name ?? "Employee",
      employeeRef: employeeData?.external_employee_ref ?? null,
      ruleCode: issue.rule_code ?? "",
      severity: issue.severity ?? "",
      description: issue.description ?? "",
      values: issue.note ?? "",
    };
  });

  const csv = buildBatchIssuesCsv(csvRows);
  const filename = `batch-${batchId}-issues.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

