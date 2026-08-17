import { DEXSCREENER_CHAIN, X_LAYER } from "./xlayer";

export type MarketToken = {
  address: string;
  symbol: string;
  name: string;
  pairAddress: string;
  dexId: string;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  change5m: number | null;
  change1h: number | null;
  change6h: number | null;
  change24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  pairCreatedAt: number | null;
  url: string;
};

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  txns?: Record<string, { buys?: number; sells?: number }>;
  pairCreatedAt?: number;
};

const num = (value: unknown) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : null;
};

export function mapPair(pair: DexPair): MarketToken {
  return {
    address: pair.baseToken?.address ?? "",
    symbol: pair.baseToken?.symbol ?? "?",
    name: pair.baseToken?.name ?? "Unknown",
    pairAddress: pair.pairAddress ?? "",
    dexId: pair.dexId ?? "",
    priceUsd: num(pair.priceUsd),
    marketCap: num(pair.marketCap),
    fdv: num(pair.fdv),
    liquidityUsd: num(pair.liquidity?.usd),
    volume24h: num(pair.volume?.["h24"]),
    change5m: num(pair.priceChange?.["m5"]),
    change1h: num(pair.priceChange?.["h1"]),
    change6h: num(pair.priceChange?.["h6"]),
    change24h: num(pair.priceChange?.["h24"]),
    buys24h: num(pair.txns?.["h24"]?.buys),
    sells24h: num(pair.txns?.["h24"]?.sells),
    pairCreatedAt: num(pair.pairCreatedAt),
    url: pair.url ?? "",
  };
}

async function dexFetch(path: string): Promise<DexPair[]> {
  const response = await fetch(`https://api.dexscreener.com${path}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`DEX Screener request failed [${response.status}]: ${await response.text()}`);
  }
  const json = (await response.json()) as { pairs?: DexPair[] } | DexPair[];
  const pairs = Array.isArray(json) ? json : (json.pairs ?? []);
  return pairs.filter((pair) => pair?.chainId === DEXSCREENER_CHAIN);
}

function dedupeByToken(pairs: DexPair[]): MarketToken[] {
  const best = new Map<string, MarketToken>();
  for (const pair of pairs) {
    const mapped = mapPair(pair);
    if (!mapped.address) continue;
    const existing = best.get(mapped.address.toLowerCase());
    if (!existing || (mapped.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)) {
      best.set(mapped.address.toLowerCase(), mapped);
    }
  }
  return [...best.values()];
}

export async function discoverXLayerTokens(query = "xlayer"): Promise<MarketToken[]> {
  const searches = await Promise.allSettled([
    dexFetch(`/latest/dex/search?q=${encodeURIComponent(query)}`),
    dexFetch(`/latest/dex/search?q=${encodeURIComponent("OKB")}`),
  ]);
  const pairs = searches.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return dedupeByToken(pairs)
    .filter((token) => (token.liquidityUsd ?? 0) > 500)
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

export async function fetchTokenMarket(address: string): Promise<MarketToken | null> {
  const pairs = await dexFetch(`/token-pairs/v1/${DEXSCREENER_CHAIN}/${address}`).catch(() => []);
  const tokens = dedupeByToken(pairs);
  return tokens[0] ?? null;
}

type RpcResult = string | null;

async function rpc(method: string, params: unknown[]): Promise<RpcResult> {
  for (const url of X_LAYER.rpcUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { result?: string };
      if (json.result) return json.result;
    } catch {
      continue;
    }
  }
  return null;
}

export type OnchainSnapshot = {
  blockNumber: number | null;
  isContract: boolean;
  totalSupply: string | null;
  holders: number | null;
  transferCount: number | null;
  source: "live" | "partial" | "unavailable";
};

export async function fetchOnchain(address: string): Promise<OnchainSnapshot> {
  const [block, code, supply] = await Promise.all([
    rpc("eth_blockNumber", []),
    rpc("eth_getCode", [address, "latest"]),
    // totalSupply()
    rpc("eth_call", [{ to: address, data: "0x18160ddd" }, "latest"]),
  ]);

  let holders: number | null = null;
  let transferCount: number | null = null;
  const apiKey = process.env["OKLINK_API_KEY"];
  if (apiKey) {
    try {
      const response = await fetch(
        `https://www.oklink.com/api/v5/explorer/token/token-list?chainShortName=XLAYER&tokenContractAddress=${address}`,
        { headers: { "Ok-Access-Key": apiKey, accept: "application/json" } },
      );
      if (response.ok) {
        const json = (await response.json()) as {
          data?: { tokenList?: { holders?: string; transferCount?: string }[] }[];
        };
        const row = json.data?.[0]?.tokenList?.[0];
        holders = row?.holders ? Number(row.holders) : null;
        transferCount = row?.transferCount ? Number(row.transferCount) : null;
      }
    } catch {
      holders = null;
    }
  }

  const blockNumber = block ? Number.parseInt(block, 16) : null;
  return {
    blockNumber,
    isContract: Boolean(code && code !== "0x"),
    totalSupply: supply && supply !== "0x" ? BigInt(supply).toString() : null,
    holders,
    transferCount,
    source: blockNumber ? (holders != null ? "live" : "partial") : "unavailable",
  };
}

export type Scores = {
  xowlScore: number;
  riskScore: number;
  smartMoneyScore: number;
  decision: "CALL" | "WATCH" | "FILTERED";
  factors: { label: string; value: number }[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function scoreToken(market: MarketToken, onchain: OnchainSnapshot): Scores {
  const liquidity = market.liquidityUsd ?? 0;
  const volume = market.volume24h ?? 0;
  const buys = market.buys24h ?? 0;
  const sells = market.sells24h ?? 0;
  const ageHours = market.pairCreatedAt ? (Date.now() - market.pairCreatedAt) / 3_600_000 : 0;

  const liquidityScore = clamp(Math.log10(Math.max(liquidity, 1)) * 20);
  const volumeScore = clamp(Math.log10(Math.max(volume, 1)) * 18);
  const momentumScore = clamp(50 + (market.change24h ?? 0) * 1.2);
  const flowScore = clamp(buys + sells > 0 ? (buys / (buys + sells)) * 130 - 15 : 30);
  const holderScore = clamp(onchain.holders ? Math.log10(onchain.holders) * 33 : 35);
  const transferScore = clamp(onchain.transferCount ? Math.log10(onchain.transferCount) * 28 : 35);
  const ageScore = clamp(ageHours < 2 ? 25 : Math.min(85, 35 + Math.log10(ageHours) * 22));

  // 60% onchain / 40% market
  const onchainPart = holderScore * 0.4 + transferScore * 0.3 + ageScore * 0.3;
  const marketPart = liquidityScore * 0.35 + volumeScore * 0.3 + momentumScore * 0.2 + flowScore * 0.15;
  const xowlScore = clamp(onchainPart * 0.6 + marketPart * 0.4);

  const riskScore = clamp(
    (liquidity < 5_000 ? 45 : liquidity < 25_000 ? 25 : 8) +
      (ageHours < 6 ? 25 : ageHours < 48 ? 12 : 0) +
      (onchain.holders != null && onchain.holders < 50 ? 25 : 0) +
      (!onchain.isContract ? 20 : 0) +
      (volume > 0 && liquidity > 0 && volume / liquidity > 40 ? 15 : 0),
  );

  const smartMoneyScore = clamp(flowScore * 0.5 + transferScore * 0.3 + volumeScore * 0.2);

  const decision: Scores["decision"] =
    riskScore >= 65 ? "FILTERED" : xowlScore >= 72 && riskScore < 45 ? "CALL" : xowlScore >= 55 ? "WATCH" : "FILTERED";

  return {
    xowlScore,
    riskScore,
    smartMoneyScore,
    decision,
    factors: [
      { label: "Liquidity", value: liquidityScore },
      { label: "Volume", value: volumeScore },
      { label: "Momentum", value: momentumScore },
      { label: "Smart Money", value: smartMoneyScore },
      { label: "Holder Growth", value: holderScore },
      { label: "Risk", value: riskScore },
    ],
  };
}

export async function askCoasty(prompt: string, system: string): Promise<string> {
  const apiKey = process.env["COASTY_API_KEY"];
  if (!apiKey) return "";
  try {
    const response = await fetch("https://api.coasty.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "coasty-1",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      console.error(`Coasty request failed [${response.status}]: ${await response.text()}`);
      return "";
    }
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("Coasty request error", error);
    return "";
  }
}

export function localReasoning(market: MarketToken, onchain: OnchainSnapshot, scores: Scores) {
  const parts = [
    `${market.symbol} trades on ${market.dexId || "an X Layer DEX"} with ${
      market.liquidityUsd ? `$${Math.round(market.liquidityUsd).toLocaleString()} liquidity` : "unverified liquidity"
    } and ${market.volume24h ? `$${Math.round(market.volume24h).toLocaleString()} 24h volume` : "thin 24h volume"}.`,
    onchain.holders
      ? `Onchain shows ${onchain.holders.toLocaleString()} holders and ${(onchain.transferCount ?? 0).toLocaleString()} transfers.`
      : "Onchain holder data is unavailable, so the onchain weighting is conservative.",
    `Buy pressure is ${
      (market.buys24h ?? 0) > (market.sells24h ?? 0) ? "net positive" : "net negative"
    } over 24h with a ${(market.change24h ?? 0).toFixed(1)}% price move.`,
    scores.decision === "CALL"
      ? "Structure clears the call threshold: quality signal with contained risk."
      : scores.decision === "WATCH"
        ? "Signal is forming but not yet strong enough to call. Monitoring."
        : "Filtered — risk or liquidity structure fails the rug filter.",
  ];
  return parts.join(" ");
}
