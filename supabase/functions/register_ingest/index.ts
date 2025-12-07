import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RegisterRow = {
  employee_id: string | null;
  entry_type: "employee" | "batch_total";
  gross_pay: number | null;
  net_pay: number | null;
  paye: number | null;
  usc_or_ni: number | null;
};

const parseCsv = (csv: string): { rows: RegisterRow[]; missing: string[] } => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return { rows: [], missing: [] };
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["employee_id", "gross_pay", "net_pay", "paye"];
  const missing = required.filter((col) => !headers.includes(col) && !headers.includes(col.replace("_", "")));
  if (missing.length) {
    return { rows: [], missing };
  }
  const rows: RegisterRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = parts[index] ?? "";
    });
    const employeeId = (record["employee_id"] || "").trim();
    rows.push({
      employee_id: employeeId || null,
      entry_type: employeeId ? "employee" : "batch_total",
      gross_pay: Number(record["gross_pay"] ?? 0),
      net_pay: Number(record["net_pay"] ?? 0),
      paye: Number(record["paye"] ?? 0),
      usc_or_ni: Number(record["usc_or_ni"] ?? 0),
    });
  }
  return { rows, missing: [] };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
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

  const body = await req.text();
  if (!body) {
    return new Response(JSON.stringify({ error: "CSV body required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const batchId = url.searchParams.get("batch_id");
  const clientId = url.searchParams.get("client_id");
  if (!batchId || !clientId) {
    return new Response(JSON.stringify({ error: "batch_id and client_id are required" }), {
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

  const parsed = parseCsv(body);
  if (parsed.missing.length) {
    return new Response(JSON.stringify({ error: `Missing required column(s): ${parsed.missing.join(", ")}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = parsed.rows;
  if (!rows.length) {
    return new Response(JSON.stringify({ error: "No register rows parsed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: insertError } = await supabase.from("payroll_register_entries").upsert(
    rows.map((row) => ({
      ...row,
      organisation_id: profile.organisation_id,
      client_id: clientId,
      batch_id: batchId,
    })),
    { onConflict: "batch_id,employee_id,entry_type" }
  );

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ inserted: rows.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
