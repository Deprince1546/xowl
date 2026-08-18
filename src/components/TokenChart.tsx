import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getTokenChart } from "@/lib/market.functions";
import { formatUsd } from "@/lib/xlayer";

const BARS = [
  { id: "5m", label: "5M" },
  { id: "1H", label: "1H" },
  { id: "4H", label: "4H" },
  { id: "1D", label: "1D" },
];

export function TokenChart({ address }: { address: string }) {
  const [bar, setBar] = useState("1H");
  const { data, isLoading } = useQuery({
    queryKey: ["candles", address, bar],
    queryFn: () => getTokenChart({ data: { address, bar } }),
    refetchInterval: 60_000,
  });

  const candles = data ?? [];

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Price</h2>
        <div className="flex gap-1">
          {BARS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setBar(option.id)}
              className={`data rounded px-2 py-1 text-[11px] uppercase tracking-widest ${
                bar === option.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-56 w-full">
        {isLoading && <p className="data text-xs text-muted-foreground">Loading OKX candles…</p>}
        {!isLoading && candles.length === 0 && (
          <p className="data text-xs text-muted-foreground">No candle data available for this token.</p>
        )}
        {candles.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={candles} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="xowlPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(value: number) =>
                  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                minTickGap={40}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                width={62}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(value: number) => formatUsd(value)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(value) => new Date(Number(value)).toLocaleString()}
                formatter={(value: number) => [formatUsd(value), "Price"]}
              />
              <Area type="monotone" dataKey="close" stroke="var(--primary)" strokeWidth={1.6} fill="url(#xowlPrice)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="data mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        Source: OKX Onchain OS · X Layer (196)
      </p>
    </div>
  );
}
