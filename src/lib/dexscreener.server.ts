/**
 * DEX Screener — secondary market data source for X Layer (chain id "xlayer").
 * Used to enrich or back-fill anything OKX Onchain OS does not return.
 * Server-only: never import from client components.
 */
const DS = "https://api.dexscreener.com";

export type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  txns?: Record<string, { buys?: number; sells?: number }>;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
};

const cache = new Map<string, { at: number; value: DexPair[] }>();
const TTL = 30_000;

async function dsFetch(path: string): Promise<DexPair[]> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const response = await fetch(`${DS}${path}`, { headers: { accept: "application/json" } });
    if (!response.ok) return [];
    const json = (await response.json()) as { pairs?: DexPair[] } | DexPair[];
    const pairs = Array.isArray(json) ? json : (json.pairs ?? []);
    const value = pairs.filter((p) => !p.chainId || p.chainId === "xlayer");
    cache.set(path, { at: Date.now(), value });
    return value;
  } catch {
    return [];
  }
}

/** Best (deepest) X Layer pair for a token address. */
export async function dexScreenerToken(address: string): Promise<DexPair | null> {
  const pairs = await dsFetch(`/latest/dex/tokens/${address}`);
  if (pairs.length === 0) return null;
  return pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
}

/** Broad X Layer pair search used to widen the discovery universe. */
export async function dexScreenerSearch(query: string): Promise<DexPair[]> {
  return dsFetch(`/latest/dex/search?q=${encodeURIComponent(query)}`);
}
