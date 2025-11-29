import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { buildProcessingJobRows } from "./helpers.ts";

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let batchId: string | undefined;
  try {
    const body = await req.json();
    batchId = body?.batch_id;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!batchId || typeof batchId !== "string") {
    return new Response(JSON.stringify({ error: "batch_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

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
    .select("id, organisation_id, client_id, status")
    .eq("id", batchId)
    .maybeSingle();

  if (batchError || !batch) {
    return new Response(JSON.stringify({ error: "Batch not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (batch.organisation_id !== profile.organisation_id) {
    return new Response(
      JSON.stringify({ error: "Not authorized for this batch" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: objects, error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(`batches/${batchId}`, { limit: 1000 });

  if (storageError) {
    return new Response(JSON.stringify({ error: storageError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existingJobs } = await supabase
    .from("processing_jobs")
    .select("storage_path")
    .eq("batch_id", batchId);

  const existingPaths = new Set(
    (existingJobs ?? []).map((job) => job.storage_path)
  );

  const jobRows = buildProcessingJobRows({
    organisationId: profile.organisation_id,
    clientId: batch.client_id,
    batchId,
    objects: objects ?? [],
    existingPaths,
  });

  if (jobRows.length === 0) {
    return new Response(
      JSON.stringify({ created: 0, message: "No new files found" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { error: insertError } = await supabase
    .from("processing_jobs")
    .insert(jobRows);

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (batch.status !== "processing") {
    const { error: statusUpdateError } = await supabase
      .from("batches")
      .update({ status: "processing" })
      .eq("id", batchId);

    if (statusUpdateError) {
      return new Response(
        JSON.stringify({ error: statusUpdateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response(JSON.stringify({ created: jobRows.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
 