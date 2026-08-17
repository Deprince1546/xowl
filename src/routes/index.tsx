import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Radar } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ChangePill, TokenCard } from "@/components/TokenCard";
import { Button } from "@/components/ui/button";
import { getDiscoveryFeed } from "@/lib/market.functions";
import { formatUsd } from "@/lib/xlayer";
import logoAsset from "@/assets/xowl-logo.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XOwl — AI memecoin intelligence for X Layer" },
      {
        name: "description",
        content:
          "XOwl scans X Layer (chain 196) memecoins in real time, scores them with onchain-weighted AI and surfaces high-conviction calls.",
      },
      { property: "og:title", content: "XOwl — AI memecoin intelligence for X Layer" },
      {
        property: "og:description",
        content: "Live X Layer token radar, AI scoring, transparent call history and auto-trade controls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["discovery"],
    queryFn: () => getDiscoveryFeed(),
    refetchInterval: 60_000,
  });

  const tokens = data?.tokens ?? [];
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (tokens.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % Math.min(tokens.length, 10)), 5000);
    return () => clearInterval(id);
  }, [tokens.length]);

  const featured = tokens[slide];

  return (
    <AppShell>
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-20 bg-black">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={HERO_POSTER}
            className="h-full w-full object-cover object-center"
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        </div>
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 45%, rgba(0,0,0,0.55) 100%), linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.85) 100%)",
          }}
        />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:py-24">

          <div className="min-w-0">
            <span className="data inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-primary">
              <Radar className="h-3 w-3" /> X Layer · chain 196
            </span>
            <h1 className="mt-6 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              The owl watches every X Layer memecoin.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              XOwl streams live pairs, weights onchain behaviour over hype at 60/40, filters rugs and publishes every
              call with its full history — winners and losers alike.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/calls">
                <Button className="data uppercase tracking-widest">
                  View calls <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/ai">
                <Button variant="outline" className="data uppercase tracking-widest">
                  Open AI terminal
                </Button>
              </Link>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-border bg-card p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <p className="data truncate text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Live radar slideshow
              </p>
              <img src={logoAsset.url} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover opacity-80" />
            </div>

            {isLoading && <p className="data mt-8 text-xs text-muted-foreground">Scanning X Layer pairs…</p>}
            {isError && <p className="data mt-8 text-xs text-destructive">Radar feed unavailable right now.</p>}
            {!isLoading && !isError && !featured && (
              <p className="data mt-8 text-xs text-muted-foreground">No live X Layer pairs matched the filter.</p>
            )}

            {featured && (
              <div className="mt-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-3xl font-semibold">{featured.symbol}</p>
                    <p className="truncate text-xs text-muted-foreground">{featured.name}</p>
                  </div>
                  <ChangePill value={featured.change24h} />
                </div>
                <dl className="data mt-6 grid grid-cols-2 gap-3 text-xs">
                  {[
                    ["Price", formatUsd(featured.priceUsd)],
                    ["Market cap", formatUsd(featured.marketCap ?? featured.fdv)],
                    ["Liquidity", formatUsd(featured.liquidityUsd)],
                    ["24h volume", formatUsd(featured.volume24h)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border p-3">
                      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  to="/tokens/$address"
                  params={{ address: featured.address }}
                  className="data mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary hover:underline"
                >
                  Full intel <ArrowRight className="h-3 w-3" />
                </Link>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {tokens.slice(0, 10).map((t, i) => (
                    <button
                      key={t.address}
                      type="button"
                      aria-label={`Show ${t.symbol}`}
                      onClick={() => setSlide(i)}
                      className={`h-1 w-6 rounded-full transition-colors ${i === slide ? "bg-primary" : "bg-border"}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold">Live X Layer radar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ranked by 24h volume, refreshed every minute.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tokens.slice(0, 12).map((token) => (
            <TokenCard key={token.address} token={token} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
