-- 014_accumulators.sql

-- Dominant team profiles (refreshed daily)
CREATE TABLE dominant_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  league_id UUID REFERENCES leagues(id),
  season TEXT NOT NULL,
  dominance_level TEXT NOT NULL, -- 'ultra', 'strong', 'moderate'
  dominance_score DECIMAL(5,2),
  win_rate DECIMAL(5,2),
  ppg DECIMAL(4,2),
  goal_difference INTEGER,
  home_win_rate DECIMAL(5,2),
  away_win_rate DECIMAL(5,2),
  loss_rate DECIMAL(5,2),
  avg_goals_scored DECIMAL(4,2),
  avg_goals_conceded DECIMAL(4,2),
  clean_sheet_pct DECIMAL(5,2),
  form_score DECIMAL(3,2),
  min_odds_threshold DECIMAL(4,2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, season)
);

-- Daily accumulator picks
CREATE TABLE accumulator_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id),
  team_id UUID REFERENCES teams(id),
  match_date DATE NOT NULL,
  is_home BOOLEAN,
  dominance_score DECIMAL(5,2),
  safety_score DECIMAL(5,2),
  recommended_market TEXT NOT NULL,
  min_odds_threshold DECIMAL(4,2),
  current_odds DECIMAL(8,2),
  is_value BOOLEAN DEFAULT false,
  risk_factors JSONB DEFAULT '[]',
  confidence TEXT NOT NULL, -- 'very_high', 'high', 'medium'
  result TEXT, -- 'won', 'lost', 'void', null (pending)
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_acca_picks_date ON accumulator_picks(match_date);
CREATE INDEX idx_acca_picks_result ON accumulator_picks(result);

-- Built accumulator combos
CREATE TABLE accumulator_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  combo_date DATE NOT NULL,
  picks JSONB NOT NULL, -- array of pick IDs and details
  total_odds DECIMAL(10,4),
  expected_win_rate DECIMAL(5,4),
  expected_value DECIMAL(6,4),
  legs INTEGER NOT NULL,
  risk_level TEXT NOT NULL, -- 'conservative', 'moderate', 'aggressive'
  suggested_stake_pct DECIMAL(4,2),
  status TEXT DEFAULT 'pending', -- 'pending', 'won', 'lost', 'partial', 'void'
  actual_return DECIMAL(10,2),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_acca_combos_date ON accumulator_combos(combo_date);
CREATE INDEX idx_acca_combos_status ON accumulator_combos(status);

-- Season accumulator performance tracking
CREATE TABLE accumulator_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  avg_legs DECIMAL(3,1),
  total_combos INTEGER DEFAULT 0,
  won_combos INTEGER DEFAULT 0,
  lost_combos INTEGER DEFAULT 0,
  total_staked DECIMAL(12,2) DEFAULT 0,
  total_returns DECIMAL(12,2) DEFAULT 0,
  roi DECIMAL(6,2) DEFAULT 0,
  hit_rate DECIMAL(5,2) DEFAULT 0,
  avg_odds DECIMAL(6,2) DEFAULT 0,
  longest_winning_streak INTEGER DEFAULT 0,
  longest_losing_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, risk_level)
);

-- Enable RLS and public read
ALTER TABLE dominant_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE accumulator_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE accumulator_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE accumulator_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read dominant_teams" ON dominant_teams FOR SELECT USING (true);
CREATE POLICY "Public read accumulator_picks" ON accumulator_picks FOR SELECT USING (true);
CREATE POLICY "Public read accumulator_combos" ON accumulator_combos FOR SELECT USING (true);
CREATE POLICY "Public read accumulator_performance" ON accumulator_performance FOR SELECT USING (true);
