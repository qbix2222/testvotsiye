import { NextRequest, NextResponse } from "next/server";
import {
  pickEngines,
  readPageWithJina,
  runEngine,
  type EngineName,
} from "@/app/utils/websearch-engines";

/**
 * POST /api/websearch
 * Body (search): { action: "search", query, engine?, maxResults?,
 *   searxngUrl?, tavilyApiKey?, exaApiKey?, serperApiKey? }
 * Body (read):   { action: "read", url, jinaApiKey? }
 * Keys are passed per-request from the browser settings and never stored server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as any;
    const {
      action,
      query,
      url,
      engine = "auto",
      maxResults = 5,
      searxngUrl,
      tavilyApiKey,
      exaApiKey,
      serperApiKey,
      jinaApiKey,
    } = body || {};

    if (action === "read") {
      if (!url || typeof url !== "string") {
        return NextResponse.json(
          { ok: false, error: "url required" },
          { status: 400 },
        );
      }
      const content = await readPageWithJina(url, jinaApiKey || undefined);
      return NextResponse.json({ ok: true, content });
    }

    const q = String(query || "").trim();
    if (!q) {
      return NextResponse.json(
        { ok: false, error: "query required" },
        { status: 400 },
      );
    }
    const creds = {
      searxngUrl,
      tavilyApiKey,
      exaApiKey,
      serperApiKey,
      jinaApiKey,
    };
    const limit = Math.min(Math.max(Number(maxResults) || 5, 1), 10);

    const errors: string[] = [];
    for (const name of pickEngines(engine as EngineName | "auto", creds)) {
      try {
        const results = await runEngine(name, q, limit, creds);
        if (results.length > 0) {
          return NextResponse.json({ ok: true, engine: name, results });
        }
        errors.push(`${name}: no results`);
      } catch (e: any) {
        errors.push(`${name}: ${e?.message || String(e)}`);
      }
    }
    return NextResponse.json(
      { ok: false, error: errors.join("; ") || "all engines failed" },
      { status: 502 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "websearch failed" },
      { status: 500 },
    );
  }
}

export const runtime = "edge";
