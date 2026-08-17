import { GECKO_NETWORK, X_LAYER } from "./xlayer";

export type MarketToken = {
  address: string;
  symbol: string;
  name: string;
  pairAddress: string;
  dexId: string;
  imageUrl: string | null;
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

type GeckoPool = {
  id?: string;
  attributes?: {
    address?: string;
    name?: string;
    pool_created_at?: string;
    base_token_price_usd?: string;
    fdv_usd?: string;
    market_cap_usd?: string;
    reserve_in_usd?: string;
    price_change_percentage?: Record<string, string>;
    transactions?: Record<string, { buys?: number; sells?: number }>;
    volume_usd?: Record<string, string>;
  };
  relationships?: { base_token?: { data?: { id?: string } }; dex?: { data?: { id?: string } } };
};

type GeckoToken = {
  id?: string;
  attributes?: { address?: string; name?: string; symbol?: string; image_url?: string | null };
};

const num = (value: unknown) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : null;
};

const GECKO = `https://api.geckoterminal.com/api/v2/networks/${GECKO_NETWORK}`;

function mapPool(pool: GeckoPool, tokens: Map<string, GeckoToken>): MarketToken | null {
  const attrs = pool.attributes ?? {};
  const tokenId = pool.relationships?.base_token?.data?.id ?? "";
  const token = tokens.get(tokenId);
  const address = token?.attributes?.address ?? tokenId.split("_")[1] ?? "";
  if (!address) return null;
  const created = attrs.pool_created_at ? Date.parse(attrs.pool_created_at) : null;
  return {
    address,
    symbol: token?.attributes?.symbol ?? attrs.name?.split(" / ")[0] ?? "?",
    name: token?.attributes?.name ?? attrs.name ?? "Unknown",
    imageUrl: token?.attributes?.image_url ?? null,
    pairAddress: attrs.address ?? "",
    dexId: pool.relationships?.dex?.data?.id ?? "",
    priceUsd: num(attrs.base_token_price_usd),
    marketCap: num(attrs.market_cap_usd),
    fdv: num(attrs.fdv_usd),
    liquidityUsd: num(attrs.reserve_in_usd),
    volume24h: num(attrs.volume_usd?.["h24"]),
    change5m: num(attrs.price_change_percentage?.["m5"]),
    change1h: num(attrs.price_change_percentage?.["h1"]),
    change6h: num(attrs.price_change_percentage?.["h6"]),
    change24h: num(attrs.price_change_percentage?.["h24"]),
    buys24h: attrs.transactions?.["h24"]?.buys ?? null,
    sells24h: attrs.transactions?.["h24"]?.sells ?? null,
    pairCreatedAt: Number.isFinite(created) ? created : null,
    url: `https://www.geckoterminal.com/${GECKO_NETWORK}/pools/${attrs.address ?? ""}`,
  };
}

const cache = new Map<string, { at: number; value: MarketToken[] }>();
const TTL = 30_000;

async function geckoFetch(path: string): Promise<MarketToken[]> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const response = await fetch(`${GECKO}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Market request failed [${response.status}]: ${await response.text()}`);
  }
  const json = (await response.json()) as { data?: GeckoPool[] | GeckoPool; included?: GeckoToken[] };
  const pools = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
  const tokens = new Map((json.included ?? []).map((entry) => [entry.id ?? "", entry]));
  const mapped = pools.map((pool) => mapPool(pool, tokens)).filter((token): token is MarketToken => Boolean(token));

  const best = new Map<string, MarketToken>();
  for (const token of mapped) {
    const key = token.address.toLowerCase();
    const existing = best.get(key);
    if (!existing || (token.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)) best.set(key, token);
  }
  const value = [...best.values()];
  cache.set(path, { at: Date.now(), value });
  return value;
}

export async function discoverXLayerTokens(): Promise<MarketToken[]> {
  const results = await Promise.allSettled([
    geckoFetch("/pools?sort=h24_volume_usd_desc&include=base_token&page=1"),
    geckoFetch("/trending_pools?include=base_token&page=1"),
    geckoFetch("/new_pools?include=base_token&page=1"),
  ]);
  const merged = new Map<string, MarketToken>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const token of result.value) {
      const key = token.address.toLowerCase();
      const existing = merged.get(key);
      if (!existing || (token.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)) merged.set(key, token);
    }
  }
  return [...merged.values()]
    .filter((token) => (token.liquidityUsd ?? 0) > 500)
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

export async function fetchTokenMarket(address: string): Promise<MarketToken | null> {
  const tokens = await geckoFetch(`/tokens/${address}/pools?include=base_token`).catch(() => []);
  const match = tokens.find((token) => token.address.toLowerCase() === address.toLowerCase());
  return match ?? tokens[0] ?? null;
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
