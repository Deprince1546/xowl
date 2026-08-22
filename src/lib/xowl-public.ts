import { supabase } from "@/integrations/supabase/client";

export type PublicCall = {
  id: string;
  token_address: string;
  symbol: string;
  decision: string;
  xowl_score: number | null;
  risk_score: number | null;
  call_price: number | null;
  call_market_cap: number | null;
  current_price: number | null;
  current_market_cap: number | null;
  ath_multiplier: number | null;
  current_multiplier: number | null;
  status: string;
  reasoning: string | null;
  called_at: string;
};

/**
 * Public reads go through the browser/publishable client so they work identically
 * on Lovable and on external hosts (Vercel) without server-only env vars.
 */
export async function fetchCalls(): Promise<PublicCall[]> {
  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, token_address, symbol, decision, xowl_score, risk_score, call_price, call_market_cap, current_price, current_market_cap, ath_multiplier, current_multiplier, status, reasoning, called_at",
    )
    .order("called_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicCall[];
}

export type ScanRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  candidates: number;
  analysed: number;
  filtered_out: number;
  published: number;
  refreshed: number;
  duration_ms: number | null;
  error: string | null;
};

export async function fetchScanRuns(): Promise<ScanRun[]> {
  const { data, error } = await supabase
    .from("scan_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScanRun[];
}

const MIN_SAMPLE = 20;

export function computeStats(calls: PublicCall[]) {
  const peaks = calls
    .map((c) => Number(c.ath_multiplier ?? c.current_multiplier ?? 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const share = (t: number) => (peaks.length ? peaks.filter((v) => v >= t).length / peaks.length : null);
  const mid = Math.floor(peaks.length / 2);
  return {
    totalCalls: calls.length,
    tracked: peaks.length,
    winners: peaks.filter((v) => v >= 2).length,
    rate2x: share(2),
    rate5x: share(5),
    rate10x: share(10),
    medianMultiplier: peaks.length ? (peaks.length % 2 ? peaks[mid]! : (peaks[mid - 1]! + peaks[mid]!) / 2) : null,
    maxMultiplier: peaks.length ? Math.max(...peaks) : null,
    sufficientData: peaks.length >= MIN_SAMPLE,
  };
}
