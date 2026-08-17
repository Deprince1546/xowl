-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- tokens
CREATE TABLE public.tokens (
  address TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT,
  pair_address TEXT,
  dex_id TEXT,
  decimals INT DEFAULT 18,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens TO authenticated;
GRANT ALL ON public.tokens TO service_role;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens public read" ON public.tokens FOR SELECT USING (true);

-- calls
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL REFERENCES public.tokens(address) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'CALL',
  xowl_score INT NOT NULL DEFAULT 0,
  risk_score INT NOT NULL DEFAULT 0,
  smart_money_score INT NOT NULL DEFAULT 0,
  confidence INT NOT NULL DEFAULT 0,
  call_price NUMERIC,
  call_market_cap NUMERIC,
  ath_market_cap NUMERIC,
  ath_multiplier NUMERIC DEFAULT 1,
  current_multiplier NUMERIC DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  reasoning TEXT,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.calls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls public read" ON public.calls FOR SELECT USING (true);

-- call snapshots
CREATE TABLE public.call_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  price NUMERIC,
  market_cap NUMERIC,
  multiplier NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX call_snapshots_call_idx ON public.call_snapshots(call_id, captured_at);
GRANT SELECT ON public.call_snapshots TO anon;
GRANT SELECT ON public.call_snapshots TO authenticated;
GRANT ALL ON public.call_snapshots TO service_role;
ALTER TABLE public.call_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots public read" ON public.call_snapshots FOR SELECT USING (true);

-- trades
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  token_address TEXT NOT NULL,
  symbol TEXT NOT NULL,
  wallet_address TEXT,
  amount_okb NUMERIC NOT NULL,
  target_multiplier NUMERIC NOT NULL DEFAULT 2,
  max_slippage NUMERIC NOT NULL DEFAULT 1,
  entry_price NUMERIC,
  exit_price NUMERIC,
  realized_multiplier NUMERIC,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trades" ON public.trades FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- watchlists
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  symbol TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token_address)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist" ON public.watchlists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai reports
CREATE TABLE public.ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  symbol TEXT,
  summary TEXT NOT NULL,
  decision TEXT,
  xowl_score INT,
  risk_score INT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_reports_token_idx ON public.ai_reports(token_address, created_at DESC);
GRANT SELECT ON public.ai_reports TO anon;
GRANT SELECT, INSERT ON public.ai_reports TO authenticated;
GRANT ALL ON public.ai_reports TO service_role;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai reports public read" ON public.ai_reports FOR SELECT USING (true);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER calls_updated BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trades_updated BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profile autocreate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();