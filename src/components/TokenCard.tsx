import { Link } from "@tanstack/react-router";
import { formatUsd } from "@/lib/xlayer";
import type { MarketToken } from "@/lib/market.server";

export function ChangePill({ value }: { value: number | null }) {
  const up = (value ?? 0) >= 0;
  return (
    <span
      className={`data rounded px-1.5 py-0.5 text-[11px] ${
        up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      }`}
    >
      {value == null ? "—" : `${up ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}

export function TokenCard({ token }: { token: MarketToken }) {
  return (
    <Link
      to="/tokens/$address"
      params={{ address: token.address }}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold">{token.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">{token.name}</p>
        </div>
        <ChangePill value={token.change24h} />
      </div>
      <dl className="data grid grid-cols-2 gap-y-1 text-[11px]">
        <dt className="text-muted-foreground">Price</dt>
        <dd className="text-right">{formatUsd(token.priceUsd)}</dd>
        <dt className="text-muted-foreground">MCap</dt>
        <dd className="text-right">{formatUsd(token.marketCap ?? token.fdv)}</dd>
        <dt className="text-muted-foreground">Liquidity</dt>
        <dd className="text-right">{formatUsd(token.liquidityUsd)}</dd>
        <dt className="text-muted-foreground">Vol 24h</dt>
        <dd className="text-right">{formatUsd(token.volume24h)}</dd>
      </dl>
    </Link>
  );
}
