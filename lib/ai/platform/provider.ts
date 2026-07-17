import "server-only";
import { requestOpenAiJson } from "@/lib/ai/platform/openaiProvider";
import type { AiProviderResult } from "@/lib/ai/platform/types";

export type AiProviderRequest = {
  model: string;
  system: string;
  user: string;
  maxOutputTokens: number;
  timeoutMs: number;
  requestId: string;
};

export interface AiProvider {
  readonly id: "openai";
  execute(request: AiProviderRequest): Promise<AiProviderResult>;
}

const openAiProvider: AiProvider = {
  id: "openai",
  execute: requestOpenAiJson,
};

export function getAiProvider(provider: "openai"): AiProvider {
  if (provider === "openai") return openAiProvider;
  throw new Error("No registered AI provider is available for this route.");
}
