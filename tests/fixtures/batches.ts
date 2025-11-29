import type { BatchRow } from "@/lib/repositories/batches";

export const batchFixture: BatchRow = {
  id: "batch-1",
  organisation_id: "org-123",
  client_id: "client-123",
  period_label: "Jan 2025",
  status: "pending",
  total_files: 0,
  processed_files: 0,
  notes: null,
};


