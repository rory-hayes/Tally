import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invokeCreateProcessingJobs } from "@/lib/functions/createProcessingJobs";

const mockGetSession = vi.fn();
const mockSupabaseClient = {
  auth: {
    getSession: mockGetSession,
  },
};

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseBrowserClient: () => mockSupabaseClient,
}));

describe("invokeCreateProcessingJobs", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-pk";
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
      error: null,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ created: 2 }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("calls the edge function with the session token", async () => {
    await invokeCreateProcessingJobs("batch-1");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/create-processing-jobs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          apikey: "test-pk",
        }),
      })
    );
  });

  it("throws when there is no active session", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(invokeCreateProcessingJobs("batch-1")).rejects.toThrow(
      "No active Supabase session"
    );
  });
});
 