/**
 * XOwl is an X Layer MEMECOIN intelligence platform, not a token dashboard.
 * Everything that is a stablecoin, wrapped/bridged major, LP token or
 * protocol/infrastructure asset gets removed before any analysis happens.
 */
export const EXCLUDED_SYMBOLS = new Set(
  [
    "usdt",
    "usdc",
    "usdg",
    "usde",
    "susde",
    "dai",
    "crvusd",
    "pyusd",
    "fdusd",
    "tusd",
    "usdt_bridged",
    "usdc_bridged",
    "usdt.e",
    "usdc.e",
    "okb",
    "wokb",
    "weth",
    "eth",
    "wbtc",
    "btc",
    "wbnb",
    "bnb",
    "sol",
    "wsol",
    "xbtc",
    "xbeth",
    "xoksol",
    "stone",
    "steth",
    "wsteth",
    "reth",
    "quick",
    "fb",
    "dmcx",
  ].map((s) => s.toLowerCase()),
);

const EXCLUDED_PATTERNS = [
  // Tokenized equities / xStocks on X Layer (wTSLAx, SNDKx, wSPCXx…) are not memecoins
  /^w?[A-Za-z]{2,6}x$/,
  /bridged/i,
  /\bLP\b/i,
  /^slp$/i,
  /uni-v[23]/i,
  /pool token/i,
  /liquidity/i,
  /vault/i,
  /stable/i,
  /\bUSD\b/i,
];

const EXCLUDED_NAME_WORDS = [
  "stablecoin",
  "wrapped",
  "bridged",
  "liquidity",
  "lp token",
  "staked",
  "vault",
  "index",
  "governance",
  "protocol token",
  "dollar",
  "bitcoin",
  "ethereum",
  "solana",
];

export function isLikelyMemecoin(symbol: string, name: string, majorAddresses: Set<string>, address: string) {
  const sym = (symbol ?? "").trim();
  const nm = (name ?? "").trim();
  if (!sym || !address) return false;
  if (majorAddresses.has(address.toLowerCase())) return false;
  if (EXCLUDED_SYMBOLS.has(sym.toLowerCase())) return false;
  if (EXCLUDED_PATTERNS.some((re) => re.test(sym))) return false;
  const lowerName = nm.toLowerCase();
  if (EXCLUDED_NAME_WORDS.some((word) => lowerName.includes(word))) return false;
  return true;
}
