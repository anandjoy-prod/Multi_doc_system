// Deprecated. We pivoted from "pre-index every file" to MCP-style on-demand
// tool-calling — the LLM reads files JIT via lib/github/tools.ts. The
// pre-indexing approach is preserved in git history if you ever want to
// revive it (e.g. for very large codebases where on-demand reads become
// too slow).
export {};
