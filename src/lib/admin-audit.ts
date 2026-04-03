import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase";

interface AdminAuditInput {
  action: string;
  actor: string;
  role: string | null;
  targetTable: string | null;
  targetId: string | null;
  summary: string;
  details?: Record<string, unknown>;
}

export async function writeAdminAuditLog(input: AdminAuditInput): Promise<void> {
  if (!isSupabaseAdminConfigured) {
    return;
  }
  const client = createSupabaseAdminClient();
  if (!client) {
    return;
  }

  const insertResult = await (
    client.from("admin_audit_log") as unknown as {
      insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }
  ).insert({
    action: input.action,
    actor: input.actor,
    role: input.role,
    target_table: input.targetTable,
    target_id: input.targetId,
    summary: input.summary,
    details: input.details ?? {},
  });

  // Best-effort logging: do not break main workflow if audit table is absent/misconfigured.
  if (insertResult.error) {
    return;
  }
}

