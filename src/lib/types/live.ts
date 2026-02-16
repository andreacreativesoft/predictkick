// Live tracking types

export interface LiveMatchState {
  fixture_id: string
  score_home: number
  score_away: number
  minute: number
  status: 'not_started' | '1H' | 'HT' | '2H' | 'ET' | 'FT' | 'AET' | 'PEN' | 'SUSP' | 'ABD'
  events: LiveEventData[]
  possession_home: number | null
  possession_away: number | null
  shots_home: number | null
  shots_away: number | null
}

export interface LiveEventData {
  minute: number
  event_type: 'goal' | 'red_card' | 'yellow_card' | 'substitution' | 'penalty' | 'var' | 'injury' | 'half_time' | 'full_time'
  team_id: string
  player_name: string | null
  description: string
  impact: EventImpact
}

export interface EventImpact {
  home_win_shift: number
  draw_shift: number
  away_win_shift: number
  over_25_shift: number
  btts_shift: number
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Event Impact Matrix from spec
export const EVENT_IMPACT_MATRIX: Record<string, EventImpactTemplate> = {
  goal_home_leading: {
    home_win_shift: 0.15,
    draw_shift: -0.08,
    away_win_shift: -0.07,
    over_25_shift: 0.10,
    btts_shift: 0.05,
    severity: 'high',
  },
  goal_away_leading: {
    home_win_shift: -0.07,
    draw_shift: -0.08,
    away_win_shift: 0.15,
    over_25_shift: 0.10,
    btts_shift: 0.05,
    severity: 'high',
  },
  goal_equalizer: {
    home_win_shift: -0.05,
    draw_shift: 0.12,
    away_win_shift: -0.07,
    over_25_shift: 0.10,
    btts_shift: 0.15,
    severity: 'high',
  },
  red_card_home: {
    home_win_shift: -0.12,
    draw_shift: 0.04,
    away_win_shift: 0.08,
    over_25_shift: -0.05,
    btts_shift: -0.03,
    severity: 'high',
  },
  red_card_away: {
    home_win_shift: 0.08,
    draw_shift: 0.04,
    away_win_shift: -0.12,
    over_25_shift: -0.05,
    btts_shift: -0.03,
    severity: 'high',
  },
  injury_key_player: {
    home_win_shift: -0.05,
    draw_shift: 0.02,
    away_win_shift: 0.03,
    over_25_shift: -0.02,
    btts_shift: -0.01,
    severity: 'medium',
  },
  penalty_awarded: {
    home_win_shift: 0.08,
    draw_shift: -0.04,
    away_win_shift: -0.04,
    over_25_shift: 0.12,
    btts_shift: 0.05,
    severity: 'medium',
  },
  weather_deterioration: {
    home_win_shift: 0.02,
    draw_shift: 0.03,
    away_win_shift: -0.05,
    over_25_shift: -0.08,
    btts_shift: -0.05,
    severity: 'low',
  },
}

export interface EventImpactTemplate {
  home_win_shift: number
  draw_shift: number
  away_win_shift: number
  over_25_shift: number
  btts_shift: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface HedgeRecommendation {
  should_hedge: boolean
  reason: string
  options: HedgeOption[]
  urgency: 'low' | 'medium' | 'high' | 'immediate'
}

export interface HedgeOption {
  type: 'cashout' | 'single_hedge' | 'full_hedge' | 'partial_cashout'
  description: string
  stake_required: number | null
  guaranteed_profit: number | null
  expected_value: number
  odds_needed: number | null
}

export interface AlertTrigger {
  type: 'goal' | 'red_card' | 'odds_movement' | 'hedge_available' | 'cashout_recommended' | 'weather_change'
  message: string
  severity: 'info' | 'warning' | 'critical'
  bet_id: string
  fixture_id: string
  data: Record<string, unknown>
}
