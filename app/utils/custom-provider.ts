import { OpenaiPath } from "../constant";
import { getClientConfig } from "../config/client";
import { useAccessStore, type CustomProvider } from "../store/access";
import type { LLMModel } from "../client/api";

export const CUSTOM_PROVIDER_SORT_BASE = 9000;
export const CUSTOM_MODEL_SORT_BASE = 9000;

/**
 * Normalize a user-entered base URL.
 * Client paths already contain the version prefix (e.g. "v1/chat/completions"),
 * so a trailing "/v1" is stripped to avoid "…/v1/v1/…" URLs.
 */
export function normalizeBaseUrl(raw: string): string {
  let url = (raw || "").trim().replace(/\/+$/, "");
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  url = url.replace(/\/v1$/, "");
  return url;
}

/** Find an enabled custom provider by its display name (stored in session.modelConfig.providerName). */
export function getCustomProvider(
  name?: string,
): CustomProvider | undefined {
  if (!name) return undefined;
  const list = useAccessStore.getState().customProviders || [];
  return list.find((p) => p.enabled !== false && p.name === name);
}

/** The server proxy (/api/proxy) exists in every build mode except pure static export. */
export function canUseServerProxy(): boolean {
  try {
    return getClientConfig()?.buildMode !== "export";
  } catch {
    return true;
  }
}

export interface CustomFetchTarget {
  url: string;
  headers: Record<string, string>;
}

/**
 * Build a request target for a custom provider sub-path (e.g. "v1/models").
 * Via server proxy: `/api/proxy/<subpath>` + `X-Base-URL` header (no CORS issues,
 * same mechanism the plugin tools already use). Direct otherwise.
 */
export function customRequestTarget(
  provider: CustomProvider,
  subpath: string,
): CustomFetchTarget {
  const base = normalizeBaseUrl(provider.baseUrl);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey.trim()}`;
  }
  if (provider.useProxy && canUseServerProxy()) {
    headers["X-Base-URL"] = base;
    return { url: `/api/proxy/${subpath}`, headers };
  }
  return { url: `${base}/${subpath}`, headers };
}

/**
 * GET {base}/v1/models
 * OpenAI-compatible contract: https://developers.openai.com/api/reference/resources/models/methods/list
 * → { object: "list", data: [{ id, ... }] }
 */
export async function fetchCustomModelIds(
  provider: CustomProvider,
): Promise<string[]> {
  const { url, headers } = customRequestTarget(
    provider,
    OpenaiPath.ListModelPath,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ id?: string }>;
      error?: any;
    };
    if (json?.error) {
      const msg =
        typeof json.error === "string"
          ? json.error
          : json.error?.message || "provider error";
      throw new Error(msg);
    }
    const ids = (json?.data || []).map((m) => m?.id).filter(Boolean) as string[];
    return Array.from(new Set(ids));
  } finally {
    clearTimeout(timer);
  }
}

export function customModelsFromIds(
  ids: string[],
  provider: CustomProvider,
  providerIndex: number,
): LLMModel[] {
  return ids.map((id, i) => ({
    name: id,
    available: true,
    sorted: CUSTOM_MODEL_SORT_BASE + i,
    provider: {
      id: provider.id,
      providerName: provider.name,
      providerType: "custom",
      sorted: CUSTOM_PROVIDER_SORT_BASE + Math.max(providerIndex, 0),
    },
  }));
}
