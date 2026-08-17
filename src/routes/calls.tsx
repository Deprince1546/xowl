import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { listCalls } from "@/lib/xowl.functions";
import { formatMultiplier, formatUsd } from "@/lib/xlayer";

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "XOwl Calls — transparent X Layer call history" },
      {
        name: "description",
        content:
          "Every XOwl call on X Layer with entry price, peak multiplier, current performance and the AI reasoning behind it.",
      },
      { property: "og:title", content: "XOwl Calls — transparent X Layer call history" },
      {
        property: "og:description",
        content: "Wins and losses, permanently recorded. See how XOwl's AI scored each X Layer memecoin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallsPage,
});

const decisionStyle: Record<string, string> = {
  CALL: "bg-success/15 text-success",
  WATCH: "bg-warning/15 text-warning",
  FILTERED: "bg-destructive/15 text-destructive",
};

function CallsPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["calls"], queryFn: () => listCalls() });
  const calls = data ?? [];

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">Call history</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Immutable record of every XOwl signal. Nothing is deleted — losing calls stay published alongside the wins.
        </p>

        {isLoading && <p className="data mt-10 text-xs text-muted-foreground">Loading calls…</p>}
        {isError && <p className="data mt-10 text-xs text-destructive">Could not load the call history.</p>}
        {!isLoading && !isError && calls.length === 0 && (
          <div className="mt-10 rounded-lg border border-dashed border-border p-10 text-center">
            <p className="data text-xs uppercase tracking-widest text-muted-foreground">No calls published yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The scanner publishes a call as soon as a token clears the score and risk thresholds.
            </p>
          </div>
        )}

        {calls.length > 0 && (
          <div className="mt-8 overflow-x-auto rounded-lg border border-border">
            <table className="data w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Risk</th>
                  <th className="px-4 py-3 text-right">Entry</th>
                  <th className="px-4 py-3 text-right">Peak</th>
                  <th className="px-4 py-3 text-right">Now</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <Link
                        to="/tokens/$address"
                        params={{ address: call.token_address }}
                        className="text-primary hover:underline"
                      >
                        {call.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 ${decisionStyle[call.decision] ?? "bg-secondary"}`}>
                        {call.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{call.xowl_score ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{call.risk_score ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(call.call_price)}</td>
                    <td className="px-4 py-3 text-right text-success">{formatMultiplier(call.ath_multiplier)}</td>
                    <td className="px-4 py-3 text-right">{formatMultiplier(call.current_multiplier)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
