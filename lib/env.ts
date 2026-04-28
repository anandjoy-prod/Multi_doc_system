// Centralised env parsing — fail fast on misconfig instead of dying mid-request.
import { z } from 'zod';

const schema = z.object({
  // ---- GitHub Models (free tier) -------------------------------------------
  // Personal Access Token from https://github.com/settings/tokens
  // No special scopes are required for the public Models catalog.
  GITHUB_TOKEN: z.string().min(1, 'Set GITHUB_TOKEN — see RUN.md'),
  // OpenAI-compatible base URL. Default works for most users.
  GITHUB_MODELS_BASE_URL: z
    .string()
    .url()
    .default('https://models.inference.ai.azure.com'),
  // Any model ID from https://github.com/marketplace?type=models
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
