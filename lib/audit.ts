import { serverAdmin } from './supabase';

/**
 * Best-effort audit log write. Never throws and never blocks the caller —
 * audit failures must not abort user-visible actions. Surface real failures
 * via observability later.
 */
export async function writeAudit(
  actorId: string,
  action: string,
  targetId: string | null,
  details: Record<string, unknown> | null,
): Promise<void> {
  try {
    await serverAdmin().from('audit_logs').insert({
      actor_id: actorId,
      action,
      target_id: targetId,
      details,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit] failed to write', { action, err });
  }
}
