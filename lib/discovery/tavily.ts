import type { SearchResult } from "@/lib/discovery/types";

type TavilyResponse = {
  results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string; score?: number }>;
};

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not configured");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      topic: "general",
      search_depth: "advanced",
      max_results: Math.min(Math.max(maxResults, 1), 10),
      include_answer: false,
      include_images: false,
      include_raw_content: true,
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Tavily search returned HTTP ${response.status}`);
  const data = await response.json() as TavilyResponse;
  return (data.results ?? []).flatMap((result) => {
    if (!result.url || !result.title) return [];
    const canonical = canonicalizeUrl(result.url);
    if (!canonical) return [];
    return [{
      title: result.title.trim().slice(0, 300),
      url: canonical,
      snippet: (result.content ?? "").trim().slice(0, 3000),
      rawContent: (result.raw_content ?? result.content ?? "").trim().slice(0, 30_000),
      score: Math.max(0, Math.min(1, result.score ?? 0)),
      query,
    }];
  });
}

export function canonicalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
    url.hostname = hostname;
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch { return null; }
}
