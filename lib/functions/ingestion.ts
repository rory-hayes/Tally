"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type QueryParams = Record<string, string | number | null | undefined>;

const resolveFunctionUrl = (fnName: string, query: QueryParams) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const edgeFunctionsBaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_EDGE_FUNCTIONS_URL ??
    (supabaseUrl ? `${supabaseUrl}/functions/v1` : null);

  if (!edgeFunctionsBaseUrl) return null;

  const url = new URL(`${edgeFunctionsBaseUrl}/${fnName}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const postCsvToEdge = async (fnName: string, query: QueryParams, csvBody: string) => {
  const endpoint = resolveFunctionUrl(fnName, query);
  if (!endpoint) {
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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/csv",
      Authorization: `Bearer ${accessToken}`,
      apikey: apiKey,
    },
    body: csvBody,
  });

  const text = await response.text();
  const parsed = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : {};

  if (!response.ok) {
    const message = (parsed as { error?: string }).error ?? text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return parsed;
};

export const ingestRegisterCsv = (input: {
  batchId: string;
  clientId: string;
  csv: string;
}) => postCsvToEdge("register_ingest", { batch_id: input.batchId, client_id: input.clientId }, input.csv);

export const ingestGlCsv = (input: {
  batchId: string;
  clientId: string;
  csv: string;
}) => postCsvToEdge("gl_ingest", { batch_id: input.batchId, client_id: input.clientId }, input.csv);

export const ingestBankPaymentsCsv = (input: {
  batchId: string;
  clientId: string;
  csv: string;
  fileName?: string;
}) =>
  postCsvToEdge(
    "payments_ingest",
    { batch_id: input.batchId, client_id: input.clientId, file_name: input.fileName ?? null },
    input.csv
  );

export const ingestSubmissionCsv = (input: {
  batchId: string;
  clientId: string;
  country: string;
  csv: string;
}) =>
  postCsvToEdge(
    "submission_ingest",
    { batch_id: input.batchId, client_id: input.clientId, country: input.country },
    input.csv
  );
