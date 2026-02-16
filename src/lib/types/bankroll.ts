// Bankroll management types

export interface KellyResult {
  edge: number
  kellyFraction: number
  adjustedFraction: number
  suggestedStake: number
  suggestedStakePct: number
  maxAllowed: number
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'
}

export interface HedgeOption {
  type: 'cashout' | 'single_hedge' | 'full_hedge' | 'hold'
  description: string
  action: string
  guaranteed_profit: number | null
  expected_value: number
  risk_level: 'none' | 'low' | 'medium' | 'high'
  recommended: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>
}

export interface CashoutCalculation {
  current_value: number
  original_stake: number
  potential_return: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  cashout_vs_ev: 'better' | 'worse' | 'similar'
  recommendation: 'cashout' | 'hold' | 'partial_cashout'
  reasoning: string
}

export interface RiskAssessment {
  current_drawdown: number
  max_drawdown: number
  at_stop_loss: boolean
  daily_exposure: number
  daily_exposure_pct: number
  max_daily_exposure: number
  streak_adjustment: number
  kelly_modifier: number
  can_place_bet: boolean
  rejection_reason: string | null
}

export interface PerformanceStats {
  total_bets: number
  wins: number
  losses: number
  void: number
  win_rate: number
  total_staked: number
  total_returns: number
  net_profit: number
  roi: number
  avg_odds: number
  avg_stake: number
  current_streak: number
  longest_winning_streak: number
  longest_losing_streak: number
  best_day: { date: string; pnl: number } | null
  worst_day: { date: string; pnl: number } | null
}

export interface StakingConfig {
  mode: 'kelly' | 'flat' | 'percentage'
  kelly_fraction: 'full' | 'half' | 'quarter'
  flat_stake: number | null
  percentage_stake: number | null
  max_single_bet_pct: number
  max_daily_exposure_pct: number
  min_bet_pct: number
  stop_loss_pct: number
}

export interface BetPlacement {
  fixture_id: string
  prediction_id: string
  market: string
  selection: string
  odds: number
  bookmaker: string
  stake: number
  stake_method: string
  kelly_edge: number
  confidence: number
}
