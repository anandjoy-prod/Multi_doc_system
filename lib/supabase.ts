// Supabase has been removed for the UI-only demo. This file is intentionally
// left as a stub so any leftover imports raise a clear error instead of a
// confusing "module not found" at runtime.
//
// When you wire the real DB back in, restore the original from git history
// and re-add @supabase/supabase-js to package.json.

export function serverAdmin(): never {
  throw new Error(
    'Supabase is disabled in the UI-only demo. Use lib/dummy-data.ts instead.',
  );
}

export function serverWithUser(): never {
  throw new Error(
    'Supabase is disabled in the UI-only demo. Use lib/dummy-data.ts instead.',
  );
}
