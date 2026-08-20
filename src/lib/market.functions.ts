import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runXowlAgent } from "./ai-agent.server";
import {
  askCoasty,
  discoverXLayerTokens,
  fetchOnchain,
  fetchTokenCandles,
  fetchTokenMarket,
  localReasoning,
  scoreToken,
} from "./market.server";

export const getDiscoveryFeed = createServerFn({ method: "GET" }).handler(async () => {
  const tokens = await discoverXLayerTokens();
  return { tokens: tokens.slice(0, 50), fetchedAt: new Date().toISOString() };
});

export const getTokenChart = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ address: z.string().min(4), bar: z.string().min(2).max(4) }).parse(input))
  .handler(async ({ data }) => fetchTokenCandles(data.address, data.bar));


export const getTokenIntel = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ address: z.string().min(4) }).parse(input))
  .handler(async ({ data }) => {
    const market = await fetchTokenMarket(data.address);
    if (!market) return { market: null, onchain: null, scores: null, reasoning: "" };
    const onchain = await fetchOnchain(data.address);
    const scores = scoreToken(market, onchain);
    const fallback = localReasoning(market, onchain, scores);
    const ai = await askCoasty(
      `Token ${market.symbol} (${market.address}) on X Layer.\nMarket: ${JSON.stringify(market)}\nOnchain: ${JSON.stringify(onchain)}\nScores: ${JSON.stringify(scores)}\nExplain the decision in under 120 words.`,
      "You are XOwl AI, an onchain memecoin analyst for X Layer. Be precise, sceptical, and never fabricate data.",
    );
    return { market, onchain, scores, reasoning: ai || fallback, aiSource: ai ? "coasty" : "local" };
  });

export const askXowlAi = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ question: z.string().min(2).max(2000) }).parse(input))
  .handler(async ({ data }) => runXowlAgent(data.question));
