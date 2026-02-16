-- 001_core_entities.sql

-- Leagues
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  logo_url TEXT,
  tier INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  league_id UUID REFERENCES leagues(id),
  stadium_name TEXT,
  stadium_lat DECIMAL(9,6),
  stadium_lng DECIMAL(9,6),
  stadium_capacity INTEGER,
  stadium_altitude INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  team_id UUID REFERENCES teams(id),
  position TEXT,
  is_key_player BOOLEAN DEFAULT false,
  impact_score DECIMAL(3,2) DEFAULT 0.50,
  goals_season INTEGER DEFAULT 0,
  assists_season INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  market_value DECIMAL(12,2),
  photo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- League standings
CREATE TABLE standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  team_id UUID REFERENCES teams(id),
  season TEXT NOT NULL,
  position INTEGER NOT NULL,
  played INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  drawn INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  goal_difference INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  ppg DECIMAL(4,2) DEFAULT 0,
  zone TEXT,
  form_last5 TEXT[],
  form_last10 TEXT[],
  home_record JSONB,
  away_record JSONB,
  xg_for DECIMAL(5,2),
  xg_against DECIMAL(5,2),
  xg_difference DECIMAL(5,2),
  clean_sheets INTEGER DEFAULT 0,
  failed_to_score INTEGER DEFAULT 0,
  avg_goals_scored DECIMAL(4,2),
  avg_goals_conceded DECIMAL(4,2),
  btts_percentage DECIMAL(5,2),
  over_25_percentage DECIMAL(5,2),
  goals_0_15 INTEGER DEFAULT 0,
  goals_16_30 INTEGER DEFAULT 0,
  goals_31_45 INTEGER DEFAULT 0,
  goals_46_60 INTEGER DEFAULT 0,
  goals_61_75 INTEGER DEFAULT 0,
  goals_76_90 INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, team_id, season)
);

CREATE INDEX idx_standings_zone ON standings(zone);
