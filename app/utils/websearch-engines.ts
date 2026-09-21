// Shared, dependency-free web search engine clients.
// Used by the server route (/api/websearch) and directly by the browser
// in static-export mode (best effort — some engines need the server proxy).

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type EngineName =
  | "tavily"
  | "exa"
  | "serper"
  | "searxng"
  | "duckduckgo";

export interface EngineCreds {
  searxngUrl?: string;
  tavilyApiKey?: string;
  exaApiKey?: string;
  serperApiKey?: string;
  jinaApiKey?: string;
}

function stripHtml(s: string): string {
  return (s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 25000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tavily — AI-native search. Free tier: 1,000 credits/month, no card.
 * POST https://api.tavily.com/search + Bearer key + {query, max_results}
 * Docs: https://docs.tavily.com/documentation/api-reference/introduction
 */
export async function searchTavily(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      include_answer: false,
      search_depth: "basic",
    }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (json.results || []).slice(0, maxResults).map((r) => ({
    title: r.title || r.url || "Untitled",
    url: r.url || "",
    snippet: (r.content || "").slice(0, 500),
  }));
}

/**
 * Exa — neural/semantic search. Free tier: 20,000 searches/month (search only).
 * POST https://api.exa.ai/search + x-api-key + {query, numResults}
 */
export async function searchExa(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const res = await fetchWithTimeout("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
    },
    body: JSON.stringify({ query, numResults: maxResults }),
  });
  if (!res.ok) throw new Error(`Exa HTTP ${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; text?: string }>;
  };
  return (json.results || []).slice(0, maxResults).map((r) => ({
    title: r.title || r.url || "Untitled",
    url: r.url || "",
    snippet: (r.text || "").slice(0, 500),
  }));
}

/**
 * Serper — Google SERP proxy. Free: 2,500 one-time trial queries.
 * POST https://google.serper.dev/search + X-API-KEY + {q, num}
 */
export async function searchSerper(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const res = await fetchWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey.trim(),
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}`);
  const json = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (json.organic || []).slice(0, maxResults).map((o) => ({
    title: o.title || o.link || "Untitled",
    url: o.link || "",
    snippet: o.snippet || "",
  }));
}

/**
 * SearXNG — free, open-source metasearch (self-hosted or public instance).
 * GET {base}/search?q=…&format=json — no key.
 * Docs: https://docs.searxng.org/dev/search_api.html
 * Note: many public instances disable JSON output; those will fail and the
 * auto-chain falls through to the next engine.
 */
export async function searchSearXNG(
  query: string,
  baseUrl: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const base = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("SearXNG URL is empty");
  const url = `${base}/search?q=${encodeURIComponent(
    query,
  )}&format=json&pageno=1`;
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`SearXNG HTTP ${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (json.results || []).slice(0, maxResults).map((r) => ({
    title: stripHtml(r.title || r.url || "Untitled").slice(0, 200),
    url: r.url || "",
    snippet: stripHtml(r.content || "").slice(0, 500),
  }));
}

/**
 * DuckDuckGo HTML endpoint — completely free, no key.
 * Works reliably server-side; browsers are usually blocked by CORS,
 * so in static-export mode this engine is skipped.
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
    query,
  )}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
  const html = await res.text();
  const linkRe =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snipRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const links = [...html.matchAll(linkRe)];
  const snips = [...html.matchAll(snipRe)];
  if (links.length === 0) throw new Error("DuckDuckGo returned no results");
  return links.slice(0, maxResults).map((m, i) => {
    let href = m[1] || "";
    // DDG wraps links: //duckduckgo.com/l/?uddg=<urlencoded>&rut=…
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1]);
      } catch {}
    }
    if (href.startsWith("//")) href = "https:" + href;
    return {
      title: stripHtml(m[2]).slice(0, 200) || href,
      url: href,
      snippet: stripHtml(snips[i]?.[1] || "").slice(0, 500),
    };
  });
}

/**
 * Jina Reader — turns any URL into LLM-ready markdown.
 * Free without key (~20 RPM), 10M free tokens with a free key.
 * GET https://r.jina.ai/{url} — see https://jina.ai/reader
 */
export async function readPageWithJina(
  url: string,
  apiKey?: string,
): Promise<string> {
  const headers: Record<string, string> = { Accept: "text/markdown" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, { headers });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  return (await res.text()).slice(0, 12000);
}

/**
 * Auto chain: first configured engine wins, DuckDuckGo is the keyless fallback.
 * Order prefers quality free tiers (Tavily → Exa → Serper) then self-hosted SearXNG.
 */
export function pickEngines(
  preferred: EngineName | "auto",
  creds: EngineCreds,
): EngineName[] {
  if (preferred !== "auto") return [preferred];
  const chain: EngineName[] = [];
  if (creds.tavilyApiKey) chain.push("tavily");
  if (creds.exaApiKey) chain.push("exa");
  if (creds.serperApiKey) chain.push("serper");
  if (creds.searxngUrl) chain.push("searxng");
  chain.push("duckduckgo");
  return chain;
}

export async function runEngine(
  engine: EngineName,
  query: string,
  maxResults: number,
  creds: EngineCreds,
): Promise<WebSearchResult[]> {
  switch (engine) {
    case "tavily":
      if (!creds.tavilyApiKey) throw new Error("Tavily API key is empty");
      return searchTavily(query, creds.tavilyApiKey, maxResults);
    case "exa":
      if (!creds.exaApiKey) throw new Error("Exa API key is empty");
      return searchExa(query, creds.exaApiKey, maxResults);
    case "serper":
      if (!creds.serperApiKey) throw new Error("Serper API key is empty");
      return searchSerper(query, creds.serperApiKey, maxResults);
    case "searxng":
      if (!creds.searxngUrl) throw new Error("SearXNG URL is empty");
      return searchSearXNG(query, creds.searxngUrl, maxResults);
    case "duckduckgo":
      return searchDuckDuckGo(query, maxResults);
  }
}
