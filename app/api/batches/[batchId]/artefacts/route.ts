import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import type { DataSourceType } from "@/types/dataSources";

const STORAGE_BUCKET =
  process.env.SUPABASE_ARTEFACTS_BUCKET ?? "artefacts";

class ArtefactUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const TYPE_SLUG_MAP: Record<string, DataSourceType> = {
  PAYROLL_REGISTER: "PAYROLL_REGISTER",
  payroll_register: "PAYROLL_REGISTER",
  GL_EXPORT: "GL_EXPORT",
  gl_export: "GL_EXPORT",
  GROSS_TO_NET: "GROSS_TO_NET",
  gross_to_net: "GROSS_TO_NET",
  BANK_PAYMENTS: "BANK_PAYMENTS",
  bank_payments: "BANK_PAYMENTS",
  STATUTORY_SUBMISSION: "STATUTORY_SUBMISSION",
  hmrc_submission: "STATUTORY_SUBMISSION",
  statutory_submission: "STATUTORY_SUBMISSION",
  CONTRACT_SNAPSHOT: "CONTRACT_SNAPSHOT",
  hr_snapshot: "CONTRACT_SNAPSHOT",
  contract_snapshot: "CONTRACT_SNAPSHOT",
};

const REQUIRED_HEADERS: Partial<Record<DataSourceType, string[]>> = {
  PAYROLL_REGISTER: [
    "employee_id",
    "gross_pay",
    "net_pay",
    "paye",
    "usc_or_ni",
  ],
};

const slugForType = (type: DataSourceType) =>
  type.toLowerCase();

async function validateCsvHeaders(
  type: DataSourceType,
  buffer: Buffer
): Promise<void> {
  const required = REQUIRED_HEADERS[type];
  if (!required) return;
  const content = buffer.toString("utf-8");
  const headerLine = content.split(/\r?\n/)[0] ?? "";
  const headers = headerLine
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length) {
    throw new ArtefactUploadError(
      `Missing required column(s): ${missing.join(", ")}`
    );
  }
}

async function ensureClientMapping(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  organisationId: string,
  clientId: string,
  type: DataSourceType
) {
  const { data, error } = await supabase
    .from("client_data_sources")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("type", type)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new ArtefactUploadError(
      "No active data source mapping for this artefact. Configure it under the client first."
    );
  }
}

async function uploadToStorage(options: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  clientId: string;
  batchId: string;
  type: DataSourceType;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}) {
  if (!STORAGE_BUCKET) {
    throw new ArtefactUploadError(
      "Missing Supabase artefacts bucket configuration.",
      500
    );
  }
  const storagePath = `${options.clientId}/${options.batchId}/${slugForType(
    options.type
  )}/${options.fileName}`;

  const { error: uploadError } = await options.supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, options.fileBuffer, {
      contentType: options.contentType || "text/csv",
      upsert: true,
    });

  if (uploadError) {
    throw new ArtefactUploadError(uploadError.message, 502);
  }

  return storagePath;
}

async function recordBatchFile(options: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  organisationId: string;
  clientId: string;
  batchId: string;
  type: DataSourceType;
  storagePath: string;
  originalFilename: string;
}) {
  const { data, error } = await options.supabase
    .from("batch_data_files")
    .insert({
      organisation_id: options.organisationId,
      client_id: options.clientId,
      batch_id: options.batchId,
      type: options.type,
      storage_path: options.storagePath,
      original_filename: options.originalFilename,
      parsed_status: "pending",
    })
    .select("id, type, storage_path, original_filename, parsed_status")
    .single();

  if (error || !data) {
    throw new ArtefactUploadError(
      error?.message ?? "Unable to record artefact",
      502
    );
  }

  return data;
}

function validateStringField(
  value: FormDataEntryValue | null,
  field: string
): string {
  if (!value || typeof value !== "string") {
    throw new ArtefactUploadError(`Missing ${field}`);
  }
  return value;
}

export async function handleArtefactUpload(
  request: Request,
  batchId: string
) {
  try {
    const formData = await request.formData();
    const clientId = validateStringField(formData.get("clientId"), "clientId");
    const organisationId = validateStringField(
      formData.get("organisationId"),
      "organisationId"
    );
    const rawType = formData.get("type");
    if (!rawType || typeof rawType !== "string") {
      throw new ArtefactUploadError("Missing artefact type");
    }
    const artefactType = TYPE_SLUG_MAP[rawType];
    if (!artefactType) {
      throw new ArtefactUploadError("Unsupported artefact type");
    }
    const fileEntry = formData.get("file");
    if (
      !fileEntry ||
      typeof (fileEntry as Blob).arrayBuffer !== "function"
    ) {
      throw new ArtefactUploadError("File upload is required");
    }
    const file = fileEntry as File;
    const fileName =
      "name" in file && typeof file.name === "string"
        ? file.name
        : "artefact.csv";
    const contentType =
      "type" in file && typeof file.type === "string"
        ? file.type
        : "text/csv";

    const supabase = getSupabaseAdminClient();
    await ensureClientMapping(supabase, organisationId, clientId, artefactType);

    const arrayBuffer = await (file as Blob).arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    await validateCsvHeaders(artefactType, fileBuffer);

    const storagePath = await uploadToStorage({
      supabase,
      clientId,
      batchId,
      type: artefactType,
      fileName,
      fileBuffer,
      contentType,
    });

    const record = await recordBatchFile({
      supabase,
      organisationId,
      clientId,
      batchId,
      type: artefactType,
      storagePath,
      originalFilename: fileName,
    });

    return NextResponse.json({ success: true, file: record }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to upload artefact";
    const status =
      err instanceof ArtefactUploadError ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const params = await context.params;
  return handleArtefactUpload(request, params.batchId);
}

