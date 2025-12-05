"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "payslips";

function generateObjectPath(batchId: string, fileName: string) {
  const safeName = fileName.replace(/\s+/g, "_");
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `batches/${batchId}/${Date.now()}-${unique}-${safeName}`;
}

export type UploadedBatchFile = {
  path: string;
  originalName: string;
};

export async function uploadBatchFiles(
  batchId: string,
  files: File[]
): Promise<UploadedBatchFile[]> {
  if (!files.length) {
    return [];
  }

  if (!BUCKET) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET env variable.");
  }

  const supabase = getSupabaseBrowserClient();
  const storage = supabase.storage.from(BUCKET);

  const uploadedPaths: UploadedBatchFile[] = [];

  for (const file of files) {
    const path = generateObjectPath(batchId, file.name);
    const { error } = await storage.upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/pdf",
    });

    if (error) {
      throw new Error(error.message);
    }

    uploadedPaths.push({ path, originalName: file.name });
  }

  return uploadedPaths;
}

