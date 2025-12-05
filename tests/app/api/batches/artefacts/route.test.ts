import { describe, expect, it, beforeEach, vi } from "vitest";
import { handleArtefactUpload } from "@/app/api/batches/[batchId]/artefacts/route";

type MockSupabase = {
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  __mocks: {
    upload: ReturnType<typeof vi.fn>;
    clientSource: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };
    batchInsert: ReturnType<typeof vi.fn>;
    batchSingle: ReturnType<typeof vi.fn>;
  };
};

const supabaseFactory: { client: MockSupabase | null } = { client: null };

const encoder = new TextEncoder();

const createTestFile = (content: string, name: string) =>
  ({
    name,
    type: "text/csv",
    arrayBuffer: async () => encoder.encode(content).buffer,
  }) as unknown as File;

const createFormData = (entries: Record<string, FormDataEntryValue>) =>
  ({
    get: (key: string) => entries[key] ?? null,
  } as FormData);

vi.mock("@/lib/server/supabaseAdmin", () => ({
  getSupabaseAdminClient: () => {
    if (!supabaseFactory.client) {
      throw new Error("Supabase mock not initialised");
    }
    return supabaseFactory.client;
  },
}));

const createMockSupabase = (): MockSupabase => {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const storageFrom = vi.fn(() => ({ upload }));
  const clientSource = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "mapping" }, error: null }),
  };
  const batchSingle = vi.fn().mockResolvedValue({ data: { id: "file" }, error: null });
  const batchSelect = vi.fn(() => ({ single: batchSingle }));
  const batchInsert = vi.fn(() => ({ select: batchSelect }));
  const from = vi.fn((table: string) => {
    if (table === "client_data_sources") return clientSource;
    if (table === "batch_data_files") return { insert: batchInsert };
    throw new Error(`Unexpected table: ${table}`);
  });
  return {
    storage: { from: storageFrom },
    from,
    __mocks: {
      upload,
      clientSource,
      batchInsert,
      batchSingle,
    },
  };
};

describe("POST /api/batches/[batchId]/artefacts", () => {
  beforeEach(() => {
    supabaseFactory.client = createMockSupabase();
  });

  it("uploads artefact and records metadata", async () => {
    const mock = supabaseFactory.client!;
    const file = createTestFile(
      "employee_id,gross_pay,net_pay,paye,usc_or_ni\nEMP001,3000,2100,500,100",
      "sample.csv"
    );
    const formData = createFormData({
      file,
      clientId: "client-123",
      organisationId: "org-123",
      type: "PAYROLL_REGISTER",
    });
    const request = { formData: async () => formData } as unknown as Request;

    const response = await handleArtefactUpload(request, "batch-123");
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mock.__mocks.upload).toHaveBeenCalledWith(
      "client-123/batch-123/payroll_register/sample.csv",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
    expect(mock.__mocks.batchInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organisation_id: "org-123",
        client_id: "client-123",
        batch_id: "batch-123",
        type: "PAYROLL_REGISTER",
      })
    );
  });

  it("returns validation error when mapping is missing", async () => {
    const mock = supabaseFactory.client!;
    mock.__mocks.clientSource.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const file = createTestFile(
      "employee_id,gross_pay,net_pay,paye,usc_or_ni\nEMP001,3000,2100,500,100",
      "sample.csv"
    );
    const formData = createFormData({
      file,
      clientId: "client-123",
      organisationId: "org-123",
      type: "PAYROLL_REGISTER",
    });

    const request = { formData: async () => formData } as unknown as Request;

    const response = await handleArtefactUpload(request, "batch-123");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/data source mapping/i);
    expect(mock.__mocks.upload).not.toHaveBeenCalled();
  });
});

