-- Romanian bookmaker odds storage
-- Stores current odds from Betano, Superbet, Casa Pariurilor, Las Vegas etc.
-- Used for comparison against international odds to find value bets

CREATE TABLE IF NOT EXISTS odds_romanian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id) ON DELETE CASCADE,
  bookmaker TEXT NOT NULL,           -- 'superbet', 'casa_pariurilor', 'betano', 'las_vegas'
  market TEXT NOT NULL DEFAULT 'h2h',
  home_odds DECIMAL(8,2),
  draw_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  line DECIMAL(4,2),
  source_event_id TEXT,              -- bookmaker's internal event ID
  source_match_name TEXT,            -- original match name from bookmaker
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fixture_id, bookmaker, market)  -- one row per fixture+bookmaker+market
);

-- Value alerts comparing Romanian vs international odds
CREATE TABLE IF NOT EXISTS odds_value_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id) ON DELETE CASCADE,
  bookmaker TEXT NOT NULL,           -- Romanian bookmaker that has better odds
  selection TEXT NOT NULL,           -- 'home', 'draw', 'away'
  romanian_odds DECIMAL(8,2) NOT NULL,
  international_avg DECIMAL(8,2),
  international_best DECIMAL(8,2),
  edge_pct DECIMAL(5,2),            -- % above international average
  description TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick fixture lookups
CREATE INDEX IF NOT EXISTS idx_odds_romanian_fixture ON odds_romanian(fixture_id);
CREATE INDEX IF NOT EXISTS idx_odds_romanian_bookmaker ON odds_romanian(bookmaker);
CREATE INDEX IF NOT EXISTS idx_odds_value_alerts_fixture ON odds_value_alerts(fixture_id);
CREATE INDEX IF NOT EXISTS idx_odds_value_alerts_unread ON odds_value_alerts(is_read) WHERE is_read = false;

-- RLS policies
ALTER TABLE odds_romanian ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_value_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read odds_romanian" ON odds_romanian FOR SELECT USING (true);
CREATE POLICY "Allow public read odds_value_alerts" ON odds_value_alerts FOR SELECT USING (true);
