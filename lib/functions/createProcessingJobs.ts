"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";


const resolveFunctionUrl = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const edgeFunctionsBaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_EDGE_FUNCTIONS_URL ??
    (supabaseUrl ? `${supabaseUrl}/functions/v1` : null);
  return edgeFunctionsBaseUrl
    ? `${edgeFunctionsBaseUrl}/create-processing-jobs`
    : null;
};

export const invokeCreateProcessingJobs = async (batchId: string) => {
  if (!batchId) {
    throw new Error("batchId is required");
  }

  const functionUrl = resolveFunctionUrl();
  if (!functionUrl) {
    throw new Error(
      "Missing Supabase function endpoint. Set NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_EDGE_FUNCTIONS_URL."
    );
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("No active Supabase session");
  }

  const apiKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: apiKey,
    },
    body: JSON.stringify({ batch_id: batchId }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Unable to create processing jobs (status ${response.status}): ${errorBody}`
    );
  }

  return response.json() as Promise<{ created: number }>;
};
 