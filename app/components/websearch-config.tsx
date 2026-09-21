import { useState } from "react";

import { IconButton } from "./button";
import {
  ListItem,
  PasswordInput,
  Select,
  showPrompt,
  showToast,
} from "./ui-lib";

import Locale from "../locales";
import { useWebSearchStore, type WebSearchEngine } from "../store/websearch";
import { runWebSearch } from "../utils/websearch";

const ENGINES: Array<{ value: WebSearchEngine; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "tavily", label: "Tavily" },
  { value: "exa", label: "Exa" },
  { value: "serper", label: "Serper" },
  { value: "searxng", label: "SearXNG" },
  { value: "duckduckgo", label: "DuckDuckGo" },
];

export function WebSearchConfig() {
  const ws = useWebSearchStore();
  const L = Locale.Settings.WebSearch;
  const [testing, setTesting] = useState(false);

  async function onTest() {
    const q = (await showPrompt(L.TestPrompt, "latest AI news", 1))?.trim();
    if (!q) return;
    setTesting(true);
    try {
      const { results, engine } = await runWebSearch(q);
      showToast(L.TestOk(engine, results.length));
    } catch (e: any) {
      showToast(L.SearchFail(e?.message || String(e)));
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <ListItem title={L.Title} subTitle={L.SubTitle}>
        <input
          aria-label={L.Title}
          type="checkbox"
          checked={ws.enabled}
          onChange={(e) =>
            ws.update((s) => (s.enabled = e.currentTarget.checked))
          }
        />
      </ListItem>
      <ListItem title={L.UseAsTool.Title} subTitle={L.UseAsTool.SubTitle}>
        <input
          aria-label={L.UseAsTool.Title}
          type="checkbox"
          checked={ws.useAsTool}
          onChange={(e) =>
            ws.update((s) => (s.useAsTool = e.currentTarget.checked))
          }
        />
      </ListItem>
      <ListItem title={L.Engine.Title} subTitle={L.Engine.SubTitle}>
        <Select
          aria-label={L.Engine.Title}
          value={ws.engine}
          onChange={(e) =>
            ws.update((s) => (s.engine = e.target.value as WebSearchEngine))
          }
        >
          {ENGINES.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </ListItem>
      <ListItem title={L.MaxResults.Title} subTitle={L.MaxResults.SubTitle}>
        <input
          aria-label={L.MaxResults.Title}
          type="number"
          min={1}
          max={10}
          value={ws.maxResults}
          onChange={(e) =>
            ws.update(
              (s) =>
                (s.maxResults = Math.min(
                  Math.max(parseInt(e.currentTarget.value) || 5, 1),
                  10,
                )),
            )
          }
        />
      </ListItem>
      <ListItem title={L.SearxngUrl.Title} subTitle={L.SearxngUrl.SubTitle}>
        <input
          aria-label={L.SearxngUrl.Title}
          type="text"
          value={ws.searxngUrl}
          placeholder="https://searx.be"
          onChange={(e) =>
            ws.update((s) => (s.searxngUrl = e.currentTarget.value))
          }
        />
      </ListItem>
      <ListItem title={L.TavilyKey.Title} subTitle={L.TavilyKey.SubTitle}>
        <PasswordInput
          value={ws.tavilyApiKey}
          type="text"
          placeholder="tvly-…"
          onChange={(e) =>
            ws.update((s) => (s.tavilyApiKey = e.currentTarget.value))
          }
        />
      </ListItem>
      <ListItem title={L.ExaKey.Title} subTitle={L.ExaKey.SubTitle}>
        <PasswordInput
          value={ws.exaApiKey}
          type="text"
          onChange={(e) =>
            ws.update((s) => (s.exaApiKey = e.currentTarget.value))
          }
        />
      </ListItem>
      <ListItem title={L.SerperKey.Title} subTitle={L.SerperKey.SubTitle}>
        <PasswordInput
          value={ws.serperApiKey}
          type="text"
          onChange={(e) =>
            ws.update((s) => (s.serperApiKey = e.currentTarget.value))
          }
        />
      </ListItem>
      <ListItem title={L.JinaKey.Title} subTitle={L.JinaKey.SubTitle}>
        <PasswordInput
          value={ws.jinaApiKey}
          type="text"
          onChange={(e) =>
            ws.update((s) => (s.jinaApiKey = e.currentTarget.value))
          }
        />
      </ListItem>
      <ListItem title={L.Test.Title} subTitle={L.Test.SubTitle}>
        <IconButton
          text={testing ? "..." : L.Test.Action}
          bordered
          disabled={testing}
          onClick={onTest}
        />
      </ListItem>
    </>
  );
}
