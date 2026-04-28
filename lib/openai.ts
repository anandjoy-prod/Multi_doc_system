// Re-export the GitHub Models client under the old name so any leftover
// imports keep working. New code should import from '@/lib/llm'.
export { llm as openai, DEFAULT_MODEL } from './llm';
