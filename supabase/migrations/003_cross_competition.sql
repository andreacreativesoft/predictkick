-- 003_cross_competition.sql

CREATE TABLE team_schedule_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  fixture_id UUID REFERENCES fixtures(id),
  prev_match_date TIMESTAMPTZ,
  prev_match_competition TEXT,
  prev_match_was_away BOOLEAN,
  prev_match_travel_km INTEGER,
  days_since_prev_match INTEGER,
  next_match_date TIMESTAMPTZ,
  next_match_competition TEXT,
  next_match_importance TEXT,
  days_until_next_match INTEGER,
  fatigue_score DECIMAL(3,2) DEFAULT 0.5,
  rotation_risk DECIMAL(3,2) DEFAULT 0.3,
  fixture_congestion_7d INTEGER DEFAULT 0,
  fixture_congestion_30d INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE european_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  competition TEXT NOT NULL,
  season TEXT NOT NULL,
  group_position INTEGER,
  group_points INTEGER,
  is_qualified BOOLEAN DEFAULT false,
  is_eliminated BOOLEAN DEFAULT false,
  must_win_next BOOLEAN DEFAULT false,
  next_european_fixture_id UUID REFERENCES fixtures(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, competition, season)
);
