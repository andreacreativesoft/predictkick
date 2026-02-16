// Prediction engine types

export interface AnalyzerScore {
  home: number  // 0-1 probability for home
  draw: number  // 0-1 probability for draw
  away: number  // 0-1 probability for away
  confidence: number  // 0-1 how confident this analyzer is
  details: Record<string, unknown>
}

export interface StatsScore extends AnalyzerScore {
  homeAwayDiff: number
  patterns: ScoringPatterns
  formScore: number
  seasonScore: number
}

export interface ScoringPatterns {
  homeEarlyGoals: number
  homeLateGoals: number
  awayEarlyGoals: number
  awayLateGoals: number
  homeSetPieces: number
  awaySetPieces: number
}

export interface SquadScore extends AnalyzerScore {
  lineupStrength: number
  homeInjuryImpact: number
  awayInjuryImpact: number
  keyPlayersMissing: {
    home: string[]
    away: string[]
  }
}

export interface MarketScore extends AnalyzerScore {
  consensus: AnalyzerScore
  movement: {
    direction: 'home' | 'away' | 'stable'
    velocity: number
    significance: 'low' | 'medium' | 'high'
  }
  sharp: {
    pinnacleImplied: { home: number; draw: number; away: number }
    publicVsSharpDiff: number
  }
}

export interface CrossCompScore extends AnalyzerScore {
  fatigue: number
  travel: number
  homeFatigue: number
  awayFatigue: number
  homeRotationRisk: number
  awayRotationRisk: number
}

export interface WeightedInput {
  score: AnalyzerScore
  weight: number
}

export interface RawPrediction {
  home_win_prob: number
  draw_prob: number
  away_win_prob: number
  over_25_prob: number
  under_25_prob: number
  btts_yes_prob: number
  btts_no_prob: number
  predicted_home_goals: number
  predicted_away_goals: number
  confidence_score: number
  data_completeness: number
}

export interface AISynthesis {
  probability_adjustments: {
    home_win: number  // -0.05 to +0.05
    draw: number
    away_win: number
  }
  narrative: string
  key_factors: string[]
  risk_factors: string[]
  non_obvious_patterns: string[]
  recommended_markets: string[]
  confidence_override: number | null
}

export interface PredictionResult extends RawPrediction {
  fixture_id: string
  predicted_score_home: number
  predicted_score_away: number
  top_5_scores: Array<{ score: string; probability: number }>
  ht_home_win_prob: number
  ht_draw_prob: number
  ht_away_win_prob: number
  factor_weights: Record<string, number>
  factor_details: Record<string, AnalyzerScore>
  value_bets: ValueBetResult[]
  ai_analysis: string
  key_factors: string[]
  risk_factors: string[]
  context_applied: Record<string, unknown>
  weather_impact: string | null
  injury_impact: string | null
  fatigue_impact: string | null
  position_impact: string | null
  model_version: string
}

export interface ValueBetResult {
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
