-- 009_bankroll.sql

CREATE TABLE bankroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  initial_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  peak_amount DECIMAL(12,2),
  drawdown_from_peak DECIMAL(5,2),
  status TEXT DEFAULT 'active',
  max_single_bet_pct DECIMAL(4,2) DEFAULT 5.00,
  max_daily_exposure_pct DECIMAL(4,2) DEFAULT 15.00,
  min_bet_pct DECIMAL(4,2) DEFAULT 0.50,
  stop_loss_pct DECIMAL(4,2) DEFAULT 30.00,
  kelly_fraction TEXT DEFAULT 'half',
  staking_mode TEXT DEFAULT 'kelly',
  flat_stake DECIMAL(8,2),
  total_bets INTEGER DEFAULT 0,
  winning_bets INTEGER DEFAULT 0,
  losing_bets INTEGER DEFAULT 0,
  void_bets INTEGER DEFAULT 0,
  total_staked DECIMAL(12,2) DEFAULT 0,
  total_returns DECIMAL(12,2) DEFAULT 0,
  roi DECIMAL(6,2) DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_winning_streak INTEGER DEFAULT 0,
  longest_losing_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bankroll_id UUID REFERENCES bankroll(id),
  prediction_id UUID REFERENCES predictions(id),
  fixture_id UUID REFERENCES fixtures(id),
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds DECIMAL(8,2) NOT NULL,
  bookmaker TEXT NOT NULL,
  stake DECIMAL(8,2) NOT NULL,
  potential_return DECIMAL(10,2),
  stake_method TEXT,
  kelly_edge DECIMAL(5,2),
  confidence_at_placement DECIMAL(5,2),
  status TEXT DEFAULT 'active',
  result DECIMAL(10,2),
  settled_at TIMESTAMPTZ,
  is_hedge BOOLEAN DEFAULT false,
  parent_bet_id UUID REFERENCES bets(id),
  hedge_bets JSONB,
  cashed_out_at TIMESTAMPTZ,
  cashout_amount DECIMAL(10,2),
  cashout_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_fixture ON bets(fixture_id);

CREATE TABLE bankroll_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bankroll_id UUID REFERENCES bankroll(id),
  bet_id UUID REFERENCES bets(id),
  type TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bankroll_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bankroll_id UUID REFERENCES bankroll(id),
  date DATE NOT NULL,
  opening_balance DECIMAL(12,2),
  closing_balance DECIMAL(12,2),
  bets_placed INTEGER DEFAULT 0,
  bets_won INTEGER DEFAULT 0,
  bets_lost INTEGER DEFAULT 0,
  total_staked DECIMAL(10,2) DEFAULT 0,
  total_returns DECIMAL(10,2) DEFAULT 0,
  daily_pnl DECIMAL(10,2) DEFAULT 0,
  roi DECIMAL(6,2) DEFAULT 0,
  UNIQUE(bankroll_id, date)
);

CREATE TABLE performance_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bankroll_id UUID REFERENCES bankroll(id),
  period TEXT NOT NULL,
  dimension TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  total_bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_staked DECIMAL(10,2) DEFAULT 0,
  total_returns DECIMAL(10,2) DEFAULT 0,
  roi DECIMAL(6,2) DEFAULT 0,
  avg_odds DECIMAL(6,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bankroll_id, period, dimension, dimension_value)
);
