import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { X_LAYER } from "@/lib/xlayer";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: never[]) => void) => void;
  removeListener?: (event: string, listener: (...args: never[]) => void) => void;
};

type WalletState = {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  isXLayer: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToXLayer: () => Promise<void>;
  refreshBalance: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { okxwallet?: Eip1193Provider; ethereum?: Eip1193Provider };
  return w.okxwallet ?? w.ethereum ?? null;
}

function hexToNumber(value: unknown) {
  if (typeof value !== "string") return null;
  return Number.parseInt(value, 16);
}

function weiToOkb(hex: unknown) {
  if (typeof hex !== "string") return null;
  const wei = BigInt(hex);
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n) / 10n ** 14n;
  return `${whole}.${frac.toString().padStart(4, "0")}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  const readBalance = useCallback(async (account: string) => {
    const provider = getProvider();
    if (!provider) return;
    try {
      const wei = await provider.request({ method: "eth_getBalance", params: [account, "latest"] });
      setBalance(weiToOkb(wei));
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    const provider = getProvider();
    setHasProvider(Boolean(provider));
    if (!provider) return;

    let active = true;
    void (async () => {
      const accounts = (await provider.request({ method: "eth_accounts" }).catch(() => [])) as string[];
      const current = (await provider.request({ method: "eth_chainId" }).catch(() => null)) as string | null;
      if (!active) return;
      setChainId(hexToNumber(current));
      if (accounts?.[0]) {
        setAddress(accounts[0]);
        void readBalance(accounts[0]);
      }
    })();

    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      const next = accounts?.[0] ?? null;
      setAddress(next);
      setBalance(null);
      if (next) void readBalance(next);
    };
    const onChain = (...args: never[]) => setChainId(hexToNumber(args[0] as unknown as string));

    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [readBalance]);

  const switchToXLayer = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: X_LAYER.chainIdHex }],
      });
    } catch (switchError) {
      const code = (switchError as { code?: number })?.code;
      if (code === 4902 || code === -32603) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: X_LAYER.chainIdHex,
              chainName: X_LAYER.name,
              nativeCurrency: X_LAYER.nativeCurrency,
              rpcUrls: [...X_LAYER.rpcUrls],
              blockExplorerUrls: [...X_LAYER.blockExplorerUrls],
            },
          ],
        });
      } else {
        setError("Could not switch network. Approve the request in your wallet.");
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No EVM wallet detected. Install OKX Wallet to continue.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const next = accounts?.[0] ?? null;
      setAddress(next);
      const current = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(hexToNumber(current));
      if (hexToNumber(current) !== X_LAYER.chainId) await switchToXLayer();
      if (next) await readBalance(next);
    } catch (connectError) {
      setError((connectError as Error)?.message ?? "Wallet connection rejected.");
    } finally {
      setConnecting(false);
    }
  }, [readBalance, switchToXLayer]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address) await readBalance(address);
  }, [address, readBalance]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      balance,
      connecting,
      error,
      hasProvider,
      isXLayer: chainId === X_LAYER.chainId,
      connect,
      disconnect,
      switchToXLayer,
      refreshBalance,
    }),
    [address, chainId, balance, connecting, error, hasProvider, connect, disconnect, switchToXLayer, refreshBalance],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
