"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const resolveFunctionUrl = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const edgeFunctionsBaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_EDGE_FUNCTIONS_URL ??
    (supabaseUrl ? `${supabaseUrl}/functions/v1` : null);
  return edgeFunctionsBaseUrl ? `${edgeFunctionsBaseUrl}/batch-issues-csv` : null;
};

export async function downloadBatchIssuesCsv(batchId: string) {
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

  const endpoint = `${functionUrl}?batch_id=${encodeURIComponent(batchId)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: apiKey,
      Accept: "text/csv",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Unable to export batch issues (status ${response.status}): ${errorBody}`
    );
  }

  const blob = await response.blob();
  if (typeof window === "undefined") {
    return blob;
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `batch-${batchId}-issues-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

