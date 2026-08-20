import crypto from "crypto";

/**
 * OKX Onchain OS / DEX Market API client (server only).
 * Credentials never leave the server: OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE / OKX_PROJECT_ID.
 */
const OKX_HOST = "https://web3.okx.com";
export const X_LAYER_CHAIN_INDEX = "196";

const clean = (value?: string) => (value ?? "").replace(/[^\x21-\x7e]/g, "");

function credentials() {
  return {
    key: clean(process.env["OKX_API_KEY"]),
    secret: clean(process.env["OKX_SECRET_KEY"]),
    passphrase: clean(process.env["OKX_PASSPHRASE"]),
    project: clean(process.env["OKX_PROJECT_ID"]),
  };
}

export function okxConfigured() {
  const c = credentials();
  return Boolean(c.key && c.secret && c.passphrase);
}

type OkxResponse<T> = { code?: string; msg?: string; data?: T };

const memo = new Map<string, { at: number; value: unknown }>();

async function okxRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown, ttl = 20_000): Promise<T | null> {
  const { key, secret, passphrase, project } = credentials();
  if (!key || !secret || !passphrase) return null;

  const cacheKey = `${method} ${path} ${body ? JSON.stringify(body) : ""}`;
  const cached = memo.get(cacheKey);
  if (cached && Date.now() - cached.at < ttl) return cached.value as T;

  const timestamp = new Date().toISOString();
  const payload = body ? JSON.stringify(body) : "";
  const sign = crypto.createHmac("sha256", secret).update(timestamp + method + path + payload).digest("base64");

  try {
    const response = await fetch(`${OKX_HOST}${path}`, {
      method,
      headers: {
        "OK-ACCESS-KEY": key,
        "OK-ACCESS-SIGN": sign,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": passphrase,
        ...(project ? { "OK-ACCESS-PROJECT": project } : {}),
        "content-type": "application/json",
      },
      ...(payload ? { body: payload } : {}),
    });
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 500));
      return okxRequest<T>(path, method, body, ttl);
    }
    if (!response.ok) return null;
    const json = (await response.json()) as OkxResponse<T>;
    if (json.code && json.code !== "0") {
      console.error(`OKX ${path} -> ${json.code} ${json.msg ?? ""}`);
      return null;
    }
    const value = (json.data ?? null) as T | null;
    if (value) memo.set(cacheKey, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("OKX request error", path, error);
    return null;
  }
}

export type OkxPriceInfo = {
  chainIndex: string;
  tokenContractAddress: string;
  price?: string;
  marketCap?: string;
  liquidity?: string;
  holders?: string;
  volume?: string;
  circSupply?: string;
  maxPrice?: string;
  minPrice?: string;
  priceChange5M?: string;
  priceChange1H?: string;
  priceChange4H?: string;
  priceChange24H?: string;
  time?: string;
};

export type OkxTrade = {
  chainIndex: string;
  changedTokenInfo?: { amount?: string; tokenAddress?: string; tokenSymbol?: string }[];
  dexName?: string;
  id?: string;
  isFiltered?: string;
  price?: string;
  time?: string;
  type?: string;
  txHashUrl?: string;
  userAddress?: string;
  volume?: string;
};

export type OkxToken = {
  decimals?: string;
  tokenContractAddress?: string;
  tokenLogoUrl?: string;
  tokenName?: string;
  tokenSymbol?: string;
};

/** Batch market intelligence: price, market cap, liquidity, holders, multi-window price change. */
export async function okxPriceInfo(addresses: string[]): Promise<Map<string, OkxPriceInfo>> {
  const out = new Map<string, OkxPriceInfo>();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  for (let i = 0; i < unique.length; i += 20) {
    const batch = unique.slice(i, i + 20).map((tokenContractAddress) => ({
      chainIndex: X_LAYER_CHAIN_INDEX,
      tokenContractAddress,
    }));
    const rows = await okxRequest<OkxPriceInfo[]>("/api/v5/dex/market/price-info", "POST", batch);
    for (const row of rows ?? []) {
      if (row.tokenContractAddress) out.set(row.tokenContractAddress.toLowerCase(), row);
    }
  }
  return out;
}

/** Recent onchain swaps for a token (used for flow, smart-money and discovery). */
export async function okxTrades(address: string, limit = 100, after?: string): Promise<OkxTrade[]> {
  const rows = await okxRequest<OkxTrade[]>(
    `/api/v5/dex/market/trades?chainIndex=${X_LAYER_CHAIN_INDEX}&tokenContractAddress=${address}&limit=${limit}${
      after ? `&after=${encodeURIComponent(after)}` : ""
    }`,
  );
  return rows ?? [];
}

/** Paged swap history — walks back through the trade feed to widen discovery. */
export async function okxTradeHistory(address: string, pages = 5): Promise<OkxTrade[]> {
  const all: OkxTrade[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < pages; i += 1) {
    const rows = await okxTrades(address, 100, cursor);
    if (rows.length === 0) break;
    all.push(...rows);
    const next = rows[rows.length - 1]?.id;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return all;
}

/** OHLCV candles for live charting. */
export async function okxCandles(address: string, bar = "1H", limit = 100) {
  const rows = await okxRequest<string[][]>(
    `/api/v5/dex/market/candles?chainIndex=${X_LAYER_CHAIN_INDEX}&tokenContractAddress=${address}&bar=${bar}&limit=${limit}`,
    "GET",
    undefined,
    60_000,
  );
  return (rows ?? [])
    .map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[6] ?? row[5] ?? 0),
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time);
}

/** Aggregator-supported (blue-chip / infrastructure) tokens on X Layer — used as an exclusion set. */
export async function okxMajorTokens(): Promise<OkxToken[]> {
  const rows = await okxRequest<OkxToken[]>(
    `/api/v6/dex/aggregator/all-tokens?chainIndex=${X_LAYER_CHAIN_INDEX}`,
    "GET",
    undefined,
    600_000,
  );
  return rows ?? [];
}
