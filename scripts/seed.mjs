// =============================================================================
// One-shot DB seed. Reads .env / .env.local directly so it works without
// any extra deps. Idempotent — safe to re-run.
//
//   Run with:  npm run db:seed
// =============================================================================

import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// ----- tiny env loader (no dotenv) -------------------------------------------
for (const file of ['.env', '.env.local']) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // strip optional surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    '✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
  );
  console.error('  Add them to .env.local and try again.');
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----- roles ------------------------------------------------------------------
const ROLES = [
  { name: 'admin', permissions: ['*'], theme_override: null },
  { name: 'user', permissions: ['chat', 'view_history'], theme_override: null },
  { name: 'viewer', permissions: ['view_only'], theme_override: 'light' },
];

console.log('▸ Upserting roles…');
{
  const { error } = await sb
    .from('roles')
    .upsert(ROLES, { onConflict: 'name', ignoreDuplicates: true });
  if (error) {
    if (
      /schema cache|relation .* does not exist|Could not find the table/i.test(
        error.message,
      )
    ) {
      console.error('\n✗ Tables not found.\n');
      console.error('  Run the schema migration first:');
      console.error('    1. Open Supabase dashboard → SQL Editor → New query');
      console.error('    2. Paste supabase/migrations/0001_init.sql');
      console.error('    3. Click Run');
      console.error('    4. Re-run `npm run db:seed`\n');
      process.exit(1);
    }
    console.error('✗ Failed to upsert roles:', error.message);
    process.exit(1);
  }
  for (const r of ROLES) console.log(`  ✓ ${r.name}`);
}

// ----- look up role ids -------------------------------------------------------
const { data: roleRows, error: roleErr } = await sb
  .from('roles')
  .select('id, name');
if (roleErr) {
  console.error('✗ Failed to read roles:', roleErr.message);
  process.exit(1);
}
const roleIdByName = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));

// ----- users ------------------------------------------------------------------
const USERS = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin',
    theme_preference: 'dark',
  },
  {
    email: 'user@test.com',
    password: 'user123',
    role: 'user',
    theme_preference: 'system',
  },
  {
    email: 'viewer@test.com',
    password: 'viewer123',
    role: 'viewer',
    theme_preference: 'light',
  },
  {
    email: 'sam@test.com',
    password: 'sam123',
    role: 'user',
    theme_preference: 'dark',
  },
  {
    email: 'lin@test.com',
    password: 'lin123',
    role: 'user',
    theme_preference: 'system',
  },
];

console.log('▸ Upserting users…');
for (const u of USERS) {
  const role_id = roleIdByName[u.role];
  if (!role_id) {
    console.error(`  ✗ ${u.email}: role '${u.role}' not found`);
    continue;
  }
  const password_hash = await bcrypt.hash(u.password, 12);
  const { error } = await sb.from('users').upsert(
    {
      email: u.email,
      password_hash,
      role_id,
      theme_preference: u.theme_preference,
    },
    { onConflict: 'email', ignoreDuplicates: true },
  );
  if (error) console.error(`  ✗ ${u.email}: ${error.message}`);
  else console.log(`  ✓ ${u.email} / ${u.password}  (${u.role})`);
}

console.log('\n✓ Seed complete.\n');
console.log('  Sign in at http://localhost:3000/login with any of:');
for (const u of USERS) console.log(`    ${u.email} / ${u.password}`);
