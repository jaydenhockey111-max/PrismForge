import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOpenAiJson } from "@/lib/ai/platform/openaiProvider";

const request = () => requestOpenAiJson({
  model: "gpt-4.1-mini",
  system: "system",
  user: "user",
  maxOutputTokens: 100,
  timeoutMs: 5_000,
  requestId: "11111111-1111-4111-8111-111111111111",
});

describe("OpenAI provider transport failures", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("classifies exhausted transport retries without exposing the transport error", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request()).rejects.toMatchObject({ category: "provider_unavailable", attempts: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("classifies an aborted request as a provider timeout", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const abort = new Error("aborted");
    abort.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    await expect(request()).rejects.toMatchObject({ category: "provider_timeout", attempts: 1 });
  });
});
