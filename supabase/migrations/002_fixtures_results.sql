-- 002_fixtures_results.sql

CREATE TABLE fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE NOT NULL,
  league_id UUID REFERENCES leagues(id),
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  match_date TIMESTAMPTZ NOT NULL,
  venue TEXT,
  referee TEXT,
  status TEXT DEFAULT 'scheduled',
  home_score INTEGER,
  away_score INTEGER,
  ht_home_score INTEGER,
  ht_away_score INTEGER,
  home_possession DECIMAL(4,1),
  away_possession DECIMAL(4,1),
  home_shots INTEGER,
  away_shots INTEGER,
  home_shots_on_target INTEGER,
  away_shots_on_target INTEGER,
  home_corners INTEGER,
  away_corners INTEGER,
  home_fouls INTEGER,
  away_fouls INTEGER,
  home_yellow_cards INTEGER,
  away_yellow_cards INTEGER,
  home_red_cards INTEGER,
  away_red_cards INTEGER,
  home_xg DECIMAL(4,2),
  away_xg DECIMAL(4,2),
  is_derby BOOLEAN DEFAULT false,
  competition_importance TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fixtures_date ON fixtures(match_date);
CREATE INDEX idx_fixtures_status ON fixtures(status);
CREATE INDEX idx_fixtures_teams ON fixtures(home_team_id, away_team_id);

-- Head-to-head records
CREATE TABLE h2h_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a_id UUID REFERENCES teams(id),
  team_b_id UUID REFERENCES teams(id),
  total_matches INTEGER DEFAULT 0,
  team_a_wins INTEGER DEFAULT 0,
  team_b_wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  avg_goals DECIMAL(4,2),
  avg_cards DECIMAL(4,2),
  btts_count INTEGER DEFAULT 0,
  over_25_count INTEGER DEFAULT 0,
  last_5_results JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_a_id, team_b_id)
);
