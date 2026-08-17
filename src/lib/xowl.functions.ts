import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { createPublicClient } from "./supabase-public.server";

export const listCalls = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("calls")
    .select("id, token_address, symbol, decision, xowl_score, risk_score, smart_money_score, confidence, call_price, call_market_cap, ath_multiplier, current_multiplier, status, reasoning, called_at")
    .order("called_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getCallHistory = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ callId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: rows, error } = await supabase
      .from("call_snapshots")
      .select("captured_at, price, market_cap, multiplier")
      .eq("call_id", data.callId)
      .order("captured_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const tradeInput = z.object({
  tokenAddress: z.string().min(4),
  symbol: z.string().min(1),
  callId: z.string().uuid().nullable().optional(),
  walletAddress: z.string().min(4),
  amountOkb: z.number().positive().max(1_000_000),
  targetMultiplier: z.number().min(0.5).max(1000),
  maxSlippage: z.number().min(0.1).max(50),
  entryPrice: z.number().nullable().optional(),
});

export const createTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tradeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trades")
      .insert({
        user_id: context.userId,
        call_id: data.callId ?? null,
        token_address: data.tokenAddress,
        symbol: data.symbol,
        wallet_address: data.walletAddress,
        amount_okb: data.amountOkb,
        target_multiplier: data.targetMultiplier,
        max_slippage: data.maxSlippage,
        entry_price: data.entryPrice ?? null,
        status: "MONITORING",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trades")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trades")
      .update({ status: "CANCELLED" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watchlists")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const toggleWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tokenAddress: z.string().min(4), symbol: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("watchlists")
      .select("id")
      .eq("token_address", data.tokenAddress)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("watchlists").delete().eq("id", existing.id);
      return { watching: false };
    }
    await context.supabase
      .from("watchlists")
      .insert({ user_id: context.userId, token_address: data.tokenAddress, symbol: data.symbol });
    return { watching: true };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
