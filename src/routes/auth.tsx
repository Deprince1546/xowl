import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — XOwl" },
      { name: "description", content: "Sign in to XOwl to save calls, arm auto-trades and track your X Layer portfolio." },
      { property: "og:title", content: "Sign in — XOwl" },
      { property: "og:description", content: "Access your XOwl portfolio, watchlist and auto-trade controls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/portfolio" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/portfolio` },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/portfolio" });
  };

  return (
    <AppShell>
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Save watchlists, arm auto-trades and track performance.</p>

        <Button variant="outline" className="data mt-8 w-full uppercase tracking-widest" onClick={() => void google()}>
          Continue with Google
        </Button>

        <div className="data my-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">or</div>

        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div>
            <Label htmlFor="email" className="data text-[11px] uppercase tracking-widest text-muted-foreground">
              Email
            </Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
          </div>
          <div>
            <Label htmlFor="password" className="data text-[11px] uppercase tracking-widest text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
            />
          </div>
          <Button type="submit" disabled={busy} className="data w-full uppercase tracking-widest">
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </AppShell>
  );
}
