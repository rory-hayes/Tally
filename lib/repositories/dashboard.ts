import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { ClientRow } from "@/lib/repositories/clients";

export type IssueSeverity = "critical" | "warning" | "info";

export type DashboardClientSummary = {
  id: string;
  name: string;
  country: string | null;
  payroll_system: string | null;
  latestBatchPeriod: string | null;
  latestBatchDate: string | null;
  issueCounts: Record<IssueSeverity, number>;
};

type ClientWithRelations = ClientRow & {
  batches: { period_label: string | null; created_at: string }[] | null;
};

type IssueRow = {
  client_id: string | null;
  severity: IssueSeverity;
};

const emptyIssueCounts = (): Record<IssueSeverity, number> => ({
  critical: 0,
  warning: 0,
  info: 0,
});

export async function fetchDashboardSummaries(
  organisationId: string
): Promise<DashboardClientSummary[]> {
  const supabase = getSupabaseBrowserClient();

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select(
      `
      id,
      name,
      country,
      payroll_system,
      batches: batches!batches_client_id_fkey (
        period_label,
        created_at
      )
    `
    )
    .eq("organisation_id", organisationId)
    .order("name", { ascending: true })
    .limit(1, { foreignTable: "batches" })
    .order("created_at", {
      foreignTable: "batches",
      ascending: false,
    });

  if (clientError) {
    throw new Error(`Failed to load dashboard clients: ${clientError.message}`);
  }

  const { data: issueRows, error: issueError } = await supabase
    .from("issues")
    .select("client_id,severity")
    .eq("organisation_id", organisationId);

  if (issueError) {
    throw new Error(`Failed to load issue counts: ${issueError.message}`);
  }

  const issueMap = new Map<string, Record<IssueSeverity, number>>();
  (issueRows as IssueRow[] | null)?.forEach((row) => {
    if (!row.client_id) {
      return;
    }

    const counts = issueMap.get(row.client_id) ?? emptyIssueCounts();
    counts[row.severity] = (counts[row.severity] ?? 0) + 1;
    issueMap.set(row.client_id, counts);
  });

  return (clientData as ClientWithRelations[] | null)?.map((client) => {
    const latestBatch = client.batches?.[0] ?? null;
    return {
      id: client.id,
      name: client.name,
      country: client.country,
      payroll_system: client.payroll_system,
      latestBatchPeriod: latestBatch?.period_label ?? null,
      latestBatchDate: latestBatch?.created_at ?? null,
      issueCounts: { ...emptyIssueCounts(), ...(issueMap.get(client.id) ?? {}) },
    };
  }) ?? [];
}

