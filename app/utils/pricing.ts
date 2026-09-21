import { useAppConfig } from "../store/config";

export type ModelPrice = {
  input: number; // USD per 1M tokens
  output: number; // USD per 1M tokens
};

export type PricingRow = {
  prefix: string;
  price: ModelPrice;
};

/**
 * Parse the pricing table. One rule per line:
 *   prefix=input$/1M,output$/1M
 * Lines starting with # are comments. Longest matching prefix wins.
 */
export function parsePricingTable(text: string): PricingRow[] {
  return (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((line) => {
      const m = line.match(/^([^=]+)=\s*([\d.]+)\s*,\s*([\d.]+)\s*$/);
      if (!m) return null;
      const input = parseFloat(m[2]);
      const output = parseFloat(m[3]);
      if (isNaN(input) || isNaN(output)) return null;
      return { prefix: m[1].trim(), price: { input, output } };
    })
    .filter((r): r is PricingRow => r !== null);
}

export function getModelPrice(model: string): ModelPrice {
  const cfg = useAppConfig.getState();
  const fallback: ModelPrice = {
    input: cfg.tokenPricing.inputPer1M || 0,
    output: cfg.tokenPricing.outputPer1M || 0,
  };
  let best: PricingRow | null = null;
  for (const row of parsePricingTable(cfg.modelPricing)) {
    if (model === row.prefix || model.startsWith(row.prefix)) {
      if (!best || row.prefix.length > best.prefix.length) best = row;
    }
  }
  return best?.price ?? fallback;
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = getModelPrice(model);
  return (promptTokens * p.input + completionTokens * p.output) / 1e6;
}
