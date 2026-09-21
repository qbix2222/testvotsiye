import { getClientConfig } from "../config/client";
import { useWebSearchStore } from "../store/websearch";
import {
  pickEngines,
  readPageWithJina,
  runEngine,
  type WebSearchResult,
} from "./websearch-engines";

export type { WebSearchResult };

function isExportMode(): boolean {
  try {
    return getClientConfig()?.buildMode === "export";
  } catch {
    return false;
  }
}

export async function runWebSearch(
  query: string,
): Promise<{ results: WebSearchResult[]; engine: string }> {
  const s = useWebSearchStore.getState();
  const q = (query || "").trim();
  if (!q) throw new Error("empty query");

  if (!isExportMode()) {
    const res = await fetch("/api/websearch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "search",
        query: q,
        engine: s.engine,
        maxResults: s.maxResults,
        searxngUrl: s.searxngUrl,
        tavilyApiKey: s.tavilyApiKey,
        exaApiKey: s.exaApiKey,
        serperApiKey: s.serperApiKey,
      }),
    });
    const json = (await res.json()) as any;
    if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return { results: json.results, engine: json.engine };
  }

  // Static export has no server route: call engines directly (best effort).
  // DuckDuckGo HTML has no CORS support, so it is skipped here.
  const creds = {
    searxngUrl: s.searxngUrl,
    tavilyApiKey: s.tavilyApiKey,
    exaApiKey: s.exaApiKey,
    serperApiKey: s.serperApiKey,
    jinaApiKey: s.jinaApiKey,
  };
  const errors: string[] = [];
  for (const name of pickEngines(s.engine, creds)) {
    if (name === "duckduckgo") {
      errors.push("duckduckgo: needs a server deploy (no CORS)");
      continue;
    }
    try {
      const results = await runEngine(name, q, s.maxResults, creds);
      if (results.length > 0) return { results, engine: name };
      errors.push(`${name}: no results`);
    } catch (e: any) {
      errors.push(`${name}: ${e?.message || String(e)}`);
    }
  }
  throw new Error(errors.join("; ") || "all engines failed");
}

export async function readWebPage(url: string): Promise<string> {
  const s = useWebSearchStore.getState();
  if (!isExportMode()) {
    const res = await fetch("/api/websearch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", url, jinaApiKey: s.jinaApiKey }),
    });
    const json = (await res.json()) as any;
    if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json.content as string;
  }
  return readPageWithJina(url, s.jinaApiKey || undefined);
}

export function formatResultsForLLM(
  results: WebSearchResult[],
  engine: string,
): string {
  const lines = results.map(
    (r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`,
  );
  return `Web search results (engine: ${engine}, date: ${new Date().toISOString().slice(0, 10)}):\n${lines.join("\n\n")}`;
}

export function formatResultsForChat(
  query: string,
  results: WebSearchResult[],
  engine: string,
): string {
  const lines = results.map(
    (r, i) => `**${i + 1}. [${r.title}](${r.url})**\n${r.snippet}`,
  );
  return `🔍 "${query}" (via ${engine}):\n\n${lines.join("\n\n")}`;
}

/**
 * Conservative allowlist check: only attach function tools to models that
 * accept the OpenAI `tools` parameter. Image/audio/embedding models are out.
 */
export function modelSupportsTools(model: string): boolean {
  const m = (model || "").toLowerCase();
  if (!m) return false;
  const banned = [
    "dall-e",
    "dalle",
    "tts-",
    "whisper",
    "embedding",
    "stable-diffusion",
    "stable-image",
    "cogview",
    "kling",
    "o1-mini",
    "o1-preview",
  ];
  return !banned.some((b) => m.includes(b));
}

/**
 * OpenAI-style function tools for the chat pipeline.
 * Funcs return axios-like {data, status} — see streamWithThink in utils/chat.ts.
 */
export function buildWebSearchTools(): [any[], Record<string, Function>] {
  const tools = [
    {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the web for up-to-date or external information. Use it whenever the user asks about current events, facts you are unsure about, documentation, prices, people, or anything beyond your training data. Always pass a concise search query.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Concise web search query",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "fetch_page",
        description:
          "Fetch a web page URL and return its content as markdown. Use it to read details behind a search result link.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Full page URL, including https://",
            },
          },
          required: ["url"],
        },
      },
    },
  ];
  const funcs: Record<string, Function> = {
    web_search: async (args: { query: string }) => {
      const { results, engine } = await runWebSearch(args.query);
      return {
        data: formatResultsForLLM(results, engine).slice(0, 6000),
        status: 200,
      };
    },
    fetch_page: async (args: { url: string }) => {
      const content = await readWebPage(args.url);
      return { data: content.slice(0, 8000), status: 200 };
    },
  };
  return [tools, funcs];
}
