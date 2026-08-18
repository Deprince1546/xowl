import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { WalletButton } from "@/components/WalletButton";

const XOWL_LOGO = "/xowl-logo.jpg";

const NAV = [
  { to: "/", label: "Radar" },
  { to: "/calls", label: "Calls" },
  { to: "/ai", label: "AI Terminal" },
  { to: "/portfolio", label: "Portfolio" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:flex sm:justify-between sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={XOWL_LOGO}
              alt="XOwl logo"
              className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
            />
            <span className="truncate font-display text-lg font-semibold tracking-[0.2em]">XOWL</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "text-primary bg-secondary" }}
                className="data rounded-md px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <WalletButton />
            </div>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              className="rounded-md border border-border p-2 md:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="data rounded-md px-3 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex justify-start sm:hidden">
              <WalletButton />
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="mt-20 border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="data uppercase tracking-[0.18em]">XOwl · X Layer chain 196</p>
          <p>Analytics only. Nothing here is financial advice. Trade at your own risk.</p>
        </div>
      </footer>
    </div>
  );
}
