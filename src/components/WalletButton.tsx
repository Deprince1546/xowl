import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { shortAddress } from "@/lib/xlayer";

export function WalletButton() {
  const { address, balance, connect, disconnect, connecting, isXLayer, switchToXLayer, error, hasProvider } =
    useWallet();

  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" onClick={() => void connect()} disabled={connecting} className="data uppercase tracking-widest">
          {connecting ? "Connecting" : "Connect wallet"}
        </Button>
        {!hasProvider && (
          <a
            href="https://www.okx.com/web3"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-muted-foreground underline"
          >
            Get OKX Wallet
          </a>
        )}
        {error && <span className="max-w-48 text-right text-[10px] text-destructive">{error}</span>}
      </div>
    );
  }

  if (!isXLayer) {
    return (
      <Button size="sm" variant="destructive" onClick={() => void switchToXLayer()} className="data uppercase">
        Switch to X Layer
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={disconnect}
      title="Disconnect"
      className="data flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:border-primary/60"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
      <span className="truncate">{shortAddress(address)}</span>
      {balance && <span className="text-muted-foreground">{balance} OKB</span>}
    </button>
  );
}
