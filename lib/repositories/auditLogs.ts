import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AuditAction =
  | "batch_created"
  | "payslips_uploaded"
  | "issue_resolved"
  | "issue_unresolved";

type AuditLogInput = {
  organisationId: string;
  actorId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent({
  organisationId,
  actorId,
  action,
  metadata,
}: AuditLogInput) {
  const supabase = getSupabaseBrowserClient();
  const payload = {
    organisation_id: organisationId,
    user_id: actorId,
    action,
    metadata: metadata ?? {},
  };

  const { error } = await supabase.from("audit_logs").insert(payload);

  if (error) {
    console.error("[auditLogs] Failed to write audit log", error);
  }
}
