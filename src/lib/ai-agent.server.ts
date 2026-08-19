import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { computeCallStats } from "./calls.server";
import { discoverXLayerTokens, fetchOnchain, fetchTokenMarket, scoreToken } from "./market.server";

/**
 * XOwl AI agent: an OpenAI-compatible tool-calling loop wired to XOwl's own
 * backend data tools (OKX Onchain OS + DEX Screener + the calls database).
 * The model must call tools for anything data-dependent — it never browses the web.
 */

const clean = (value?: string) => value?.replace(/[^\x21-\x7e]/g, "");

type Provider = { url: string; key: string; model: string; headers?: Record<string, string> };

function providers(): Provider[] {
  const list: Provider[] = [];
  const openRouter = clean(process.env["OPENROUTER_API_KEY"]);
  const lovable = clean(process.env["LOVABLE_API_KEY"]);
  if (openRouter) {
    list.push({
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: openRouter,
      model: "google/gemini-2.5-flash",
      headers: { "HTTP-Referer": "https://xowl.lovable.app", "X-Title": "XOwl" },
    });
  }
  if (lovable) {
    list.push({ url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovable, model: "google/gemini-3.5-flash" });
  }
  return list;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "analyze_token",
      description:
        "Full XOwl intelligence on one X Layer contract address: metadata, price, market cap, liquidity, volume, holders, 24h transactions, buy/sell flow, unique traders, whale wallets, token age, XOwl score, risk score and decision.",
      parameters: {
        type: "object",
        properties: { address: { type: "string", description: "Token contract address (0x…)" } },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "radar",
      description:
        "Current XOwl memecoin radar: the live X Layer candidate universe with price, market cap, liquidity, volume and momentum. Use for 'strongest new tokens' or market-cap range questions.",
      parameters: {
        type: "object",
        properties: {
          minMarketCap: { type: "number" },
          maxMarketCap: { type: "number" },
          limit: { type: "number", description: "Max tokens to return, default 15" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_calls",
      description:
        "Published XOwl Calls with call price, call market cap, current and ATH multiplier, score, risk and the reason for the call.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          minMultiplier: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "call_performance",
      description: "Real aggregate performance of all XOwl Calls: counts, 2X/5X/10X rates, average/median/max multiplier.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "analyze_token") {
    const address = String(args["address"] ?? "").trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return { error: "Not a valid EVM contract address." };
    const market = await fetchTokenMarket(address);
    if (!market) {
      return {
        found: false,
        note: "No X Layer market data found on OKX Onchain OS or DEX Screener for this address. It may not trade on X Layer (chain 196).",
      };
    }
    const onchain = await fetchOnchain(address);
    const scores = scoreToken(market, onchain);
    return { found: true, chain: "X Layer (196)", market, onchain, scores };
  }

  if (name === "radar") {
    const tokens = await discoverXLayerTokens();
    const min = Number(args["minMarketCap"] ?? 0);
    const max = Number(args["maxMarketCap"] ?? Number.POSITIVE_INFINITY);
    const limit = Math.min(Number(args["limit"] ?? 15) || 15, 50);
    return tokens
      .filter((t) => {
        const cap = t.marketCap ?? t.fdv ?? 0;
        return cap >= min && cap <= max;
      })
      .slice(0, limit);
  }

  if (name === "list_calls") {
    let query = supabaseAdmin
      .from("calls")
      .select(
        "symbol, token_address, decision, xowl_score, risk_score, call_price, call_market_cap, call_liquidity, current_market_cap, current_multiplier, ath_multiplier, reasoning, called_at, status",
      )
      .order("called_at", { ascending: false })
      .limit(Math.min(Number(args["limit"] ?? 25) || 25, 60));
    const symbol = args["symbol"] ? String(args["symbol"]) : null;
    if (symbol) query = query.ilike("symbol", `%${symbol}%`);
    const { data } = await query;
    const min = Number(args["minMultiplier"] ?? 0);
    return (data ?? []).filter((c) => Number(c.current_multiplier ?? 0) >= min || min === 0);
  }

  if (name === "call_performance") return computeCallStats();

  return { error: `Unknown tool ${name}` };
}

const SYSTEM = `You are XOwl AI, the intelligence terminal for XOwl — an X Layer (chain 196) memecoin intelligence platform.

You HAVE live backend data access through your tools: OKX Onchain OS (primary X Layer data), DEX Screener (market data) and XOwl's own calls database.
Rules:
- For any data-dependent question you MUST call the appropriate tool first. Never answer market questions from memory.
- Never say you cannot browse DEX Screener or access market data. Call your tools instead.
- If a user gives a contract address, call analyze_token immediately, then walk through: chain check, metadata, price, market cap, liquidity, volume, holders and concentration, transactions, whale/smart-money flow, liquidity behaviour, token age, momentum, risk and the XOwl Score, ending with a clear CALL / WATCH / FILTERED verdict.
- Report only real numbers returned by tools. If a field is missing, say it is unavailable. Never fabricate prices, caps, holders, calls or performance.
- Never advertise a guaranteed win rate. Only cite performance figures returned by call_performance.
- Be concise, technical and sceptical. Use plain text with short labelled lines, no markdown tables.`;

export async function runXowlAgent(question: string): Promise<{ answer: string; live: boolean; toolsUsed: string[] }> {
  const list = providers();
  const toolsUsed: string[] = [];
  if (list.length === 0) return { answer: "XOwl AI has no reasoning provider configured.", live: false, toolsUsed };

  for (const provider of list) {
    const messages: Record<string, unknown>[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: question },
    ];

    try {
      for (let step = 0; step < 4; step += 1) {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${provider.key}`,
            ...(provider.headers ?? {}),
          },
          body: JSON.stringify({ model: provider.model, max_tokens: 1200, messages, tools: TOOLS }),
        });
        if (!response.ok) {
          console.error(`XOwl AI ${provider.url} -> ${response.status}: ${await response.text()}`);
          break;
        }
        const json = (await response.json()) as {
          choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
        };
        const message = json.choices?.[0]?.message;
        if (!message) break;

        const calls = message.tool_calls ?? [];
        if (calls.length === 0) {
          const content = message.content?.trim();
          if (content) return { answer: content, live: true, toolsUsed };
          break;
        }

        messages.push({ role: "assistant", content: message.content ?? "", tool_calls: calls });
        for (const call of calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            args = {};
          }
          toolsUsed.push(call.function.name);
          const result = await runTool(call.function.name, args).catch((error: Error) => ({ error: error.message }));
          messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result).slice(0, 24_000) });
        }
      }
    } catch (error) {
      console.error("XOwl agent error", error);
    }
  }

  return {
    answer: "XOwl AI could not reach its reasoning provider. The backend data layer is fine — retry in a moment.",
    live: false,
    toolsUsed,
  };
}
