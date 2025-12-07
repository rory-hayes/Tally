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

type GlRow = {
  wages: number;
  employer_taxes: number;
  pensions: number;
  other?: number;
  currency?: string | null;
};

const parseNumber = (value: string | undefined) => {
  const num = Number((value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const parseCsv = (csv: string): { totals: GlRow; missing: string[] } => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return {
      totals: { wages: 0, employer_taxes: 0, pensions: 0, other: 0, currency: null },
      missing: [],
    };
  }
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["wages", "employer_taxes", "pensions"];
  const missing = required.filter((col) => !headers.includes(col));
  const totals: GlRow = { wages: 0, employer_taxes: 0, pensions: 0, other: 0, currency: null };
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = parts[idx] ?? "";
    });
    totals.wages += parseNumber(record["wages"] ?? record["gross"]);
    totals.employer_taxes += parseNumber(record["employer_taxes"] ?? record["er_taxes"]);
    totals.pensions += parseNumber(record["pensions"] ?? record["er_pension"]);
    totals.other += parseNumber(record["other"]);
    totals.currency = totals.currency ?? record["currency"] ?? null;
  }
  return { totals, missing };
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

  const totals = parsed.totals;

  const { error: insertError } = await supabase
    .from("gl_payroll_postings")
    .upsert(
      {
        organisation_id: profile.organisation_id,
        client_id: clientId,
        batch_id: batchId,
        ...totals,
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
