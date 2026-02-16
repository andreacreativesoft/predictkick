-- 010_live_tracking.sql

CREATE TABLE live_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES bets(id),
  fixture_id UUID REFERENCES fixtures(id),
  user_id UUID NOT NULL,
  current_score_home INTEGER DEFAULT 0,
  current_score_away INTEGER DEFAULT 0,
  match_minute INTEGER DEFAULT 0,
  match_status TEXT DEFAULT 'not_started',
  current_live_odds DECIMAL(8,2),
  position_value DECIMAL(10,2),
  unrealized_pnl DECIMAL(10,2),
  hedge_recommended BOOLEAN DEFAULT false,
  hedge_reason TEXT,
  hedge_details JSONB,
  cashout_available BOOLEAN DEFAULT false,
  cashout_value DECIMAL(10,2),
  cashout_vs_hold TEXT,
  alerts_sent JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id),
  minute INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  team_id UUID REFERENCES teams(id),
  player_id UUID REFERENCES players(id),
  description TEXT,
  impact TEXT,
  source TEXT DEFAULT 'api',
  prediction_shift JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_events_fixture ON live_events(fixture_id);
