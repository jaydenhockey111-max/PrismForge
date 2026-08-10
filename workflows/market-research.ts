import { Output, isStepCount } from "ai";
import { openai } from "@ai-sdk/openai";
import { WorkflowAgent } from "@ai-sdk/workflow";
import { getWritable } from "workflow";
import { calculateCostUsd, resolveRoute } from "@/lib/ai/platform/pricing";
import { canContinueExecution, getExecutionPolicy, type TerminationReason } from "@/lib/execution/policy";
import { MARKET_RESEARCH_EXECUTION_TYPE, marketResearchInstructions, marketResearchResultSchema, nextResearchCheck, sourceUrlsFromSteps, validateMarketResearchResult, type MarketResearchContext, PROVIDER_WEB_SEARCH_COST_USD } from "@/lib/execution/marketResearch";
import { beginMarketResearchExecution, completeMarketResearchExecution, failMarketResearchExecution, getMarketResearchExecution } from "@/lib/execution/marketResearchRepository";
import { finalizeExecution, recordExecutionUsage, startExecution } from "@/lib/execution/repository";
import { logBetaEvent } from "@/lib/analytics/betaEvents";

export async function runMarketResearchWorkflow(input: { executionId: string; context: MarketResearchContext }) {
  "use workflow";
  const execution = await beginResearchStep(input.executionId);
  if (!execution) return { status: "ignored" as const };
  const policy = getExecutionPolicy(MARKET_RESEARCH_EXECUTION_TYPE);
  const route = resolveRoute("openai_balanced");
  if (!policy || !route.ok) return failResearchStep(execution.id, execution.reservation_id, "POLICY_REJECTED", "A controlled model route was unavailable.");
  if (!await startResearchLedgerStep(execution.reservation_id)) return failResearchStep(execution.id, execution.reservation_id, "POLICY_REJECTED", "Autonomous execution was disabled before work began.");

  const startedAt = Date.now();
  const initialCheck = canContinueExecution(nextResearchCheck(policy, { actualCostUsd: 0, modelCalls: 0, toolCalls: 0, retries: 0, steps: 0, startedAt }, "model"));
  if (!initialCheck.allowed) return failResearchStep(execution.id, execution.reservation_id, initialCheck.reason, "The execution policy did not allow the first research step.");

  try {
    const agent = new WorkflowAgent({
      model: openai.responses(route.model),
      instructions: marketResearchInstructions(input.context),
      tools: {
        web_search: openai.tools.webSearch({ externalWebAccess: true, searchContextSize: "low" }),
      },
      stopWhen: isStepCount(policy.maxModelCalls),
      maxRetries: 0,
      maxOutputTokens: 1_400,
      prepareStep: ({ stepNumber }) => {
        const check = canContinueExecution(nextResearchCheck(policy, {
          actualCostUsd: stepNumber * 0.01 + (stepNumber > 0 ? PROVIDER_WEB_SEARCH_COST_USD : 0),
          modelCalls: stepNumber,
          toolCalls: stepNumber > 0 ? 1 : 0,
          retries: 0,
          steps: stepNumber,
          startedAt,
        }, "model"));
        if (!check.allowed) throw new Error(check.reason);
        return stepNumber === 0
          ? { toolChoice: { type: "tool" as const, toolName: "web_search" as const } }
          : { toolChoice: "none" as const };
      },
      onStepFinish: async (step) => {
        const usage = step.usage;
        const modelCost = calculateCostUsd({ model: route.model, inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0, cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? 0 }) ?? policy.maxBudgetUsd;
        const toolCalls = step.toolCalls.filter((tool) => tool.toolName === "web_search").length;
        await recordUsageStep({ reservationId: execution.reservation_id, internalActualCostUsd: modelCost + (toolCalls ? PROVIDER_WEB_SEARCH_COST_USD : 0), modelCalls: step.stepNumber + 1, toolCalls, retries: 0, steps: step.stepNumber + 1 });
      },
    });
    const result = await agent.stream({
      prompt: "Research the supplied current Next Move. Search once, then synthesize a cited, decision-useful answer.",
      writable: getWritable(),
      output: Output.object({ schema: marketResearchResultSchema }),
      timeout: policy.maxRuntimeMs,
    });
    const sourceUrls = sourceUrlsFromSteps(result.steps);
    const validated = validateMarketResearchResult(result.output, sourceUrls, execution.id);
    const totalModelCost = calculateCostUsd({ model: route.model, inputTokens: result.totalUsage.inputTokens ?? 0, outputTokens: result.totalUsage.outputTokens ?? 0, cachedInputTokens: result.totalUsage.inputTokenDetails.cacheReadTokens ?? 0 }) ?? policy.maxBudgetUsd;
    const totalToolCalls = result.steps.flatMap((step) => step.toolCalls).filter((tool) => tool.toolName === "web_search").length;
    await recordUsageStep({ reservationId: execution.reservation_id, internalActualCostUsd: totalModelCost + (totalToolCalls ? PROVIDER_WEB_SEARCH_COST_USD : 0), modelCalls: result.steps.length, toolCalls: totalToolCalls, retries: 0, steps: result.steps.length });
    await completeResearchStep(execution.id, validated);
    await finalizeResearchStep(execution.reservation_id, "completed", "COMPLETED");
    return { status: "completed" as const, executionId: execution.id };
  } catch (error) {
    const reason = terminationReason(error);
    return failResearchStep(execution.id, execution.reservation_id, reason, error instanceof Error ? error.message : "Research failed.");
  }
}

async function beginResearchStep(executionId: string) { "use step"; return beginMarketResearchExecution(executionId); }
async function startResearchLedgerStep(reservationId: string) { "use step"; return startExecution(reservationId); }
async function recordUsageStep(input: { reservationId: string; internalActualCostUsd: number; modelCalls: number; toolCalls: number; retries: number; steps: number }) { "use step"; return recordExecutionUsage({ ...input, customerAllowanceConsumedUsd: input.internalActualCostUsd }); }
async function completeResearchStep(executionId: string, result: ReturnType<typeof validateMarketResearchResult>) { "use step"; const execution = await getMarketResearchExecution(executionId); await completeMarketResearchExecution(executionId, result); await logBetaEvent({ userId: execution?.user_id ?? null, projectId: execution?.project_id ?? null, eventName: "execution_completed", source: "market_research", metadata: { execution_type: MARKET_RESEARCH_EXECUTION_TYPE } }); }
async function finalizeResearchStep(reservationId: string, status: "completed" | "failed" | "released", terminationReason: TerminationReason) { "use step"; return finalizeExecution({ reservationId, status, terminationReason }); }
async function failResearchStep(executionId: string, reservationId: string, reason: TerminationReason, message: string) { "use step"; const execution = await getMarketResearchExecution(executionId); await failMarketResearchExecution(executionId, message); await finalizeExecution({ reservationId, status: "failed", terminationReason: reason }); await logBetaEvent({ userId: execution?.user_id ?? null, projectId: execution?.project_id ?? null, eventName: "execution_failed", source: "market_research", metadata: { execution_type: MARKET_RESEARCH_EXECUTION_TYPE, reason } }); return { status: "failed" as const, reason }; }

function terminationReason(error: unknown): TerminationReason {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("BUDGET_EXHAUSTED")) return "BUDGET_EXHAUSTED";
  if (message.includes("CALL_LIMIT")) return "CALL_LIMIT";
  if (message.includes("TOOL_LIMIT")) return "TOOL_LIMIT";
  if (message.includes("STEP_LIMIT")) return "STEP_LIMIT";
  if (message.includes("TIMEOUT")) return "TIMEOUT";
  return "PROVIDER_ERROR";
}
