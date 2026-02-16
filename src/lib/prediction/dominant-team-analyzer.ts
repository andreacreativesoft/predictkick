// Dominant Team Analyzer
// Identifies teams that win 85%+ of their matches and builds accumulator strategies.
// Pure calculation module - no external dependencies, receives all data as parameters.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DominanceProfile {
  team_id: string
  team_name: string
  league_id: string
  league_name: string
  dominance_level: 'ultra' | 'strong' | 'moderate' | 'none'
  dominance_score: number  // 0-100
  win_rate: number
  ppg: number
  goal_difference: number
  home_win_rate: number
  away_win_rate: number
  form_last5: string[]  // W/D/L array
  form_score: number  // 0-1
  loss_rate: number
  draw_rate: number
  avg_goals_scored: number
  avg_goals_conceded: number
  clean_sheet_pct: number
}

export interface AccumulatorPick {
  fixture_id: string
  team_id: string
  team_name: string
  opponent_name: string
  league_name: string
  match_date: string
  is_home: boolean
  dominance_score: number
  opponent_position: number
  opponent_zone: string | null
  safety_score: number  // 0-100, how "safe" this pick is for accumulators
  risk_factors: string[]
  recommended_market: 'home_win' | 'away_win' | 'double_chance' | 'over_05' | 'over_15'
  min_odds_threshold: number  // minimum odds worth taking
  current_odds: number | null
  is_value: boolean  // odds > min_threshold
  confidence: 'very_high' | 'high' | 'medium'
}

export interface AccumulatorCombo {
  id: string
  picks: AccumulatorPick[]
  total_odds: number
  expected_win_rate: number     // probability all legs win
  expected_value: number        // EV per unit staked
  legs: number
  risk_level: 'conservative' | 'moderate' | 'aggressive'
  suggested_stake_pct: number   // of bankroll
  season_simulation: {
    expected_wins: number
    expected_losses: number
    break_even_rate: number
    projected_roi: number
    max_consecutive_losses: number
    recovery_bets_after_loss: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMINANCE_THRESHOLDS = {
  ULTRA_WIN_RATE: 0.92,
  STRONG_WIN_RATE: 0.85,
  MODERATE_WIN_RATE: 0.75,
} as const

const FORM_WEIGHTS = {
  most_recent: 1.0,
  second: 0.85,
  third: 0.70,
  fourth: 0.55,
  fifth: 0.40,
} as const

const SAFETY_BASE = 60

const SAFETY_MODIFIERS = {
  HOME_ADVANTAGE: 10,
  FORM_LOSS_PENALTY: -20,
  FORM_DRAW_PENALTY: -8,
  CONGESTION_PENALTY: -15,
  KEY_INJURY_PENALTY: -10,
  BAD_WEATHER_PENALTY: -5,
  OPPONENT_BOTTOM_3: 12,
  OPPONENT_BOTTOM_HALF: 6,
  OPPONENT_TOP_6: -10,
  OPPONENT_TOP_3: -18,
  OPPONENT_RELEGATION: 15,
  PREDICTION_HIGH_CONF: 8,
  PREDICTION_MED_CONF: 4,
  ULTRA_DOMINANCE_BONUS: 8,
  STRONG_DOMINANCE_BONUS: 4,
  CLEAN_SHEET_BONUS: 5,       // if clean sheet pct > 50%
  AWAY_WEAKNESS_BONUS: 6,     // opponent poor away / home record
} as const

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Convert form string array (["W","W","D","W","L"]) to a weighted 0-1 score.
 * More recent results carry heavier weight.
 */
function calculateFormScore(form: string[]): number {
  if (form.length === 0) return 0.5
  const weights = [
    FORM_WEIGHTS.most_recent,
    FORM_WEIGHTS.second,
    FORM_WEIGHTS.third,
    FORM_WEIGHTS.fourth,
    FORM_WEIGHTS.fifth,
  ]
  let totalWeight = 0
  let totalScore = 0
  for (let i = 0; i < Math.min(form.length, 5); i++) {
    const w = weights[i]
    const result = form[i]
    const pts = result === 'W' ? 1.0 : result === 'D' ? 0.35 : 0.0
    totalScore += pts * w
    totalWeight += w
  }
  return totalWeight > 0 ? totalScore / totalWeight : 0.5
}

/**
 * Determine the dominance level from a win rate.
 */
function classifyDominance(winRate: number): DominanceProfile['dominance_level'] {
  if (winRate >= DOMINANCE_THRESHOLDS.ULTRA_WIN_RATE) return 'ultra'
  if (winRate >= DOMINANCE_THRESHOLDS.STRONG_WIN_RATE) return 'strong'
  if (winRate >= DOMINANCE_THRESHOLDS.MODERATE_WIN_RATE) return 'moderate'
  return 'none'
}

/**
 * Calculate the minimum odds per leg that makes an n-leg accumulator
 * profitable given the individual win probability per leg.
 *
 * Math:
 *   combined_win_prob = winProb ^ legs
 *   break_even_total_odds = 1 / combined_win_prob
 *   min_odds_per_leg = break_even_total_odds ^ (1 / legs)
 *
 * We add a small margin (5%) above pure break-even so we target positive EV.
 */
function calculateMinOddsPerLeg(winProb: number, legs: number, marginPct: number = 0.05): number {
  if (winProb <= 0 || winProb >= 1 || legs < 1) return Infinity
  const combinedProb = Math.pow(winProb, legs)
  const breakEvenTotal = 1 / combinedProb
  const targetTotal = breakEvenTotal * (1 + marginPct)
  return Math.pow(targetTotal, 1 / legs)
}

/**
 * Estimate single-leg win probability for the dominant team in a specific match.
 * Adjusts from the team's raw win rate based on contextual factors.
 */
function estimateMatchWinProb(
  dominantTeam: DominanceProfile,
  isHome: boolean,
  opponentPosition: number,
  leagueSize: number,
  predictionConfidence: number | null
): number {
  let prob = dominantTeam.win_rate

  // Home / away split: use the team's actual venue-specific rate, blended with overall
  if (isHome) {
    prob = prob * 0.4 + dominantTeam.home_win_rate * 0.6
  } else {
    prob = prob * 0.4 + dominantTeam.away_win_rate * 0.6
  }

  // Opponent strength adjustment based on league position
  const opponentStrength = opponentPosition / Math.max(leagueSize, 1)
  // Bottom half opponents are easier; top opponents harder
  if (opponentStrength > 0.7) {
    prob = Math.min(1, prob * 1.05)  // weak opponent, small boost
  } else if (opponentStrength > 0.5) {
    // mid-table, no adjustment
  } else if (opponentStrength > 0.2) {
    prob *= 0.95  // upper-table, slight reduction
  } else {
    prob *= 0.88  // top-3 opponent, notable reduction
  }

  // If we have a prediction confidence, blend it in
  if (predictionConfidence !== null && predictionConfidence > 0) {
    const predProb = predictionConfidence / 100
    // Weighted blend: 70% our dominance model, 30% prediction engine
    prob = prob * 0.7 + predProb * 0.3
  }

  return clamp(prob, 0.3, 0.99)
}

/**
 * Determine the zone description for an opponent position.
 */
function inferOpponentZone(position: number, leagueSize: number): string | null {
  if (leagueSize === 0) return null
  const relativePos = position / leagueSize
  if (relativePos <= 0.15) return 'champion'
  if (relativePos <= 0.25) return 'cl_qualify'
  if (relativePos <= 0.35) return 'el_qualify'
  if (relativePos <= 0.65) return 'mid_table'
  if (relativePos <= 0.80) return 'relegation_playoff'
  return 'relegation'
}

/**
 * Generate a short deterministic id from picks.
 */
function generateComboId(picks: AccumulatorPick[]): string {
  const hash = picks.map(p => p.fixture_id).sort().join('-')
  // Simple numeric hash for readability
  let h = 0
  for (let i = 0; i < hash.length; i++) {
    h = ((h << 5) - h + hash.charCodeAt(i)) | 0
  }
  return `acca_${Math.abs(h).toString(36)}`
}

// ---------------------------------------------------------------------------
// Main exported functions
// ---------------------------------------------------------------------------

/**
 * Analyze all teams in a league's standings to find dominant ones.
 *
 * @param standings - Array of standing rows. Each row is expected to have at
 *   minimum: team_id, team_name, league_id, league_name, played, won, drawn,
 *   lost, goals_for, goals_against, ppg, form_last5, position, home_won,
 *   home_played, away_won, away_played, clean_sheets, avg_goals_scored,
 *   avg_goals_conceded.  Extra fields are tolerated and ignored.
 * @returns Array of DominanceProfile for teams that reach at least "moderate"
 *   dominance, sorted by dominance_score descending.
 */
export function identifyDominantTeams(standings: any[]): DominanceProfile[] {
  if (!standings || standings.length === 0) return []

  const profiles: DominanceProfile[] = []

  for (const row of standings) {
    const played = Number(row.played || 0)
    if (played < 5) continue // too few matches to judge

    const won = Number(row.won || 0)
    const drawn = Number(row.drawn || 0)
    const lost = Number(row.lost || 0)
    const goalsFor = Number(row.goals_for || 0)
    const goalsAgainst = Number(row.goals_against || 0)
    const ppg = Number(row.ppg || (played > 0 ? (won * 3 + drawn) / played : 0))

    const winRate = played > 0 ? won / played : 0
    const drawRate = played > 0 ? drawn / played : 0
    const lossRate = played > 0 ? lost / played : 0
    const goalDifference = goalsFor - goalsAgainst

    // Home / away splits
    const homePlayed = Number(row.home_played || 0)
    const homeWon = Number(row.home_won || 0)
    const awayPlayed = Number(row.away_played || 0)
    const awayWon = Number(row.away_won || 0)
    const homeWinRate = homePlayed > 0 ? homeWon / homePlayed : winRate
    const awayWinRate = awayPlayed > 0 ? awayWon / awayPlayed : winRate

    // Form
    const formLast5: string[] = Array.isArray(row.form_last5)
      ? row.form_last5
      : typeof row.form_last5 === 'string'
        ? row.form_last5.split('')
        : []
    const formScore = calculateFormScore(formLast5)

    // Clean sheet percentage
    const cleanSheets = Number(row.clean_sheets || 0)
    const cleanSheetPct = played > 0 ? cleanSheets / played : 0

    // Average goals
    const avgGoalsScored = Number(row.avg_goals_scored || (played > 0 ? goalsFor / played : 0))
    const avgGoalsConceded = Number(row.avg_goals_conceded || (played > 0 ? goalsAgainst / played : 0))

    // Dominance classification
    const dominanceLevel = classifyDominance(winRate)
    if (dominanceLevel === 'none') continue

    // Composite dominance score (0-100)
    // Weighted: win_rate 40%, PPG normalized 20%, goal_diff normalized 15%, form 15%, clean_sheet 10%
    const maxPossiblePPG = 3.0
    const ppgNorm = clamp(ppg / maxPossiblePPG, 0, 1)

    // Goal difference normalized: assume max plausible GD is ~3 per game * played
    const gdPerGame = played > 0 ? goalDifference / played : 0
    const gdNorm = clamp((gdPerGame + 1) / 4, 0, 1) // range: -1..+3 maps to 0..1

    const rawScore =
      winRate * 40 +
      ppgNorm * 20 +
      gdNorm * 15 +
      formScore * 15 +
      cleanSheetPct * 10

    const dominanceScore = clamp(Math.round(rawScore * 10) / 10, 0, 100)

    profiles.push({
      team_id: String(row.team_id),
      team_name: String(row.team_name || row.team?.name || 'Unknown'),
      league_id: String(row.league_id || ''),
      league_name: String(row.league_name || row.league?.name || ''),
      dominance_level: dominanceLevel,
      dominance_score: dominanceScore,
      win_rate: Number(winRate.toFixed(4)),
      ppg: Number(ppg.toFixed(2)),
      goal_difference: goalDifference,
      home_win_rate: Number(homeWinRate.toFixed(4)),
      away_win_rate: Number(awayWinRate.toFixed(4)),
      form_last5: formLast5,
      form_score: Number(formScore.toFixed(4)),
      loss_rate: Number(lossRate.toFixed(4)),
      draw_rate: Number(drawRate.toFixed(4)),
      avg_goals_scored: Number(avgGoalsScored.toFixed(2)),
      avg_goals_conceded: Number(avgGoalsConceded.toFixed(2)),
      clean_sheet_pct: Number(cleanSheetPct.toFixed(4)),
    })
  }

  return profiles.sort((a, b) => b.dominance_score - a.dominance_score)
}

/**
 * Assess whether a specific fixture involving a dominant team is a safe pick
 * for accumulator / parlay strategies.
 *
 * @param fixture - The fixture object (must contain: id, match_date, home_team_id or home_team.id,
 *   away_team_id or away_team.id, home_team.name, away_team.name).
 * @param dominantTeam - The DominanceProfile of the dominant team in this fixture.
 * @param opponentStandings - Standings row for the opponent (position, zone, home/away stats).
 * @param odds - Current odds object (best_home_odds, best_away_odds, etc.) or null.
 * @param prediction - Prediction result from the engine (home_win_prob, away_win_prob, confidence_score) or null.
 * @param weather - Weather data (weather_impact_score, pre_rain_mm, pre_wind_speed) or null.
 * @param injuries - Array of injury objects for the dominant team ({player: {is_key_player}, status}).
 * @returns An AccumulatorPick with safety scoring and recommendation.
 */
export function assessAccumulatorPick(
  fixture: any,
  dominantTeam: DominanceProfile,
  opponentStandings: any,
  odds: any | null,
  prediction: any | null,
  weather: any | null,
  injuries: any[]
): AccumulatorPick {
  // Determine which side the dominant team is on
  const homeTeamId = String(fixture.home_team_id || fixture.home_team?.id || '')
  const awayTeamId = String(fixture.away_team_id || fixture.away_team?.id || '')
  const isHome = dominantTeam.team_id === homeTeamId

  const opponentName = isHome
    ? String(fixture.away_team?.name || fixture.away_team_name || 'Opponent')
    : String(fixture.home_team?.name || fixture.home_team_name || 'Opponent')

  const opponentPosition = Number(opponentStandings?.position || 10)
  const leagueSize = Number(opponentStandings?.league_size || opponentStandings?.total_teams || 20)
  const opponentZone = opponentStandings?.zone
    ? String(opponentStandings.zone)
    : inferOpponentZone(opponentPosition, leagueSize)

  // -----------------------------------------------------------------------
  // Safety score calculation
  // -----------------------------------------------------------------------
  const riskFactors: string[] = []
  let safety = SAFETY_BASE

  // 1. Home advantage
  if (isHome) {
    safety += SAFETY_MODIFIERS.HOME_ADVANTAGE
  }

  // 2. Form analysis - penalize recent losses or draws
  if (dominantTeam.form_last5.length > 0) {
    const hasRecentLoss = dominantTeam.form_last5.slice(0, 3).includes('L')
    const hasRecentDraw = dominantTeam.form_last5.slice(0, 3).includes('D')
    if (hasRecentLoss) {
      safety += SAFETY_MODIFIERS.FORM_LOSS_PENALTY
      riskFactors.push('Loss in last 3 matches')
    }
    if (hasRecentDraw) {
      safety += SAFETY_MODIFIERS.FORM_DRAW_PENALTY
      riskFactors.push('Draw in last 3 matches')
    }
  }

  // 3. Opponent strength based on league position
  //    opponentRelative is position/leagueSize: lower = stronger opponent
  const opponentRelative = opponentPosition / leagueSize
  if (opponentRelative <= 0.15) {
    // Top 3 in a 20-team league
    safety += SAFETY_MODIFIERS.OPPONENT_TOP_3
    riskFactors.push(`Opponent in top 3 (pos ${opponentPosition})`)
  } else if (opponentRelative <= 0.3) {
    // Top 6
    safety += SAFETY_MODIFIERS.OPPONENT_TOP_6
    riskFactors.push(`Opponent in top 6 (pos ${opponentPosition})`)
  } else if (opponentRelative <= 0.5) {
    // Upper mid-table, no modifier
  } else if (opponentRelative <= 0.7) {
    // Lower mid-table / bottom half
    safety += SAFETY_MODIFIERS.OPPONENT_BOTTOM_HALF
  } else if (opponentRelative <= 0.85) {
    // Near relegation
    safety += SAFETY_MODIFIERS.OPPONENT_BOTTOM_3
  } else {
    // Relegation zone (bottom ~15%)
    safety += SAFETY_MODIFIERS.OPPONENT_RELEGATION
  }

  // 4. European / fixture congestion
  // We detect congestion from the fixture itself or from schedule context
  const hasCongestion = fixture.fixture_congestion_7d >= 3 ||
    fixture.has_midweek_european === true ||
    fixture.days_since_last_match < 3
  if (hasCongestion) {
    safety += SAFETY_MODIFIERS.CONGESTION_PENALTY
    riskFactors.push('Fixture congestion or midweek European match')
  }

  // 5. Key injuries
  const keyInjuries = (injuries || []).filter((inj: any) => {
    const isKeyPlayer = inj.player?.is_key_player || inj.is_key_player
    const isOut = inj.status === 'out' || inj.status === 'doubtful' || inj.availability === 'out'
    return isKeyPlayer && isOut
  })
  if (keyInjuries.length > 0) {
    const injPenalty = Math.min(keyInjuries.length, 3) * SAFETY_MODIFIERS.KEY_INJURY_PENALTY
    safety += injPenalty
    riskFactors.push(`${keyInjuries.length} key player(s) injured/doubtful`)
  }

  // 6. Weather
  if (weather) {
    const impactScore = Number(weather.weather_impact_score || 0)
    const rain = Number(weather.pre_rain_mm || 0)
    const wind = Number(weather.pre_wind_speed || 0)
    if (impactScore > 0.5 || rain > 5 || wind > 12) {
      safety += SAFETY_MODIFIERS.BAD_WEATHER_PENALTY
      riskFactors.push('Adverse weather conditions')
    }
  }

  // 7. Prediction engine confidence boost
  if (prediction) {
    const relevantProb = isHome
      ? Number(prediction.home_win_prob || 0)
      : Number(prediction.away_win_prob || 0)
    const confidence = Number(prediction.confidence_score || 0)
    if (relevantProb > 70 && confidence > 60) {
      safety += SAFETY_MODIFIERS.PREDICTION_HIGH_CONF
    } else if (relevantProb > 55 && confidence > 40) {
      safety += SAFETY_MODIFIERS.PREDICTION_MED_CONF
    }
  }

  // 8. Dominance level bonus
  if (dominantTeam.dominance_level === 'ultra') {
    safety += SAFETY_MODIFIERS.ULTRA_DOMINANCE_BONUS
  } else if (dominantTeam.dominance_level === 'strong') {
    safety += SAFETY_MODIFIERS.STRONG_DOMINANCE_BONUS
  }

  // 9. Clean sheet track record bonus
  if (dominantTeam.clean_sheet_pct > 0.5) {
    safety += SAFETY_MODIFIERS.CLEAN_SHEET_BONUS
  }

  // 10. Opponent away/home weakness bonus
  if (opponentStandings) {
    const oppRelevantWinRate = isHome
      ? Number(opponentStandings.away_win_rate || (
          Number(opponentStandings.away_won || 0) / Math.max(Number(opponentStandings.away_played || 1), 1)
        ))
      : Number(opponentStandings.home_win_rate || (
          Number(opponentStandings.home_won || 0) / Math.max(Number(opponentStandings.home_played || 1), 1)
        ))
    if (oppRelevantWinRate < 0.25) {
      safety += SAFETY_MODIFIERS.AWAY_WEAKNESS_BONUS
      // opponent is weak in the relevant venue context
    }
  }

  // Clamp safety
  safety = clamp(Math.round(safety), 0, 100)

  // -----------------------------------------------------------------------
  // Determine recommended market
  // -----------------------------------------------------------------------
  let recommendedMarket: AccumulatorPick['recommended_market']
  if (safety >= 80) {
    recommendedMarket = isHome ? 'home_win' : 'away_win'
  } else if (safety >= 65) {
    // Still recommend outright win but with awareness
    recommendedMarket = isHome ? 'home_win' : 'away_win'
  } else if (safety >= 50) {
    recommendedMarket = 'double_chance'
  } else {
    // Safer fallback markets
    recommendedMarket = dominantTeam.avg_goals_scored > 1.5 ? 'over_15' : 'over_05'
  }

  // -----------------------------------------------------------------------
  // Minimum odds threshold
  // -----------------------------------------------------------------------
  // Base the threshold on the estimated match win probability and typical acca legs
  const predConfidence = prediction ? Number(prediction.confidence_score || 0) : null
  const matchWinProb = estimateMatchWinProb(dominantTeam, isHome, opponentPosition, leagueSize, predConfidence)
  // For the recommended market, use the match win prob for win markets, adjust for others
  let marketProb = matchWinProb
  if (recommendedMarket === 'double_chance') {
    marketProb = Math.min(0.99, matchWinProb + dominantTeam.draw_rate * 0.8)
  } else if (recommendedMarket === 'over_15') {
    marketProb = Math.min(0.99, 0.8 + dominantTeam.avg_goals_scored * 0.05)
  } else if (recommendedMarket === 'over_05') {
    marketProb = Math.min(0.99, 0.92 + dominantTeam.avg_goals_scored * 0.02)
  }

  // Minimum odds = breakeven for a 4-leg acca with 5% margin, expressed per leg
  const minOddsThreshold = Number(calculateMinOddsPerLeg(marketProb, 4, 0.05).toFixed(3))

  // -----------------------------------------------------------------------
  // Current odds and value assessment
  // -----------------------------------------------------------------------
  let currentOdds: number | null = null
  if (odds) {
    if (recommendedMarket === 'home_win') {
      currentOdds = Number(odds.best_home_odds || odds.home_odds || null) || null
    } else if (recommendedMarket === 'away_win') {
      currentOdds = Number(odds.best_away_odds || odds.away_odds || null) || null
    } else if (recommendedMarket === 'double_chance') {
      // Double chance odds might be stored differently; estimate from 1X or X2
      currentOdds = Number(odds.double_chance_home_draw || odds.dc_1x || null) || null
    } else if (recommendedMarket === 'over_15') {
      currentOdds = Number(odds.over_15_odds || null) || null
    } else if (recommendedMarket === 'over_05') {
      currentOdds = Number(odds.over_05_odds || null) || null
    }
  }

  const isValue = currentOdds !== null && currentOdds > minOddsThreshold

  // -----------------------------------------------------------------------
  // Confidence classification
  // -----------------------------------------------------------------------
  let confidence: AccumulatorPick['confidence']
  if (safety >= 80 && dominantTeam.dominance_level === 'ultra') {
    confidence = 'very_high'
  } else if (safety >= 70) {
    confidence = 'high'
  } else {
    confidence = 'medium'
  }

  return {
    fixture_id: String(fixture.id || fixture.fixture_id || ''),
    team_id: dominantTeam.team_id,
    team_name: dominantTeam.team_name,
    opponent_name: opponentName,
    league_name: dominantTeam.league_name,
    match_date: String(fixture.match_date || fixture.date || ''),
    is_home: isHome,
    dominance_score: dominantTeam.dominance_score,
    opponent_position: opponentPosition,
    opponent_zone: opponentZone,
    safety_score: safety,
    risk_factors: riskFactors,
    recommended_market: recommendedMarket,
    min_odds_threshold: minOddsThreshold,
    current_odds: currentOdds,
    is_value: isValue,
    confidence,
  }
}

/**
 * Build optimal accumulator combinations from a set of assessed picks.
 *
 * Uses a greedy/combinatorial approach:
 * 1. Filter picks by minimum safety score.
 * 2. Generate all valid combinations within the leg-count range.
 * 3. Score each combination by expected value and risk.
 * 4. Return the best combinations sorted by expected value.
 *
 * For large pick sets, limits the search space to the top picks by safety score.
 */
export function buildAccumulatorCombos(
  picks: AccumulatorPick[],
  options?: {
    maxLegs?: number
    minLegs?: number
    minSafety?: number
    maxRisk?: 'conservative' | 'moderate' | 'aggressive'
    targetOdds?: number
  }
): AccumulatorCombo[] {
  const maxLegs = options?.maxLegs ?? 5
  const minLegs = options?.minLegs ?? 3
  const minSafety = options?.minSafety ?? 70
  const maxRisk = options?.maxRisk ?? 'moderate'
  const targetOdds = options?.targetOdds ?? 0

  // Filter picks by minimum safety
  const eligible = picks
    .filter(p => p.safety_score >= minSafety)
    .sort((a, b) => b.safety_score - a.safety_score)

  if (eligible.length < minLegs) return []

  // Limit the candidate pool to prevent combinatorial explosion
  // For conservative: top 8, moderate: top 10, aggressive: top 15
  const poolSize = maxRisk === 'conservative' ? 8 : maxRisk === 'moderate' ? 10 : 15
  const pool = eligible.slice(0, poolSize)

  // Ensure only one pick per league to diversify risk
  // (unless aggressive mode allows same-league stacking)
  const diversifiedPool = maxRisk === 'aggressive'
    ? pool
    : deduplicateByLeague(pool)

  // Generate combinations
  const allCombos: AccumulatorCombo[] = []

  for (let legs = minLegs; legs <= Math.min(maxLegs, diversifiedPool.length); legs++) {
    const combinations = generateCombinations(diversifiedPool, legs)

    for (const combo of combinations) {
      const result = scoreCombo(combo, maxRisk, targetOdds)
      if (result) {
        allCombos.push(result)
      }
    }
  }

  // Sort by expected value descending, then by risk ascending
  allCombos.sort((a, b) => {
    if (Math.abs(a.expected_value - b.expected_value) > 0.01) {
      return b.expected_value - a.expected_value
    }
    const riskOrder = { conservative: 0, moderate: 1, aggressive: 2 }
    return riskOrder[a.risk_level] - riskOrder[b.risk_level]
  })

  // Return top combos (limit to prevent excessive output)
  return allCombos.slice(0, 20)
}

/**
 * Simulate accumulator profitability over a full season.
 *
 * @param avgWinProbPerLeg - Average probability that each individual leg wins (0-1).
 * @param avgLegsPerCombo - Average number of legs per accumulator.
 * @param avgTotalOdds - Average combined decimal odds per accumulator.
 * @param combosPerWeek - How many accumulators placed per week.
 * @param weeksInSeason - Number of active weeks in the season.
 * @returns Season simulation statistics.
 */
export function simulateAccumulatorSeason(
  avgWinProbPerLeg: number,
  avgLegsPerCombo: number,
  avgTotalOdds: number,
  combosPerWeek: number,
  weeksInSeason: number
): AccumulatorCombo['season_simulation'] {
  // Probability that all legs in a combo win
  const comboWinProb = Math.pow(
    clamp(avgWinProbPerLeg, 0.01, 0.99),
    avgLegsPerCombo
  )

  const totalCombos = combosPerWeek * weeksInSeason
  const expectedWins = comboWinProb * totalCombos
  const expectedLosses = totalCombos - expectedWins

  // Break-even rate: the fraction of combos that must win to not lose money overall
  // If you win, you gain (totalOdds - 1) units; if you lose, you lose 1 unit.
  // breakEven * (totalOdds - 1) = (1 - breakEven) * 1
  // breakEven * totalOdds = 1
  // breakEven = 1 / totalOdds
  const breakEvenRate = avgTotalOdds > 0 ? 1 / avgTotalOdds : 1

  // Expected value per unit staked on one combo:
  // EV = comboWinProb * (totalOdds - 1) - (1 - comboWinProb) * 1
  // EV = comboWinProb * totalOdds - 1
  const evPerCombo = comboWinProb * avgTotalOdds - 1

  // Projected ROI over the season (% return on total staked)
  const totalStaked = totalCombos // 1 unit each
  const totalReturn = expectedWins * avgTotalOdds
  const projectedROI = totalStaked > 0 ? ((totalReturn - totalStaked) / totalStaked) * 100 : 0

  // Maximum consecutive losses (geometric / probabilistic estimate)
  // Expected longest losing streak ~ log(totalCombos) / log(1 / (1 - comboWinProb))
  const loseProb = 1 - comboWinProb
  const maxConsecLosses = loseProb >= 1
    ? totalCombos
    : loseProb <= 0
      ? 0
      : Math.ceil(Math.log(totalCombos) / Math.log(1 / loseProb))

  // Recovery bets after a single loss: how many wins needed to recover 1 unit lost
  // Each win gains (totalOdds - 1) units, so need ceil(1 / (totalOdds - 1)) wins
  const netGainPerWin = avgTotalOdds - 1
  const recoveryBets = netGainPerWin > 0 ? Math.ceil(1 / netGainPerWin) : Infinity

  return {
    expected_wins: Number(expectedWins.toFixed(2)),
    expected_losses: Number(expectedLosses.toFixed(2)),
    break_even_rate: Number(breakEvenRate.toFixed(4)),
    projected_roi: Number(projectedROI.toFixed(2)),
    max_consecutive_losses: maxConsecLosses,
    recovery_bets_after_loss: recoveryBets === Infinity ? 999 : recoveryBets,
  }
}

// ---------------------------------------------------------------------------
// Internal combinatorial helpers
// ---------------------------------------------------------------------------

/**
 * Remove duplicate leagues from the pool, keeping the highest-safety pick per league.
 * This ensures league diversification in accumulators.
 */
function deduplicateByLeague(picks: AccumulatorPick[]): AccumulatorPick[] {
  const seen = new Map<string, AccumulatorPick>()
  for (const pick of picks) {
    const key = pick.league_name
    const existing = seen.get(key)
    if (!existing || pick.safety_score > existing.safety_score) {
      seen.set(key, pick)
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.safety_score - a.safety_score)
}

/**
 * Generate all k-element combinations from a pool.
 * Limited to avoid memory issues: if the number of combinations exceeds 5000, returns
 * only the top combinations by greedily picking high-safety picks.
 */
function generateCombinations(pool: AccumulatorPick[], k: number): AccumulatorPick[][] {
  // Calculate the total number of combinations to check feasibility
  const totalCombinations = binomial(pool.length, k)
  if (totalCombinations > 5000) {
    // Fall back to greedy: take top-k, then slide window
    return greedyCombinations(pool, k, 100)
  }

  const results: AccumulatorPick[][] = []

  function backtrack(start: number, current: AccumulatorPick[]) {
    if (current.length === k) {
      results.push([...current])
      return
    }
    for (let i = start; i < pool.length; i++) {
      current.push(pool[i])
      backtrack(i + 1, current)
      current.pop()
    }
  }

  backtrack(0, [])
  return results
}

/**
 * Binomial coefficient C(n, k).
 */
function binomial(n: number, k: number): number {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1
  let result = 1
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1)
  }
  return Math.round(result)
}

/**
 * Generate a limited set of combinations using a greedy sliding-window approach.
 * Picks are already sorted by safety_score descending.
 */
function greedyCombinations(pool: AccumulatorPick[], k: number, maxResults: number): AccumulatorPick[][] {
  const results: AccumulatorPick[][] = []

  // Always include the top-k combination
  if (pool.length >= k) {
    results.push(pool.slice(0, k))
  }

  // Slide: replace each position with the next available pick
  for (let excludeIdx = 0; excludeIdx < Math.min(pool.length, k + 5); excludeIdx++) {
    if (results.length >= maxResults) break
    const filtered = pool.filter((_, idx) => idx !== excludeIdx)
    if (filtered.length >= k) {
      const combo = filtered.slice(0, k)
      // Check we haven't already added this combo
      const comboKey = combo.map(p => p.fixture_id).sort().join(',')
      const isDuplicate = results.some(
        r => r.map(p => p.fixture_id).sort().join(',') === comboKey
      )
      if (!isDuplicate) {
        results.push(combo)
      }
    }
  }

  // Also try combinations with the next-best picks swapped in
  for (let i = 0; i < Math.min(pool.length - k, 10); i++) {
    if (results.length >= maxResults) break
    for (let j = 0; j < k; j++) {
      if (results.length >= maxResults) break
      const combo = [...pool.slice(0, k)]
      combo[j] = pool[k + i]
      if (!combo[j]) continue
      combo.sort((a, b) => b.safety_score - a.safety_score)
      const comboKey = combo.map(p => p.fixture_id).sort().join(',')
      const isDuplicate = results.some(
        r => r.map(p => p.fixture_id).sort().join(',') === comboKey
      )
      if (!isDuplicate) {
        results.push(combo)
      }
    }
  }

  return results
}

/**
 * Score a combination of picks and produce an AccumulatorCombo.
 * Returns null if the combo does not meet the risk threshold.
 */
function scoreCombo(
  picks: AccumulatorPick[],
  maxRisk: 'conservative' | 'moderate' | 'aggressive',
  targetOdds: number
): AccumulatorCombo | null {
  const legs = picks.length

  // Estimate individual leg win probabilities from safety scores
  // Safety 100 ~ 95% win prob, Safety 70 ~ 80%, Safety 50 ~ 65%
  const legWinProbs = picks.map(p => {
    // Map safety score to estimated win probability
    // Using a calibrated curve: winProb = 0.5 + (safety / 100) * 0.45
    // Safety 100 -> 0.95, Safety 80 -> 0.86, Safety 70 -> 0.815, Safety 50 -> 0.725
    return clamp(0.5 + (p.safety_score / 100) * 0.45, 0.5, 0.97)
  })

  // Combined win probability
  const expectedWinRate = legWinProbs.reduce((acc, p) => acc * p, 1)

  // Total odds: use current odds if available, otherwise estimate from win probability
  const legOdds = picks.map((p, i) => {
    if (p.current_odds && p.current_odds > 1) return p.current_odds
    // Estimate: decimal odds ~ 1 / probability with ~5% bookmaker margin
    return 1 / (legWinProbs[i] * 0.95)
  })

  const totalOdds = Number(legOdds.reduce((acc, o) => acc * o, 1).toFixed(3))

  // Expected value per unit staked
  const expectedValue = Number((expectedWinRate * totalOdds - 1).toFixed(4))

  // Skip negative EV combos in conservative mode
  if (maxRisk === 'conservative' && expectedValue < 0) return null
  if (maxRisk === 'moderate' && expectedValue < -0.1) return null

  // If there is a target odds, filter combos that are too far off
  if (targetOdds > 0) {
    const oddsDeviation = Math.abs(totalOdds - targetOdds) / targetOdds
    if (oddsDeviation > 0.5) return null // more than 50% off target
  }

  // Risk level classification
  let riskLevel: AccumulatorCombo['risk_level']
  if (legs <= 3 && expectedWinRate > 0.6) {
    riskLevel = 'conservative'
  } else if (legs <= 4 && expectedWinRate > 0.4) {
    riskLevel = 'moderate'
  } else {
    riskLevel = 'aggressive'
  }

  // Filter by max risk
  const riskOrder = { conservative: 0, moderate: 1, aggressive: 2 }
  if (riskOrder[riskLevel] > riskOrder[maxRisk]) return null

  // Suggested stake % of bankroll (inversely proportional to risk)
  let suggestedStakePct: number
  switch (riskLevel) {
    case 'conservative':
      suggestedStakePct = 2.0
      break
    case 'moderate':
      suggestedStakePct = 1.0
      break
    case 'aggressive':
      suggestedStakePct = 0.5
      break
  }
  // Adjust by expected value: if strongly positive EV, slightly increase
  if (expectedValue > 0.15) {
    suggestedStakePct *= 1.3
  } else if (expectedValue > 0.05) {
    suggestedStakePct *= 1.1
  }
  suggestedStakePct = Number(clamp(suggestedStakePct, 0.25, 3.0).toFixed(2))

  // Run a season simulation using the combo's parameters
  const avgWinProbPerLeg = legWinProbs.reduce((a, b) => a + b, 0) / legs
  const seasonSim = simulateAccumulatorSeason(
    avgWinProbPerLeg,
    legs,
    totalOdds,
    2,   // assume 2 combos per week
    38   // ~38 matchweeks in a season
  )

  return {
    id: generateComboId(picks),
    picks,
    total_odds: totalOdds,
    expected_win_rate: Number(expectedWinRate.toFixed(4)),
    expected_value: expectedValue,
    legs,
    risk_level: riskLevel,
    suggested_stake_pct: suggestedStakePct,
    season_simulation: seasonSim,
  }
}
