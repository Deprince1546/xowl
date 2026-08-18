import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askXowlAi } from "@/lib/market.functions";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "XOwl AI Terminal — ask the owl about X Layer" },
      {
        name: "description",
        content: "Query XOwl's AI analyst about X Layer memecoins, onchain flow, liquidity structure and risk.",
      },
      { property: "og:title", content: "XOwl AI Terminal" },
      { property: "og:description", content: "Ask XOwl AI about any X Layer token, wallet flow or risk pattern." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://xowl.lovable.app/xowl-logo.jpg" },
      { name: "twitter:image", content: "https://xowl.lovable.app/xowl-logo.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiPage,
});

type Turn = { role: "you" | "xowl"; text: string };

const SUGGESTIONS = [
  "What makes an X Layer memecoin high risk in its first 6 hours?",
  "How should I read buy/sell ratio versus liquidity depth?",
  "Explain a healthy holder distribution for a new token.",
];

function AiPage() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const mutation = useMutation({
    mutationFn: (question: string) => askXowlAi({ data: { question } }),
    onSuccess: (result) => setTurns((t) => [...t, { role: "xowl", text: result.answer }]),
    onError: (error: Error) => setTurns((t) => [...t, { role: "xowl", text: `Error: ${error.message}` }]),
  });

  const send = (question: string) => {
    const value = question.trim();
    if (!value || mutation.isPending) return;
    setTurns((t) => [...t, { role: "you", text: value }]);
    setInput("");
    mutation.mutate(value);
  };

  return (
    <AppShell>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">AI terminal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          XOwl AI answers on X Layer market structure and onchain behaviour. It will say when it lacks data.
        </p>

        <div className="mt-8 min-h-64 rounded-lg border border-border bg-card p-4">
          {turns.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="data text-[11px] uppercase tracking-widest text-muted-foreground">Try asking</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-4">
            {turns.map((turn, i) => (
              <div key={i} className="min-w-0">
                <p className="data text-[10px] uppercase tracking-widest text-muted-foreground">
                  {turn.role === "you" ? "You" : "XOwl AI"}
                </p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
              </div>
            ))}
            {mutation.isPending && <p className="data text-xs text-muted-foreground">XOwl is thinking…</p>}
          </div>
        </div>

        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a token, a pattern, or a risk signal…"
            rows={2}
            className="min-w-0"
          />
          <Button type="submit" disabled={mutation.isPending} className="data uppercase tracking-widest sm:self-end">
            Send
          </Button>
        </form>
      </section>
    </AppShell>
  );
}
