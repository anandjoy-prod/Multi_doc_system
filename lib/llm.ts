import OpenAI from 'openai';
import { env } from './env';

/**
 * GitHub Models exposes an OpenAI-compatible inference endpoint, so the
 * official `openai` SDK works as-is — we just override the baseURL and
 * authenticate with a GitHub Personal Access Token.
 *
 *   Catalog & rate limits: https://github.com/marketplace?type=models
 *   Docs:                  https://docs.github.com/en/github-models
 */

let _client: OpenAI | null = null;

export function llm(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.GITHUB_TOKEN,
      baseURL: env.GITHUB_MODELS_BASE_URL,
    });
  }
  return _client;
}

export const DEFAULT_MODEL = env.GITHUB_MODEL;
