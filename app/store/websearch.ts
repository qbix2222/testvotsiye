import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";

export type WebSearchEngine =
  | "auto"
  | "tavily"
  | "exa"
  | "serper"
  | "searxng"
  | "duckduckgo";

export const DEFAULT_WEBSEARCH_STATE = {
  /** Master switch for web search (tool calling + manual button). */
  enabled: true,
  /** Let the model call web_search/fetch_page itself via function calling. */
  useAsTool: true,
  /** "auto" tries configured engines in order, DuckDuckGo is the keyless fallback. */
  engine: "auto" as WebSearchEngine,
  maxResults: 5,
  /** Any SearXNG instance with JSON enabled (or your self-hosted one). */
  searxngUrl: "https://searx.be",
  /** Free tiers: Tavily 1k/mo, Exa 20k/mo, Serper 2.5k trial. Empty = skipped. */
  tavilyApiKey: "",
  exaApiKey: "",
  serperApiKey: "",
  /** Optional: raises Jina Reader rate limits (works without a key too). */
  jinaApiKey: "",
};

export type WebSearchState = typeof DEFAULT_WEBSEARCH_STATE;

export const useWebSearchStore = createPersistStore(
  { ...DEFAULT_WEBSEARCH_STATE },
  () => ({}),
  {
    name: StoreKey.WebSearch,
    version: 1,
  },
);
