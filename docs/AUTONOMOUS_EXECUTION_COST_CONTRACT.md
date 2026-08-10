# Autonomous execution cost contract

Future Do It For Me workers must use only the server-side functions in `lib/execution`.
They must never accept a budget, model tier, tool permission, or limit from the client.

1. Call `preflightExecution` with the authenticated user, owned project, registered execution type, request ID, and conservative estimated cost. Do not start work unless it returns `allowed: true`.
2. Call `startExecution` immediately before work begins; it rechecks the global kill switch. Treat the returned reservation ID and policy as immutable. If approval is required, stop before any external action.
3. Before every model call, paid tool call, retry, or loop step, call `canContinueExecution` using cumulative usage and the next conservative estimate. Stop on any denial.
4. After each cost-bearing operation, call `recordExecutionUsage`. Record known internal cost even if the later job fails; customer allowance consumption can be lower.
5. In a `finally` block call `finalizeExecution`: `completed` for success, `failed` after recorded provider/tool usage, `cancelled` for a user cancellation, or `released` when no usage occurred. This releases unused reserved allowance.

The database reservation is atomic per user/month and idempotent per request ID. Only server-side service-role code can call its RPCs. The global `AUTONOMOUS_EXECUTION_ENABLED=true` switch is required before any policy is eligible. No agent, workflow, Sandbox, tool runner, or approval UI is implemented by this foundation.
