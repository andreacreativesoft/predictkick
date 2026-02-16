// Database row types - mirrors the Supabase schema
// These will be replaced by auto-generated types once Supabase is connected

export interface League {
  id: string
  api_id: number
  name: string
  country: string | null
  logo_url: string | null
  tier: number
  is_active: boolean
  created_at: string
}

export interface Team {
  id: string
  api_id: number
  name: string
  short_name: string | null
  logo_url: string | null
  league_id: string | null
  stadium_name: string | null
  stadium_lat: number | null
  stadium_lng: number | null
  stadium_capacity: number | null
  stadium_altitude: number
  created_at: string
}

export interface Player {
  id: string
  api_id: number | null
  name: string
  team_id: string | null
  position: 'GK' | 'DEF' | 'MID' | 'FWD' | null
  is_key_player: boolean
  impact_score: number
  goals_season: number
  assists_season: number
  minutes_played: number
  market_value: number | null
  photo_url: string | null
  updated_at: string
}

export interface Standing {
  id: string
  league_id: string | null
  team_id: string | null
  season: string
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  ppg: number
  zone: 'champion' | 'cl_qualify' | 'el_qualify' | 'mid_table' | 'relegation_playoff' | 'relegation' | null
  form_last5: string[] | null
  form_last10: string[] | null
  home_record: Record<string, number> | null
  away_record: Record<string, number> | null
  xg_for: number | null
  xg_against: number | null
  xg_difference: number | null
  clean_sheets: number
  failed_to_score: number
  avg_goals_scored: number | null
  avg_goals_conceded: number | null
  btts_percentage: number | null
  over_25_percentage: number | null
  goals_0_15: number
  goals_16_30: number
  goals_31_45: number
  goals_46_60: number
  goals_61_75: number
  goals_76_90: number
  updated_at: string
}

export interface Fixture {
  id: string
  api_id: number
  league_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  match_date: string
  venue: string | null
  referee: string | null
  status: string
  home_score: number | null
  away_score: number | null
  ht_home_score: number | null
  ht_away_score: number | null
  home_possession: number | null
  away_possession: number | null
  home_shots: number | null
  away_shots: number | null
  home_shots_on_target: number | null
  away_shots_on_target: number | null
  home_corners: number | null
  away_corners: number | null
  home_fouls: number | null
  away_fouls: number | null
  home_yellow_cards: number | null
  away_yellow_cards: number | null
  home_red_cards: number | null
  away_red_cards: number | null
  home_xg: number | null
  away_xg: number | null
  is_derby: boolean
  competition_importance: string
  created_at: string
  updated_at: string
}

export interface H2HRecord {
  id: string
  team_a_id: string | null
  team_b_id: string | null
  total_matches: number
  team_a_wins: number
  team_b_wins: number
  draws: number
  avg_goals: number | null
  avg_cards: number | null
  btts_count: number
  over_25_count: number
  last_5_results: Record<string, unknown>[] | null
  updated_at: string
}

export interface TeamScheduleContext {
  id: string
  team_id: string | null
  fixture_id: string | null
  prev_match_date: string | null
  prev_match_competition: string | null
  prev_match_was_away: boolean | null
  prev_match_travel_km: number | null
  days_since_prev_match: number | null
  next_match_date: string | null
  next_match_competition: string | null
  next_match_importance: string | null
  days_until_next_match: number | null
  fatigue_score: number
  rotation_risk: number
  fixture_congestion_7d: number
  fixture_congestion_30d: number
  updated_at: string
}

export interface EuropeanContext {
  id: string
  team_id: string | null
  competition: string
  season: string
  group_position: number | null
  group_points: number | null
  is_qualified: boolean
  is_eliminated: boolean
  must_win_next: boolean
  next_european_fixture_id: string | null
  updated_at: string
}

export interface PlayerAvailability {
  id: string
  player_id: string | null
  team_id: string | null
  fixture_id: string | null
  status: 'injured' | 'suspended' | 'doubtful' | 'international_duty' | 'personal' | 'available'
  reason: string | null
  expected_return: string | null
  source: 'api' | 'news_scrape' | 'manual' | null
  impact_on_team: number | null
  created_at: string
  updated_at: string
}

export interface YellowCardTracker {
  id: string
  player_id: string | null
  team_id: string | null
  league_id: string | null
  season: string
  yellow_cards: number
  suspension_threshold: number
  cards_until_suspension: number | null
  at_risk: boolean
  updated_at: string
}

export interface ContextualFactor {
  id: string
  team_id: string | null
  fixture_id: string | null
  factor_type: string
  title: string
  description: string | null
  sentiment: 'positive' | 'negative' | 'neutral'
  impact_score: number
  source: string | null
  source_url: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Referee {
  id: string
  api_id: number | null
  name: string
  avg_fouls_per_game: number | null
  avg_yellows_per_game: number | null
  avg_reds_per_game: number | null
  avg_penalties_per_game: number | null
  home_win_percentage: number | null
  cards_style: 'lenient' | 'average' | 'strict' | 'card_happy' | null
  updated_at: string
}

export interface MatchWeather {
  id: string
  fixture_id: string | null
  pre_temperature: number | null
  pre_feels_like: number | null
  pre_humidity: number | null
  pre_wind_speed: number | null
  pre_wind_direction: number | null
  pre_rain_probability: number | null
  pre_rain_mm: number | null
  pre_snow_probability: number | null
  pre_condition: string | null
  pre_visibility: number | null
  hourly_forecast: Record<string, unknown>[] | null
  live_temperature: number | null
  live_condition: string | null
  live_wind_speed: number | null
  live_rain_mm: number | null
  weather_impact_score: number | null
  weather_impact_description: string | null
  fetched_at: string
  updated_at: string
}

export interface OddsCurrent {
  id: string
  fixture_id: string | null
  market: string
  best_home_odds: number | null
  best_home_bookmaker: string | null
  best_draw_odds: number | null
  best_draw_bookmaker: string | null
  best_away_odds: number | null
  best_away_bookmaker: string | null
  avg_home_odds: number | null
  avg_draw_odds: number | null
  avg_away_odds: number | null
  line: number | null
  updated_at: string
}

export interface OddsHistory {
  id: string
  fixture_id: string | null
  bookmaker: string
  market: string
  home_odds: number | null
  draw_odds: number | null
  away_odds: number | null
  line: number | null
  is_live: boolean
  snapshot_at: string
}

export interface OddsAlert {
  id: string
  fixture_id: string | null
  alert_type: string
  market: string
  description: string | null
  old_odds: number | null
  new_odds: number | null
  bookmaker: string | null
  implied_prob_change: number | null
  is_read: boolean
  created_at: string
}

export interface Prediction {
  id: string
  fixture_id: string | null
  home_win_prob: number | null
  draw_prob: number | null
  away_win_prob: number | null
  over_25_prob: number | null
  under_25_prob: number | null
  btts_yes_prob: number | null
  btts_no_prob: number | null
  predicted_home_goals: number | null
  predicted_away_goals: number | null
  predicted_score_home: number | null
  predicted_score_away: number | null
  top_5_scores: Record<string, number>[] | null
  ht_home_win_prob: number | null
  ht_draw_prob: number | null
  ht_away_win_prob: number | null
  confidence_score: number | null
  data_completeness: number | null
  factor_weights: Record<string, number> | null
  factor_details: Record<string, unknown> | null
  value_bets: ValueBet[] | null
  ai_analysis: string | null
  key_factors: string[] | null
  risk_factors: string[] | null
  context_applied: Record<string, unknown> | null
  weather_impact: string | null
  injury_impact: string | null
  fatigue_impact: string | null
  position_impact: string | null
  model_version: string
  generated_at: string
  updated_at: string
}

export interface Bankroll {
  id: string
  user_id: string
  initial_amount: number
  current_amount: number
  currency: string
  peak_amount: number | null
  drawdown_from_peak: number | null
  status: string
  max_single_bet_pct: number
  max_daily_exposure_pct: number
  min_bet_pct: number
  stop_loss_pct: number
  kelly_fraction: 'full' | 'half' | 'quarter'
  staking_mode: 'kelly' | 'flat' | 'percentage'
  flat_stake: number | null
  total_bets: number
  winning_bets: number
  losing_bets: number
  void_bets: number
  total_staked: number
  total_returns: number
  roi: number
  current_streak: number
  longest_winning_streak: number
  longest_losing_streak: number
  created_at: string
  updated_at: string
}

export interface Bet {
  id: string
  user_id: string
  bankroll_id: string | null
  prediction_id: string | null
  fixture_id: string | null
  market: string
  selection: string
  odds: number
  bookmaker: string
  stake: number
  potential_return: number | null
  stake_method: string | null
  kelly_edge: number | null
  confidence_at_placement: number | null
  status: 'active' | 'won' | 'lost' | 'void' | 'cashed_out'
  result: number | null
  settled_at: string | null
  is_hedge: boolean
  parent_bet_id: string | null
  hedge_bets: Record<string, unknown>[] | null
  cashed_out_at: string | null
  cashout_amount: number | null
  cashout_reason: string | null
  created_at: string
  updated_at: string
}

export interface BankrollTransaction {
  id: string
  bankroll_id: string | null
  bet_id: string | null
  type: 'bet_placed' | 'bet_won' | 'bet_lost' | 'bet_void' | 'cashout' | 'deposit' | 'withdrawal'
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

export interface BankrollDaily {
  id: string
  bankroll_id: string | null
  date: string
  opening_balance: number | null
  closing_balance: number | null
  bets_placed: number
  bets_won: number
  bets_lost: number
  total_staked: number
  total_returns: number
  daily_pnl: number
  roi: number
}

export interface PerformanceBreakdown {
  id: string
  bankroll_id: string | null
  period: string
  dimension: string
  dimension_value: string
  total_bets: number
  wins: number
  losses: number
  total_staked: number
  total_returns: number
  roi: number
  avg_odds: number
  updated_at: string
}

export interface LiveTracking {
  id: string
  bet_id: string | null
  fixture_id: string | null
  user_id: string
  current_score_home: number
  current_score_away: number
  match_minute: number
  match_status: string
  current_live_odds: number | null
  position_value: number | null
  unrealized_pnl: number | null
  hedge_recommended: boolean
  hedge_reason: string | null
  hedge_details: Record<string, unknown> | null
  cashout_available: boolean
  cashout_value: number | null
  cashout_vs_hold: string | null
  alerts_sent: Record<string, unknown>[]
  updated_at: string
}

export interface LiveEvent {
  id: string
  fixture_id: string | null
  minute: number
  event_type: 'goal' | 'red_card' | 'yellow_card' | 'substitution' | 'penalty' | 'var' | 'injury' | 'half_time' | 'full_time'
  team_id: string | null
  player_id: string | null
  description: string | null
  impact: string | null
  source: string
  prediction_shift: Record<string, number> | null
  created_at: string
}

export interface ManualInput {
  id: string
  user_id: string
  team_id: string | null
  fixture_id: string | null
  player_id: string | null
  input_type: string
  title: string
  description: string | null
  sentiment: 'positive' | 'negative' | 'neutral'
  impact_estimate: 'low' | 'medium' | 'high' | 'critical'
  source_url: string | null
  is_processed: boolean
  ai_interpretation: string | null
  prediction_impact: Record<string, unknown> | null
  created_at: string
}

// Composite types used across the app
export interface ValueBet {
  market: string
  selection: string
  our_prob: number
  implied_prob: number
  edge: number
  best_odds: number
  bookmaker: string
  kelly_stake_pct: number
  confidence: 'low' | 'medium' | 'high'
}

export interface FixtureWithTeams extends Fixture {
  home_team: Team
  away_team: Team
  league: League
}

export interface FixtureWithPrediction extends FixtureWithTeams {
  prediction: Prediction | null
  odds: OddsCurrent | null
}
