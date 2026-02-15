// API-Football League IDs
export const LEAGUE_IDS = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  SERIE_A: 135,
  BUNDESLIGA: 78,
  LIGUE_1: 61,
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 3,
} as const

export const ACTIVE_LEAGUES = Object.values(LEAGUE_IDS)

// Bookmaker keys (The Odds API)
export const BOOKMAKERS = {
  BET365: 'bet365',
  WILLIAM_HILL: 'williamhill',
  UNIBET: 'unibet',
  BETFAIR: 'betfair',
  ONEXBET: '1xbet',
  PINNACLE: 'pinnacle',
} as const

// Prediction weight model v2.0
export const PREDICTION_WEIGHTS = {
  // Tier 1: Hard Stats (42%)
  current_form: 0.12,
  season_stats: 0.10,
  h2h_record: 0.08,
  home_away_splits: 0.07,
  scoring_patterns: 0.05,
  // Tier 2: Squad (20%)
  injuries_suspensions: 0.12,
  fatigue_rotation: 0.05,
  lineup_quality: 0.03,
  // Tier 3: Situational (15%)
  league_position_context: 0.05,
  cross_competition: 0.04,
  psychological_factors: 0.04,
  referee_factor: 0.02,
  // Tier 4: Market (13%)
  bookmaker_consensus: 0.08,
  odds_movement: 0.03,
  sharp_vs_public: 0.02,
  // Tier 5: Environment (5%)
  weather: 0.03,
  travel_conditions: 0.02,
  // Tier 6: AI (5%)
  claude_analysis: 0.05,
} as const

// Value bet minimum edge threshold
export const MIN_VALUE_EDGE = 0.03 // 3%

// Kelly criterion defaults
export const KELLY_DEFAULTS = {
  fraction: 'half' as const,
  maxSingleBetPct: 5,
  maxDailyExposurePct: 15,
  minBetPct: 0.5,
  stopLossPct: 30,
}

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  FIXTURES: 21600,      // 6 hours
  STANDINGS: 21600,     // 6 hours
  ODDS: 3600,           // 1 hour
  INJURIES: 14400,      // 4 hours
  WEATHER: 10800,       // 3 hours
  NEWS: 10800,          // 3 hours
  PREDICTIONS: 10800,   // 3 hours
  LIVE_SCORES: 60,      // 1 minute
  LIVE_ODDS: 300,       // 5 minutes
} as const

// API rate limits (requests per day for free tiers)
export const API_RATE_LIMITS = {
  FOOTBALL_API: 100,
  ODDS_API: 500,       // per month, ~16/day
  OPENWEATHER: 1000,
  NEWS_API: 100,
} as const
