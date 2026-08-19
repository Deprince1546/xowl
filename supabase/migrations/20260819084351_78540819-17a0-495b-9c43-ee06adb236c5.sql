ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS call_liquidity numeric,
  ADD COLUMN IF NOT EXISTS current_price numeric,
  ADD COLUMN IF NOT EXISTS current_market_cap numeric,
  ADD COLUMN IF NOT EXISTS ath_price numeric,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS milestones_hit numeric[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS calls_token_address_idx ON public.calls (token_address);
CREATE INDEX IF NOT EXISTS call_snapshots_call_id_idx ON public.call_snapshots (call_id);