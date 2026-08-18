import { isLikelyMemecoin } from "./memecoin-filter";
import {
  okxCandles,
  okxMajorTokens,
  okxPriceInfo,
  okxTrades,
  okxConfigured,
  type OkxPriceInfo,
  type OkxTrade,
} from "./okx.server";
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
  holders?: number | null;
  txs24h?: number | null;
  source?: "okx" | "gecko";
};

const num = (value: unknown) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : null;
};

/* ------------------------------------------------------------------ *
 * OKX Onchain OS — primary X Layer data infrastructure
 * ------------------------------------------------------------------ */

// Deep-liquidity quote assets: their trade flow is the window into every
// actively traded X Layer memecoin.
const QUOTE_TOKENS = [
  "0xe538905cf8410324e03a5a23c1c177a474d59b2b", // WOKB
  "0x779ded0c9e1022225f8e0630b35a9b54be713736", // USDT
  "0x1e4a5963abfd975d8c9021ce480b42188849d41d", // USDT (bridged)
  "0x74b7f16337b8972027f6196a17a631ac6de26d22", // USDC (bridged)
  "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8", // USDG
  "0x5a77f1443d16ee5761d310e38b62f77f726bc71c", // WETH
];

type Candidate = { address: string; symbol: string; name: string; trades: number; dexName: string };

async function okxMajorAddressSet() {
  const majors = await okxMajorTokens();
  return new Set(majors.map((t) => (t.tokenContractAddress ?? "").toLowerCase()).filter(Boolean));
}

/** Stage 1 — OKX X Layer discovery: harvest tokens from live swap flow. */
async function discoverCandidates(majorAddresses: Set<string>): Promise<Candidate[]> {
  const results = await Promise.allSettled(QUOTE_TOKENS.map((address) => okxTrades(address, 100)));
  const found = new Map<string, Candidate>();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const trade of result.value) {
      for (const leg of trade.changedTokenInfo ?? []) {
        const address = (leg.tokenAddress ?? "").toLowerCase();
        const symbol = leg.tokenSymbol ?? "";
        if (!address) continue;
        // Stage 2 — remove non-memecoins (stables, wrapped/bridged majors, LP + infra tokens)
        if (!isLikelyMemecoin(symbol, symbol, majorAddresses, address)) continue;
        const existing = found.get(address);
        if (existing) existing.trades += 1;
        else
          found.set(address, {
            address,
            symbol,
            name: symbol,
            trades: 1,
            dexName: trade.dexName ?? "",
          });
      }
    }
  }
  return [...found.values()].sort((a, b) => b.trades - a.trades).slice(0, 40);
}

function fromPriceInfo(candidate: Candidate, info: OkxPriceInfo): MarketToken {
  return {
    address: candidate.address,
    symbol: candidate.symbol || "?",
    name: candidate.name || candidate.symbol || "Unknown",
    pairAddress: "",
    dexId: candidate.dexName,
    imageUrl: null,
    priceUsd: num(info.price),
    marketCap: num(info.marketCap),
    fdv: num(info.marketCap),
    liquidityUsd: num(info.liquidity),
    volume24h: num((info as Record<string, unknown>)["volume24H"]),
    change5m: num(info.priceChange5M),
    change1h: num(info.priceChange1H),
    change6h: num(info.priceChange4H),
    change24h: num(info.priceChange24H),
    buys24h: null,
    sells24h: null,
    pairCreatedAt: null,
    url: `https://web3.okx.com/token/x-layer/${candidate.address}`,
    holders: num(info.holders),
    txs24h: num((info as Record<string, unknown>)["txs24H"]),
    source: "okx",
  };
}

/**
 * Discovery pipeline:
 * OKX flow discovery → memecoin filter → liquidity/activity filter → ranked shortlist.
 * The objective is to filter the noise, not to list every X Layer token.
 */
export async function discoverXLayerTokens(): Promise<MarketToken[]> {
  if (okxConfigured()) {
    try {
      const majors = await okxMajorAddressSet();
      const candidates = await discoverCandidates(majors);
      if (candidates.length > 0) {
        const info = await okxPriceInfo(candidates.map((c) => c.address));
        const tokens = candidates
          .map((candidate) => {
            const row = info.get(candidate.address);
            return row ? fromPriceInfo(candidate, row) : null;
          })
          .filter((token): token is MarketToken => Boolean(token))
          // Stage 3 — liquidity / activity filter
          .filter(
            (token) =>
              (token.liquidityUsd ?? 0) >= 2_000 &&
              (token.volume24h ?? 0) >= 1_000 &&
              (token.txs24h ?? 0) >= 20 &&
              (token.priceUsd ?? 0) > 0,
          )
          .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
        if (tokens.length > 0) return tokens;
      }
    } catch (error) {
      console.error("OKX discovery failed, falling back", error);
    }
  }
  return geckoDiscover();
}

export async function fetchTokenMarket(address: string): Promise<MarketToken | null> {
  const target = address.toLowerCase();
  if (okxConfigured()) {
    const info = (await okxPriceInfo([target])).get(target);
    if (info && num(info.price) != null) {
      const trades = await okxTrades(target, 50).catch(() => [] as OkxTrade[]);
      const symbol =
        trades
          .flatMap((t) => t.changedTokenInfo ?? [])
          .find((leg) => (leg.tokenAddress ?? "").toLowerCase() === target)?.tokenSymbol ?? "?";
      const dexName = trades[0]?.dexName ?? "";
      const token = fromPriceInfo({ address: target, symbol, name: symbol, trades: trades.length, dexName }, info);
      const flow = tradeFlow(trades, target);
      token.buys24h = flow.buys;
      token.sells24h = flow.sells;
      return token;
    }
  }
  const discovered = await geckoDiscover().catch(() => []);
  return discovered.find((token) => token.address.toLowerCase() === target) ?? null;
}

/** Recent-flow analytics from real OKX swaps: buy/sell split and unique traders. */
export function tradeFlow(trades: OkxTrade[], address: string) {
  let buys = 0;
  let sells = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  const traders = new Set<string>();
  const whales = new Set<string>();
  for (const trade of trades) {
    const touches = (trade.changedTokenInfo ?? []).some((leg) => (leg.tokenAddress ?? "").toLowerCase() === address);
    if (!touches) continue;
    const volume = Number(trade.volume ?? 0);
    if (trade.type === "buy") {
      buys += 1;
      buyVolume += Number.isFinite(volume) ? volume : 0;
    } else if (trade.type === "sell") {
      sells += 1;
      sellVolume += Number.isFinite(volume) ? volume : 0;
    }
    if (trade.userAddress) {
      traders.add(trade.userAddress.toLowerCase());
      if (Number.isFinite(volume) && volume >= 2_000) whales.add(trade.userAddress.toLowerCase());
    }
  }
  return { buys, sells, buyVolume, sellVolume, uniqueTraders: traders.size, whaleWallets: whales.size };
}

export async function fetchTokenCandles(address: string, bar = "1H") {
  if (!okxConfigured()) return [];
  return okxCandles(address, bar, 96);
}

/* ------------------------------------------------------------------ *
 * GeckoTerminal — secondary fallback only (used when OKX is unavailable)
 * ------------------------------------------------------------------ */

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

const GECKO = `https://api.geckoterminal.com/api/v2/networks/${GECKO_NETWORK}`;
const cache = new Map<string, { at: number; value: MarketToken[] }>();
const TTL = 30_000;

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
    source: "gecko",
  };
}

async function geckoFetch(path: string): Promise<MarketToken[]> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const response = await fetch(`${GECKO}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Market request failed [${response.status}]`);
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

async function geckoDiscover(): Promise<MarketToken[]> {
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
  const majors = new Set<string>();
  return [...merged.values()]
    .filter((token) => isLikelyMemecoin(token.symbol, token.name, majors, token.address))
    .filter((token) => (token.liquidityUsd ?? 0) > 2_000)
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

/* ------------------------------------------------------------------ *
 * Onchain layer (X Layer RPC + OKX flow)
 * ------------------------------------------------------------------ */

async function rpc(method: string, params: unknown[]): Promise<string | null> {
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
  uniqueTraders: number | null;
  whaleWallets: number | null;
  buys: number | null;
  sells: number | null;
  source: "live" | "partial" | "unavailable";
};

export async function fetchOnchain(address: string): Promise<OnchainSnapshot> {
  const [block, code, supply, info, trades] = await Promise.all([
    rpc("eth_blockNumber", []),
    rpc("eth_getCode", [address, "latest"]),
    rpc("eth_call", [{ to: address, data: "0x18160ddd" }, "latest"]),
    okxConfigured() ? okxPriceInfo([address]).then((m) => m.get(address.toLowerCase()) ?? null) : Promise.resolve(null),
    okxConfigured() ? okxTrades(address, 100).catch(() => [] as OkxTrade[]) : Promise.resolve([] as OkxTrade[]),
  ]);

  const flow = tradeFlow(trades, address.toLowerCase());
  const holders = info?.holders ? Number(info.holders) : null;
  const transferCount = (info as Record<string, unknown> | null)?.["txs24H"]
    ? Number((info as Record<string, string>)["txs24H"])
    : null;

  const blockNumber = block ? Number.parseInt(block, 16) : null;
  return {
    blockNumber,
    isContract: Boolean(code && code !== "0x"),
    totalSupply: supply && supply !== "0x" ? BigInt(supply).toString() : null,
    holders,
    transferCount,
    uniqueTraders: flow.uniqueTraders || null,
    whaleWallets: flow.whaleWallets || null,
    buys: flow.buys || null,
    sells: flow.sells || null,
    source: blockNumber ? (holders != null ? "live" : "partial") : "unavailable",
  };
}

/* ------------------------------------------------------------------ *
 * XOwl scoring — 60% onchain / 40% market
 * ------------------------------------------------------------------ */

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
  const buys = market.buys24h ?? onchain.buys ?? 0;
  const sells = market.sells24h ?? onchain.sells ?? 0;
  const ageHours = market.pairCreatedAt ? (Date.now() - market.pairCreatedAt) / 3_600_000 : 0;
  const marketCap = market.marketCap ?? market.fdv ?? 0;

  const liquidityScore = clamp(Math.log10(Math.max(liquidity, 1)) * 20);
  const volumeScore = clamp(Math.log10(Math.max(volume, 1)) * 18);
  const momentumScore = clamp(50 + (market.change24h ?? 0) * 1.2);
  const flowScore = clamp(buys + sells > 0 ? (buys / (buys + sells)) * 130 - 15 : 30);
  const holderScore = clamp(onchain.holders ? Math.log10(onchain.holders) * 33 : 35);
  const transferScore = clamp(onchain.transferCount ? Math.log10(onchain.transferCount) * 28 : 35);
  const whaleScore = clamp(onchain.whaleWallets ? 45 + onchain.whaleWallets * 12 : 35);
  const ageScore = clamp(ageHours < 2 ? 25 : ageHours > 0 ? Math.min(85, 35 + Math.log10(ageHours) * 22) : 50);
  // Low/medium cap upside preference
  const capScore = clamp(marketCap === 0 ? 40 : marketCap < 2_000_000 ? 85 : marketCap < 20_000_000 ? 60 : 30);

  const onchainPart = holderScore * 0.3 + transferScore * 0.25 + whaleScore * 0.2 + ageScore * 0.15 + flowScore * 0.1;
  const marketPart = liquidityScore * 0.3 + volumeScore * 0.3 + momentumScore * 0.2 + capScore * 0.2;
  const xowlScore = clamp(onchainPart * 0.6 + marketPart * 0.4);

  const riskScore = clamp(
    (liquidity < 5_000 ? 45 : liquidity < 25_000 ? 25 : 8) +
      (ageHours > 0 && ageHours < 6 ? 25 : ageHours > 0 && ageHours < 48 ? 12 : 0) +
      (onchain.holders != null && onchain.holders < 50 ? 25 : 0) +
      (!onchain.isContract ? 20 : 0) +
      (volume > 0 && liquidity > 0 && volume / liquidity > 40 ? 15 : 0),
  );

  const smartMoneyScore = clamp(flowScore * 0.4 + whaleScore * 0.3 + transferScore * 0.2 + volumeScore * 0.1);

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

/* ------------------------------------------------------------------ *
 * AI reasoning — OpenRouter primary, Lovable AI fallback
 * ------------------------------------------------------------------ */

export async function askCoasty(prompt: string, system: string): Promise<string> {
  const clean = (value?: string) => value?.replace(/[^\x21-\x7e]/g, "");
  const openRouterKey = clean(process.env["OPENROUTER_API_KEY"]);
  const lovableKey = clean(process.env["LOVABLE_API_KEY"]);

  const targets: { url: string; key: string; model: string; headers?: Record<string, string> }[] = [];
  if (openRouterKey) {
    targets.push({
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: openRouterKey,
      model: "google/gemini-2.5-flash",
      headers: { "HTTP-Referer": "https://xowl.lovable.app", "X-Title": "XOwl" },
    });
  }
  if (lovableKey) {
    targets.push({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: "google/gemini-3.5-flash",
    });
  }

  for (const target of targets) {
    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${target.key}`,
          ...(target.headers ?? {}),
        },
        body: JSON.stringify({
          model: target.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!response.ok) {
        console.error(`AI request failed [${response.status}]: ${await response.text()}`);
        continue;
      }
      const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (error) {
      console.error("AI request error", error);
    }
  }
  return "";
}

export function localReasoning(market: MarketToken, onchain: OnchainSnapshot, scores: Scores) {
  const parts = [
    `${market.symbol} trades on ${market.dexId || "an X Layer DEX"} with ${
      market.liquidityUsd ? `$${Math.round(market.liquidityUsd).toLocaleString()} liquidity` : "unverified liquidity"
    } and ${market.volume24h ? `$${Math.round(market.volume24h).toLocaleString()} 24h volume` : "thin 24h volume"}.`,
    onchain.holders
      ? `Onchain shows ${onchain.holders.toLocaleString()} holders and ${(onchain.transferCount ?? 0).toLocaleString()} 24h transactions.`
      : "Onchain holder data is unavailable, so the onchain weighting is conservative.",
    `Buy pressure is ${
      (market.buys24h ?? onchain.buys ?? 0) > (market.sells24h ?? onchain.sells ?? 0) ? "net positive" : "net negative"
    } across recent swaps with a ${(market.change24h ?? 0).toFixed(1)}% 24h price move.`,
    scores.decision === "CALL"
      ? "Structure clears the call threshold: quality signal with contained risk."
      : scores.decision === "WATCH"
        ? "Signal is forming but not yet strong enough to call. Monitoring."
        : "Filtered — risk or liquidity structure fails the rug filter.",
  ];
  return parts.join(" ");
}
