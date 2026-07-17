import "server-only";

export type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
};

export function getOpenAIConfig(featureMaxOutputTokens?: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const requestedEnvMax = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 650);
  const envMax = Number.isFinite(requestedEnvMax) ? Math.min(Math.max(requestedEnvMax, 128), 1_200) : 650;
  if (requestedEnvMax > 1_200) console.warn("[openai-config] OPENAI_MAX_OUTPUT_TOKENS is clamped to 1200 for beta cost control.");
  const maxOutputTokens = featureMaxOutputTokens ? Math.min(featureMaxOutputTokens, envMax) : envMax;
  return {
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    maxOutputTokens,
  };
}

export function extractResponseText(payload: OpenAIResponse) {
  if (payload.output_text) return payload.output_text;
  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");
}
