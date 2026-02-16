-- 007_odds.sql

CREATE TABLE odds_current (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id),
  market TEXT NOT NULL,
  best_home_odds DECIMAL(8,2),
  best_home_bookmaker TEXT,
  best_draw_odds DECIMAL(8,2),
  best_draw_bookmaker TEXT,
  best_away_odds DECIMAL(8,2),
  best_away_bookmaker TEXT,
  avg_home_odds DECIMAL(8,2),
  avg_draw_odds DECIMAL(8,2),
  avg_away_odds DECIMAL(8,2),
  line DECIMAL(4,2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fixture_id, market, line)
);

CREATE TABLE odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id),
  bookmaker TEXT NOT NULL,
  market TEXT NOT NULL,
  home_odds DECIMAL(8,2),
  draw_odds DECIMAL(8,2),
  away_odds DECIMAL(8,2),
  line DECIMAL(4,2),
  is_live BOOLEAN DEFAULT false,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_odds_hist_fixture ON odds_history(fixture_id);
CREATE INDEX idx_odds_hist_time ON odds_history(snapshot_at);

CREATE TABLE odds_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id),
  alert_type TEXT NOT NULL,
  market TEXT NOT NULL,
  description TEXT,
  old_odds DECIMAL(8,2),
  new_odds DECIMAL(8,2),
  bookmaker TEXT,
  implied_prob_change DECIMAL(5,2),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
