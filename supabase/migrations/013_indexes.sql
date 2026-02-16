-- 013_indexes.sql

CREATE INDEX idx_fixtures_league_date ON fixtures(league_id, match_date);
CREATE INDEX idx_standings_league_season ON standings(league_id, season);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_player_avail_fixture ON player_availability(fixture_id);
CREATE INDEX idx_player_avail_team ON player_availability(team_id);
CREATE INDEX idx_schedule_context_team ON team_schedule_context(team_id);
CREATE INDEX idx_schedule_context_fixture ON team_schedule_context(fixture_id);
CREATE INDEX idx_european_team ON european_context(team_id);
CREATE INDEX idx_weather_fixture ON match_weather(fixture_id);
CREATE INDEX idx_odds_current_fixture ON odds_current(fixture_id);
CREATE INDEX idx_predictions_fixture ON predictions(fixture_id);
CREATE INDEX idx_bankroll_user ON bankroll(user_id);
CREATE INDEX idx_transactions_bankroll ON bankroll_transactions(bankroll_id);
CREATE INDEX idx_daily_bankroll_date ON bankroll_daily(bankroll_id, date);
CREATE INDEX idx_live_tracking_fixture ON live_tracking(fixture_id);
CREATE INDEX idx_live_tracking_user ON live_tracking(user_id);
CREATE INDEX idx_manual_inputs_fixture ON manual_inputs(fixture_id);
CREATE INDEX idx_manual_inputs_team ON manual_inputs(team_id);
CREATE INDEX idx_odds_alerts_fixture ON odds_alerts(fixture_id);
CREATE INDEX idx_odds_alerts_unread ON odds_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_context_active ON contextual_factors(is_active) WHERE is_active = true;
CREATE INDEX idx_yellow_at_risk ON yellow_card_tracker(at_risk) WHERE at_risk = true;
