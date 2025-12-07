import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { parsePaymentCsv, type PaymentRecord } from "../../../lib/payments/parser.ts";

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
  const fileName = url.searchParams.get("file_name") ?? null;
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

  const headerLine = body.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const headers = headerLine
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const required = ["employee_id", "amount"];
  const missingHeaders = required.filter((col) => !headers.includes(col));
  if (missingHeaders.length) {
    return new Response(JSON.stringify({ error: `Missing required column(s): ${missingHeaders.join(", ")}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsedRows = parsePaymentCsv(body);
  const rows: PaymentRecord[] = parsedRows.map((row) => ({
    ...row,
    amount: parseNumber(String(row.amount)),
  }));
  if (!rows.length) {
    return new Response(JSON.stringify({ error: "No payment rows parsed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: paymentFile, error: fileError } = await supabase
    .from("payment_files")
    .insert({
      organisation_id: profile.organisation_id,
      client_id: clientId,
      batch_id: batchId,
      file_name: fileName,
    })
    .select("id")
    .single();

  if (fileError || !paymentFile) {
    return new Response(JSON.stringify({ error: fileError?.message ?? "Failed to create payment file" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: insertError } = await supabase.from("payment_records").insert(
    rows.map((row) => ({
      ...row,
      organisation_id: profile.organisation_id,
      client_id: clientId,
      batch_id: batchId,
      payment_file_id: paymentFile.id,
    }))
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
