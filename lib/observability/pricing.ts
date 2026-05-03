// =============================================================================
// Per-million-token pricing in USD (real OpenAI list prices).
//
// You're calling GitHub Models on the free tier — actual cost is $0. The
// numbers below are what each call WOULD cost on the OpenAI public API,
// so the dashboard surfaces a forward-looking spend estimate. When you
// switch the OPENAI_API_KEY to a real OpenAI key, these become real $.
//
// Update prices when OpenAI does. Linked to model id, so unrecognised
// models fall back to zero (won't crash the dashboard).
// =============================================================================

export interface ModelPrice {
  /** $/1M input tokens */
  in: number;
  /** $/1M output tokens (0 for embedding models) */
  out: number;
}

const PRICES: Record<string, ModelPrice> = {
  // Chat completions (per 1M tokens)
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 5.0, out: 15.0 },
  'o1-mini': { in: 3.0, out: 12.0 },
  'phi-3.5-mini-instruct': { in: 0.0, out: 0.0 }, // GitHub Models, no public price
  // Embeddings (per 1M tokens, output is 0)
  'text-embedding-3-small': { in: 0.02, out: 0 },
  'text-embedding-3-large': { in: 0.13, out: 0 },
};

const PER_TOKEN = 1 / 1_000_000;

/**
 * Estimate the cost of a single API call. Returns 0 for unknown models so
 * dashboards stay safe; the model id is stored on the row so you can spot
 * it later.
 */
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const key = model.toLowerCase();
  const p = PRICES[key];
  if (!p) return 0;
  return promptTokens * p.in * PER_TOKEN + completionTokens * p.out * PER_TOKEN;
}

export function knownModel(model: string): boolean {
  return PRICES[model.toLowerCase()] !== undefined;
}
