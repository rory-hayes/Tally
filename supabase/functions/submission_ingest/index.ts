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

const parseNumber = (value: string | undefined) => {
  const num = Number((value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const parseCsv = (csv: string) => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return null;
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const parts = lines[1].split(",");
  const record: Record<string, string> = {};
  headers.forEach((header, idx) => {
    record[header] = parts[idx] ?? "";
  });
  return {
    paye_total: parseNumber(record["paye_total"] ?? record["paye"]),
    usc_or_ni_total: parseNumber(record["usc_or_ni_total"] ?? record["usc"] ?? record["ni"]),
    employee_count: Number(record["employee_count"] ?? 0),
    tax_year: record["tax_year"] ? Number(record["tax_year"]) : null,
    source_file: record["source_file"] ?? null,
  };
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
  const country = (url.searchParams.get("country") ?? "").toUpperCase();
  if (!batchId || !clientId || !country) {
    return new Response(JSON.stringify({ error: "batch_id, client_id, and country are required" }), {
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
  if (!parsed) {
    return new Response(JSON.stringify({ error: "No submission row parsed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetTable = country === "IE" ? "ros_submission_summaries" : "rti_submission_summaries";

  const { error: insertError } = await supabase
    .from(targetTable)
    .upsert(
      {
        ...parsed,
        organisation_id: profile.organisation_id,
        client_id: clientId,
        batch_id: batchId,
      },
      { onConflict: "batch_id,client_id" }
    );

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ inserted: 1 }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
