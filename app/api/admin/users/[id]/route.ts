import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, readSessionFromCookies } from '@/lib/auth';
import { hasPermission } from '@/lib/types';
import { serverAdmin } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const PatchBody = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase())
      .optional(),
    password: z.string().min(8).max(72).optional(),
    roleId: z.string().uuid().optional(),
    themePreference: z.enum(['light', 'dark', 'system']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No fields to update',
  });

async function requireAdmin() {
  const s = await readSessionFromCookies();
  if (!s || !hasPermission(s.perms, '*')) return null;
  return s;
}

/**
 * PATCH /api/admin/users/:id — partial update. Admin-only. Any of:
 *   email, password (will be re-hashed), roleId, themePreference.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;

  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.roleId !== undefined) updates.role_id = parsed.data.roleId;
  if (parsed.data.themePreference !== undefined) {
    updates.theme_preference = parsed.data.themePreference;
  }
  if (parsed.data.password !== undefined) {
    updates.password_hash = await hashPassword(parsed.data.password);
  }

  // Self-protection: don't let an admin demote themselves out of the admin
  // role. (They can still change their email, password, and theme.)
  if (id === session.sub && parsed.data.roleId !== undefined) {
    const sb0 = serverAdmin();
    const { data: targetRole } = await sb0
      .from('roles')
      .select('name')
      .eq('id', parsed.data.roleId)
      .maybeSingle();
    if (targetRole?.name !== 'admin') {
      return NextResponse.json(
        { error: 'You cannot demote your own admin account.' },
        { status: 400 },
      );
    }
  }

  const sb = serverAdmin();
  const { data, error } = await sb
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, email, role_id, theme_preference')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Another user already has this email.' },
        { status: 409 },
      );
    }
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Selected role no longer exists.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await writeAudit(session.sub, 'user.update', id, {
    fields: Object.keys(parsed.data),
  });

  return NextResponse.json({ user: data });
}

/**
 * DELETE /api/admin/users/:id — admin-only. Cannot delete yourself.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;

  if (id === session.sub) {
    return NextResponse.json(
      { error: 'You cannot delete your own account.' },
      { status: 400 },
    );
  }

  const sb = serverAdmin();
  const { error } = await sb.from('users').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(session.sub, 'user.delete', id, null);

  return NextResponse.json({ ok: true });
}
