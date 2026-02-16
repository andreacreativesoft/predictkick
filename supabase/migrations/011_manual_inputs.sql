-- 011_manual_inputs.sql

CREATE TABLE manual_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  team_id UUID REFERENCES teams(id),
  fixture_id UUID REFERENCES fixtures(id),
  player_id UUID REFERENCES players(id),
  input_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sentiment TEXT DEFAULT 'neutral',
  impact_estimate TEXT DEFAULT 'medium',
  source_url TEXT,
  is_processed BOOLEAN DEFAULT false,
  ai_interpretation TEXT,
  prediction_impact JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
