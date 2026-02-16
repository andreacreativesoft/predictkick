-- 005_contextual_factors.sql

CREATE TABLE contextual_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  fixture_id UUID REFERENCES fixtures(id),
  factor_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sentiment TEXT DEFAULT 'negative',
  impact_score DECIMAL(3,2) DEFAULT 0.5,
  source TEXT,
  source_url TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_context_team ON contextual_factors(team_id);
CREATE INDEX idx_context_type ON contextual_factors(factor_type);

CREATE TABLE referees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  avg_fouls_per_game DECIMAL(4,1),
  avg_yellows_per_game DECIMAL(4,2),
  avg_reds_per_game DECIMAL(4,3),
  avg_penalties_per_game DECIMAL(4,3),
  home_win_percentage DECIMAL(5,2),
  cards_style TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
