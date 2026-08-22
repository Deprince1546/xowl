import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  discoverXLayerTokens,
  fetchOnchain,
  fetchTokenMarket,
  localReasoning,
  scoreToken,
  type MarketToken,
} from "./market.server";

const MILESTONES = [2, 5, 10, 25, 50, 100];

type CallRow = {
  id: string;
  token_address: string;
  symbol: string;
  call_price: number | null;
  call_market_cap: number | null;
  ath_multiplier: number | null;
  ath_price: number | null;
  ath_market_cap: number | null;
  milestones_hit: number[] | null;
  status: string;
};

/**
 * Radar scan cycle: discover the ~50 candidate universe, deep-analyse the strongest
 * shortlist, publish 5–10 real calls and refresh performance on every open call.
 */
export async function runScanCycle(limit = 10) {
  const startedAt = Date.now();
  const { data: run } = await supabaseAdmin
    .from("scan_runs")
    .insert({ status: "RUNNING" })
    .select("id")
    .single();
  const runId = run?.id ?? null;
  const finish = async (fields: Record<string, unknown>) => {
    if (!runId) return;
    await supabaseAdmin
      .from("scan_runs")
      .update({ finished_at: new Date().toISOString(), duration_ms: Date.now() - startedAt, ...fields })
      .eq("id", runId);
  };

  try {
    return await scanCycleInner(limit, finish);
  } catch (error) {
    await finish({ status: "FAILED", error: (error as Error).message });
    throw error;
  }
}

async function scanCycleInner(
  limit: number,
  finish: (fields: Record<string, unknown>) => Promise<void>,
) {
  const universe = await discoverXLayerTokens();
  // Shortlist: best radar candidates get the expensive onchain + AI pass.
  const shortlist = universe.slice(0, 18);

  const analysed: { market: MarketToken; scores: ReturnType<typeof scoreToken>; reasoning: string }[] = [];
  for (const token of shortlist) {
    try {
      const onchain = await fetchOnchain(token.address);
      const scores = scoreToken(token, onchain);
      analysed.push({ market: token, scores, reasoning: localReasoning(token, onchain, scores) });
    } catch (error) {
      console.error("scan analysis failed", token.address, error);
    }
  }

  const winners = analysed
    .filter((row) => row.scores.decision !== "FILTERED")
    .sort((a, b) => b.scores.xowlScore - a.scores.xowlScore)
    .slice(0, limit);

  let published = 0;
  for (const row of winners) {
    const { data: existing } = await supabaseAdmin
      .from("calls")
      .select("id")
      .eq("token_address", row.market.address)
      .maybeSingle();
    if (existing) continue;

    await supabaseAdmin.from("tokens").upsert(
      {
        address: row.market.address,
        symbol: row.market.symbol,
        name: row.market.name,
        dex_id: row.market.dexId || null,
        pair_address: row.market.pairAddress || null,
      },
      { onConflict: "address" },
    );

    const { error } = await supabaseAdmin.from("calls").insert({
      token_address: row.market.address,
      symbol: row.market.symbol,
      decision: row.scores.decision,
      xowl_score: row.scores.xowlScore,
      risk_score: row.scores.riskScore,
      smart_money_score: row.scores.smartMoneyScore,
      confidence: row.scores.xowlScore,
      call_price: row.market.priceUsd,
      call_market_cap: row.market.marketCap ?? row.market.fdv,
      call_liquidity: row.market.liquidityUsd,
      current_price: row.market.priceUsd,
      current_market_cap: row.market.marketCap ?? row.market.fdv,
      ath_price: row.market.priceUsd,
      ath_market_cap: row.market.marketCap ?? row.market.fdv,
      ath_multiplier: 1,
      current_multiplier: 1,
      status: "OPEN",
      reasoning: row.reasoning,
      last_checked_at: new Date().toISOString(),
    });
    if (error) console.error("call insert failed", error.message);
    else published += 1;
  }

  const refreshed = await refreshCallPerformance();
  await finish({
    status: "OK",
    candidates: universe.length,
    analysed: analysed.length,
    filtered_out: Math.max(analysed.length - winners.length, 0),
    published,
    refreshed,
  });
  return { universe: universe.length, analysed: analysed.length, published, refreshed };
}

/** Permanent monitoring: snapshot every open call, update ATH, fire milestone notifications. */
export async function refreshCallPerformance() {
  const { data: calls } = await supabaseAdmin
    .from("calls")
    .select("id, token_address, symbol, call_price, call_market_cap, ath_multiplier, ath_price, ath_market_cap, milestones_hit, status")
    .neq("status", "CLOSED")
    .order("called_at", { ascending: false })
    .limit(60);

  let updated = 0;
  for (const call of (calls ?? []) as CallRow[]) {
    const market = await fetchTokenMarket(call.token_address).catch(() => null);
    if (!market || !market.priceUsd) continue;

    const base = call.call_price ?? market.priceUsd;
    const multiplier = base > 0 ? market.priceUsd / base : 1;
    const marketCap = market.marketCap ?? market.fdv ?? null;
    const athMultiplier = Math.max(call.ath_multiplier ?? 1, multiplier);
    const isNewAth = athMultiplier > (call.ath_multiplier ?? 1) + 0.0001;

    await supabaseAdmin.from("call_snapshots").insert({
      call_id: call.id,
      price: market.priceUsd,
      market_cap: marketCap,
      multiplier,
    });

    const hit = new Set<number>(call.milestones_hit ?? []);
    const newMilestones = MILESTONES.filter((m) => multiplier >= m && !hit.has(m));
    for (const m of newMilestones) hit.add(m);

    await supabaseAdmin
      .from("calls")
      .update({
        current_price: market.priceUsd,
        current_market_cap: marketCap,
        current_multiplier: multiplier,
        ath_multiplier: athMultiplier,
        ath_price: Math.max(call.ath_price ?? 0, market.priceUsd),
        ath_market_cap: Math.max(call.ath_market_cap ?? 0, marketCap ?? 0) || null,
        milestones_hit: [...hit].sort((a, b) => a - b),
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", call.id);
    updated += 1;

    if (newMilestones.length > 0 || isNewAth) {
      const best = newMilestones[newMilestones.length - 1];
      await notifyWatchers(
        call,
        best
          ? `XOWL CALL UPDATE — ${call.symbol}`
          : `NEW ATH — ${call.symbol}`,
        best
          ? `Called at ${fmtUsd(call.call_market_cap)} market cap. Now ${fmtUsd(marketCap)}. +${best}X since XOwl Call.`
          : `${call.symbol} printed a new ATH at ${athMultiplier.toFixed(2)}X since the XOwl Call.`,
      );
    }
  }
  return updated;
}

const fmtUsd = (value: number | null) =>
  value == null ? "n/a" : value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : `$${Math.round(value).toLocaleString()}`;

/** Notify only users who follow (watchlist) the token behind the call. */
async function notifyWatchers(call: CallRow, title: string, body: string) {
  const { data: watchers } = await supabaseAdmin
    .from("watchlists")
    .select("user_id")
    .eq("token_address", call.token_address);
  const userIds = [...new Set((watchers ?? []).map((w) => w.user_id))];
  if (userIds.length === 0) return;
  await supabaseAdmin
    .from("notifications")
    .insert(userIds.map((user_id) => ({ user_id, call_id: call.id, title, body })));
}

export type CallStats = {
  totalCalls: number;
  tracked: number;
  winners: number;
  losers: number;
  rate2x: number | null;
  rate5x: number | null;
  rate10x: number | null;
  averageMultiplier: number | null;
  medianMultiplier: number | null;
  maxMultiplier: number | null;
  hitRate: number | null;
  sufficientData: boolean;
};

const MIN_SAMPLE = 20;

/** Real historical performance only — nothing is displayed until the sample is big enough. */
export async function computeCallStats(): Promise<CallStats> {
  const { data } = await supabaseAdmin.from("calls").select("ath_multiplier, current_multiplier");
  const rows = data ?? [];
  const peaks = rows.map((r) => Number(r.ath_multiplier ?? r.current_multiplier ?? 0)).filter((v) => v > 0);
  const total = rows.length;
  if (peaks.length === 0) {
    return {
      totalCalls: total,
      tracked: 0,
      winners: 0,
      losers: 0,
      rate2x: null,
      rate5x: null,
      rate10x: null,
      averageMultiplier: null,
      medianMultiplier: null,
      maxMultiplier: null,
      hitRate: null,
      sufficientData: false,
    };
  }
  const sorted = [...peaks].sort((a, b) => a - b);
  const share = (threshold: number) => peaks.filter((v) => v >= threshold).length / peaks.length;
  const mid = Math.floor(sorted.length / 2);
  return {
    totalCalls: total,
    tracked: peaks.length,
    winners: peaks.filter((v) => v >= 2).length,
    losers: peaks.filter((v) => v < 1).length,
    rate2x: share(2),
    rate5x: share(5),
    rate10x: share(10),
    averageMultiplier: peaks.reduce((a, b) => a + b, 0) / peaks.length,
    medianMultiplier: sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2,
    maxMultiplier: Math.max(...peaks),
    hitRate: share(2),
    sufficientData: peaks.length >= MIN_SAMPLE,
  };
}
