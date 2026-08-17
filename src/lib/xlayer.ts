export const X_LAYER = {
  chainId: 196,
  chainIdHex: "0xc4",
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: ["https://rpc.xlayer.tech", "https://xlayerrpc.okx.com"],
  blockExplorerUrls: ["https://www.oklink.com/xlayer"],
} as const;

export const GECKO_NETWORK = "x-layer";

export function shortAddress(address?: string | null, size = 4) {
  if (!address) return "";
  return `${address.slice(0, 2 + size)}...${address.slice(-size)}`;
}

export function formatUsd(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3)}`;
}

export function formatMultiplier(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(2)}X`;
}

export function explorerToken(address: string) {
  return `https://www.oklink.com/xlayer/token/${address}`;
}
