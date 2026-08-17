import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { AutoTradePanel } from "@/components/AutoTradePanel";
import { ChangePill } from "@/components/TokenCard";
import { getTokenIntel } from "@/lib/market.functions";
import { explorerToken, formatUsd, shortAddress } from "@/lib/xlayer";

export const Route = createFileRoute("/tokens/$address")({
  head: ({ params }) => ({
    meta: [
      { title: `Token intel ${shortAddress(params.address)} — XOwl` },
      {
        name: "description",
        content: "Onchain-weighted XOwl score, risk breakdown, smart money read and auto-trade setup for this X Layer token.",
      },
      { property: "og:title", content: "XOwl token intel" },
      { property: "og:description", content: "Live X Layer token analysis with AI reasoning and risk scoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TokenPage,
});

function ScoreBar({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <div className="data flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${danger ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function TokenPage() {
  const { address } = Route.useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["token", address],
    queryFn: () => getTokenIntel({ data: { address } }),
    refetchInterval: 60_000,
  });

  const market = data?.market;
  const scores = data?.scores;
  const onchain = data?.onchain;

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {isLoading && <p className="data text-xs text-muted-foreground">Pulling onchain + market data…</p>}
        {isError && <p className="data text-xs text-destructive">Intel unavailable for this token.</p>}
        {!isLoading && !isError && !market && (
          <p className="data text-xs text-muted-foreground">No X Layer pair found for {shortAddress(address, 6)}.</p>
        )}

        {market && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <h1 className="truncate font-display text-3xl font-semibold">{market.symbol}</h1>
                  <p className="truncate text-sm text-muted-foreground">{market.name}</p>
                  <a
                    href={explorerToken(market.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="data mt-2 inline-block text-[11px] text-primary hover:underline"
                  >
                    {shortAddress(market.address, 6)} ↗
                  </a>
                </div>
                <ChangePill value={market.change24h} />
              </div>

              <dl className="data mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Price", formatUsd(market.priceUsd)],
                  ["Market cap", formatUsd(market.marketCap ?? market.fdv)],
                  ["Liquidity", formatUsd(market.liquidityUsd)],
                  ["24h volume", formatUsd(market.volume24h)],
                  ["5m", `${(market.change5m ?? 0).toFixed(1)}%`],
                  ["1h", `${(market.change1h ?? 0).toFixed(1)}%`],
                  ["Buys 24h", market.buys24h ?? "—"],
                  ["Sells 24h", market.sells24h ?? "—"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border border-border p-3">
                    <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm">{value}</dd>
                  </div>
                ))}
              </dl>

              {scores && (
                <div className="mt-8 rounded-lg border border-border bg-card p-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <h2 className="font-display text-lg font-semibold">XOwl score</h2>
                    <span
                      className={`data rounded px-2 py-1 text-[11px] ${
                        scores.decision === "CALL"
                          ? "bg-success/15 text-success"
                          : scores.decision === "WATCH"
                            ? "bg-warning/15 text-warning"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {scores.decision}
                    </span>
                  </div>
                  <p className="data mt-4 text-5xl font-semibold text-primary">{scores.xowlScore}</p>
                  <p className="data mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                    60% onchain · 40% market
                  </p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {scores.factors.map((factor) => (
                      <ScoreBar
                        key={factor.label}
                        label={factor.label}
                        value={factor.value}
                        danger={factor.label === "Risk"}
                      />
                    ))}
                  </div>
                  <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{data?.reasoning}</p>
                  <p className="data mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Reasoning source: {data?.aiSource === "coasty" ? "XOwl AI" : "local model"}
                  </p>
                </div>
              )}

              {onchain && (
                <div className="mt-6 rounded-lg border border-border p-5">
                  <h2 className="font-display text-lg font-semibold">Onchain</h2>
                  <dl className="data mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    {[
                      ["Holders", onchain.holders?.toLocaleString() ?? "n/a"],
                      ["Transfers", onchain.transferCount?.toLocaleString() ?? "n/a"],
                      ["Contract", onchain.isContract ? "verified bytecode" : "no code"],
                      ["Block", onchain.blockNumber?.toLocaleString() ?? "n/a"],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
                        <dd className="mt-1">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            <AutoTradePanel
              tokenAddress={market.address}
              symbol={market.symbol}
              entryPrice={market.priceUsd}
              riskScore={scores?.riskScore ?? null}
            />
          </div>
        )}
      </section>
    </AppShell>
  );
}
