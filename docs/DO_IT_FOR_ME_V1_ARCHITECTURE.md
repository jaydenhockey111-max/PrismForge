# Do It For Me v1: market research

`private_research` is the only canonical Next Move eligible for the `market_research` execution type. The client sends only a project ID and idempotency request ID. The server rebuilds the current Next Move, checks ownership and eligibility, resolves entitlements and policy, atomically reserves the policy maximum, creates one job, and starts a Vercel Workflow.

The workflow rechecks the kill switch when it starts, uses AI SDK 7 `WorkflowAgent` with only OpenAI's provider web-search tool, caps model calls, tool calls, steps, retries, time, and cost through the `market_research` policy, and records cumulative usage in the existing execution ledger. It validates a structured result against collected source URLs, persists it with `ai_secondary_research` provenance, finalizes actual usage, and releases unused reservation.

The founder reviews a concise result beside Help Me Do It. An explicit handoff may create a Proof Board `research_pattern` with zero customer metrics and `ai_secondary_research` provenance; it never represents a customer interview, payment, signup, or completed real-world Next Move.

To add a second executable type, add one named policy, a deterministic eligibility function tied to a canonical route, a minimized context builder, a narrow result schema and deterministic validator, a dedicated durable workflow, and an additive persistence record. Reuse `preflightExecution`, `startExecution`, `recordExecutionUsage`, and `finalizeExecution`; do not accept client budget/model/tool settings or build a generic agent runner.
