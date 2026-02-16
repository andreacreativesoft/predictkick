-- 004_player_availability.sql

CREATE TABLE player_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  team_id UUID REFERENCES teams(id),
  fixture_id UUID REFERENCES fixtures(id),
  status TEXT NOT NULL,
  reason TEXT,
  expected_return DATE,
  source TEXT,
  impact_on_team DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE yellow_card_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  team_id UUID REFERENCES teams(id),
  league_id UUID REFERENCES leagues(id),
  season TEXT NOT NULL,
  yellow_cards INTEGER DEFAULT 0,
  suspension_threshold INTEGER DEFAULT 5,
  cards_until_suspension INTEGER,
  at_risk BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, league_id, season)
);
