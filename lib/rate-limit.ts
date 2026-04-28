// =============================================================================
// Rate limiter — disabled in the UI-only demo.
//
// The previous version used Upstash Redis (works on Vercel) with an in-memory
// dev fallback. Both are removed here to keep the dependency list minimal.
// When you re-enable real auth and chat persistence, restore the Upstash
// version from git history (see CRITIQUE.md #3).
// =============================================================================

type Limiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number }>;
};

const noop: Limiter = {
  async limit() {
    return { success: true, remaining: Number.POSITIVE_INFINITY };
  },
};

export function rateLimiter(): Limiter {
  return noop;
}
