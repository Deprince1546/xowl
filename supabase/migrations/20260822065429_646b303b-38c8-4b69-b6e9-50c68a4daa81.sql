CREATE TABLE public.scan_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  candidates INTEGER NOT NULL DEFAULT 0,
  analysed INTEGER NOT NULL DEFAULT 0,
  filtered_out INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  refreshed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error TEXT
);
GRANT SELECT ON public.scan_runs TO anon;
GRANT SELECT ON public.scan_runs TO authenticated;
GRANT ALL ON public.scan_runs TO service_role;
ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan runs public read" ON public.scan_runs FOR SELECT USING (true);
CREATE INDEX scan_runs_started_at_idx ON public.scan_runs (started_at DESC);