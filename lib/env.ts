// Centralised env parsing — fail fast on misconfig instead of dying mid-request.
import { z } from 'zod';

const schema = z.object({
  // ---- Supabase ------------------------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // ---- GitHub Models (free tier) -------------------------------------------
  GITHUB_TOKEN: z.string().min(1, 'Set GITHUB_TOKEN — see RUN.md'),
  GITHUB_MODELS_BASE_URL: z
    .string()
    .url()
    .default('https://models.inference.ai.azure.com'),
  GITHUB_MODEL: z.string().default('gpt-4o-mini'),

  // ---- Auth ----------------------------------------------------------------
  // 32+ random bytes. Generate with:
  //   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥32 chars'),

  // ---- App -----------------------------------------------------------------
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map(
    (i) => `  - ${i.path.join('.')}: ${i.message}`,
  );
  throw new Error(
    `Invalid environment variables:\n${issues.join('\n')}\n\nSee .env.example.`,
  );
}

export const env = parsed.data;
