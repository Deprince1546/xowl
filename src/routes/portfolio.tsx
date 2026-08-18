import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { cancelTrade, listTrades, listWatchlist } from "@/lib/xowl.functions";
import { formatUsd, shortAddress } from "@/lib/xlayer";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — XOwl" },
      { name: "description", content: "Track your armed X Layer auto-trades, watchlist and wallet balance in XOwl." },
      { property: "og:title", content: "Portfolio — XOwl" },
      { property: "og:description", content: "Your X Layer trades, targets and watchlist in one terminal." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://xowl.lovable.app/xowl-logo.jpg" },
      { name: "twitter:image", content: "https://xowl.lovable.app/xowl-logo.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { address, balance } = useWallet();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const trades = useQuery({ queryKey: ["trades"], queryFn: () => listTrades(), enabled: Boolean(user) });
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: () => listWatchlist(), enabled: Boolean(user) });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelTrade({ data: { id } }),
    onSuccess: () => {
      toast.success("Trade cancelled");
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return <AppShell><section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" /></AppShell>;

  const rows = trades.data ?? [];

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold">Portfolio</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="data shrink-0 rounded-md border border-border px-3 py-2 text-right text-xs">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Wallet</p>
            <p className="mt-1">{address ? shortAddress(address) : "not connected"}</p>
            {balance && <p className="text-muted-foreground">{balance} OKB</p>}
          </div>
        </div>

        <h2 className="mt-10 font-display text-lg font-semibold">Armed trades</h2>
        {trades.isLoading && <p className="data mt-4 text-xs text-muted-foreground">Loading trades…</p>}
        {!trades.isLoading && rows.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No trades armed yet. Open a token from the{" "}
            <Link to="/" className="text-primary hover:underline">
              radar
            </Link>{" "}
            to set one up.
          </div>
        )}
        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="data w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-right">Slippage</th>
                  <th className="px-4 py-3 text-right">Entry</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((trade) => (
                  <tr key={trade.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/tokens/$address"
                        params={{ address: trade.token_address }}
                        className="text-primary hover:underline"
                      >
                        {trade.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">{trade.amount_okb} OKB</td>
                    <td className="px-4 py-3 text-right">{trade.target_multiplier}X</td>
                    <td className="px-4 py-3 text-right">{trade.max_slippage}%</td>
                    <td className="px-4 py-3 text-right">{formatUsd(trade.entry_price)}</td>
                    <td className="px-4 py-3">{trade.status}</td>
                    <td className="px-4 py-3 text-right">
                      {trade.status === "MONITORING" && (
                        <Button size="sm" variant="ghost" onClick={() => cancel.mutate(trade.id)}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mt-12 font-display text-lg font-semibold">Watchlist</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(watchlist.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing on the watchlist yet.</p>
          )}
          {(watchlist.data ?? []).map((item) => (
            <Link
              key={item.id}
              to="/tokens/$address"
              params={{ address: item.token_address }}
              className="data rounded-md border border-border px-3 py-2 text-xs hover:border-primary/60"
            >
              {item.symbol}
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
