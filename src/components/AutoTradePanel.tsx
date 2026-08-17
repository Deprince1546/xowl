import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { createTrade } from "@/lib/xowl.functions";

export function AutoTradePanel({
  tokenAddress,
  symbol,
  entryPrice,
  riskScore,
}: {
  tokenAddress: string;
  symbol: string;
  entryPrice: number | null;
  riskScore: number | null;
}) {
  const { address, isXLayer } = useWallet();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("0.1");
  const [target, setTarget] = useState([3]);
  const [slippage, setSlippage] = useState([5]);

  const mutation = useMutation({
    mutationFn: () =>
      createTrade({
        data: {
          tokenAddress,
          symbol,
          walletAddress: address!,
          amountOkb: Number(amount),
          targetMultiplier: target[0]!,
          maxSlippage: slippage[0]!,
          entryPrice,
        },
      }),
    onSuccess: () => {
      toast.success(`Auto-trade armed for ${symbol}`);
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disabled = !user || !address || !isXLayer || Number(amount) <= 0 || mutation.isPending;

  return (
    <aside className="min-w-0 rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Auto-trade</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Set your size and take-profit target. XOwl monitors the position and flags the exit at your multiplier.
      </p>

      {riskScore != null && riskScore >= 65 && (
        <p className="data mt-4 rounded-md bg-destructive/15 px-3 py-2 text-[11px] text-destructive">
          High risk ({riskScore}). This token failed the rug filter.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <div>
          <Label htmlFor="amount" className="data text-[11px] uppercase tracking-widest text-muted-foreground">
            Amount (OKB)
          </Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="data mt-2"
          />
        </div>

        <div>
          <div className="data flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
            <span>Take profit</span>
            <span className="text-primary">{target[0]}X</span>
          </div>
          <Slider className="mt-3" value={target} onValueChange={setTarget} min={1.5} max={100} step={0.5} />
        </div>

        <div>
          <div className="data flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
            <span>Max slippage</span>
            <span className="text-primary">{slippage[0]}%</span>
          </div>
          <Slider className="mt-3" value={slippage} onValueChange={setSlippage} min={0.5} max={30} step={0.5} />
        </div>

        <Button
          className="data w-full uppercase tracking-widest"
          disabled={disabled}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Arming…" : "Arm auto-trade"}
        </Button>

        {!user && (
          <p className="text-xs text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to save and monitor trades.
          </p>
        )}
        {user && !address && <p className="text-xs text-muted-foreground">Connect your wallet to arm a trade.</p>}
        {address && !isXLayer && <p className="text-xs text-destructive">Switch your wallet to X Layer (196).</p>}
      </div>
    </aside>
  );
}
