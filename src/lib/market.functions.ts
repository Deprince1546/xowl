import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  askCoasty,
  discoverXLayerTokens,
  fetchOnchain,
  fetchTokenMarket,
  localReasoning,
  scoreToken,
} from "./market.server";

export const getDiscoveryFeed = createServerFn({ method: "GET" }).handler(async () => {
  const tokens = await discoverXLayerTokens();
  return { tokens: tokens.slice(0, 24), fetchedAt: new Date().toISOString() };
});

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
  .handler(async ({ data }) => {
    const answer = await askCoasty(
      data.question,
      "You are XOwl AI, an X Layer memecoin intelligence terminal. Only discuss X Layer (chain 196) tokens, onchain behaviour, risk and market structure. If you lack data, say so.",
    );
    return {
      answer:
        answer ||
        "XOwl AI is not reachable right now, so no analysis was generated. Verify the Coasty API key and try again.",
      live: Boolean(answer),
    };
  });
