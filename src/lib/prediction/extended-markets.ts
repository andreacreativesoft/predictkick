/**
 * Extended Markets Calculator
 *
 * Calculates probabilities for all betting markets using:
 * - Poisson model for goal-based markets
 * - Historical stats for corners and cards
 * - Referee data for card adjustments
 * - Team form for scoring pattern markets
 */

import { poissonProbability } from '@/lib/utils/probability'

// ==========================================
// Types
// ==========================================

export interface ExtendedMarkets {
  // Goal lines
  over_05: number
  over_15: number
  over_25: number
  over_35: number
  over_45: number

  // BTTS
  btts_yes: number
  btts_no: number

  // Double Chance
  home_or_draw: number   // 1X
  away_or_draw: number   // X2
  home_or_away: number   // 12

  // Draw No Bet
  dnb_home: number
  dnb_away: number

  // Half-time markets
  ht_over_05: number
  ht_over_15: number
  ht_btts_yes: number

  // Combo markets
  btts_over_25: number
  btts_under_35: number

  // Corners
  corners_over_85: number
  corners_over_95: number
  corners_over_105: number
  corners_over_115: number
  expected_corners: number

  // Cards
  cards_over_25: number
  cards_over_35: number
  cards_over_45: number
  cards_over_55: number
  expected_cards: number

  // First/Last goal
  home_first_goal: number
  away_first_goal: number
  no_goal: number

  // Clean sheets
  home_clean_sheet: number
  away_clean_sheet: number

  // Win to nil
  home_win_to_nil: number
  away_win_to_nil: number

  // Exact goals
  total_0_goals: number
  total_1_goal: number
  total_2_goals: number
  total_3_goals: number
  total_4plus_goals: number

  // Best pick recommendation
  best_pick: BestPick | null
  top_picks: BestPick[]
}

export interface BestPick {
  market: string        // e.g. "Peste 2.5 Goluri"
  selection: string     // e.g. "Da"
  probability: number   // Our probability (0-1)
  fair_odds: number     // Fair odds based on our probability
  confidence: 'foarte ridicată' | 'ridicată' | 'medie' | 'scăzută'
  reasoning: string     // Why this pick
  category: string      // 'goluri' | 'cornere' | 'cartonașe' | 'rezultat' | 'combo'
  edge?: number         // Edge vs bookmaker if odds available
  bookmaker_odds?: number
}

// ==========================================
// Score Probability Grid (Poisson)
// ==========================================

function buildScoreGrid(homeXG: number, awayXG: number, maxGoals = 8) {
  const grid: number[][] = []
  for (let h = 0; h <= maxGoals; h++) {
    grid[h] = []
    for (let a = 0; a <= maxGoals; a++) {
      grid[h][a] = poissonProbability(homeXG, h) * poissonProbability(awayXG, a)
    }
  }
  return grid
}

function sumIf(grid: number[][], predicate: (h: number, a: number) => boolean): number {
  let sum = 0
  for (let h = 0; h < grid.length; h++) {
    for (let a = 0; a < grid[h].length; a++) {
      if (predicate(h, a)) sum += grid[h][a]
    }
  }
  return sum
}

// ==========================================
// Goal-Based Markets
// ==========================================

function calculateGoalMarkets(grid: number[][]) {
  return {
    over_05: sumIf(grid, (h, a) => h + a > 0.5),
    over_15: sumIf(grid, (h, a) => h + a > 1.5),
    over_25: sumIf(grid, (h, a) => h + a > 2.5),
    over_35: sumIf(grid, (h, a) => h + a > 3.5),
    over_45: sumIf(grid, (h, a) => h + a > 4.5),
    btts_yes: sumIf(grid, (h, a) => h > 0 && a > 0),
    btts_no: sumIf(grid, (h, a) => h === 0 || a === 0),
    total_0_goals: sumIf(grid, (h, a) => h + a === 0),
    total_1_goal: sumIf(grid, (h, a) => h + a === 1),
    total_2_goals: sumIf(grid, (h, a) => h + a === 2),
    total_3_goals: sumIf(grid, (h, a) => h + a === 3),
    total_4plus_goals: sumIf(grid, (h, a) => h + a >= 4),
    no_goal: sumIf(grid, (h, a) => h + a === 0),
  }
}

// ==========================================
// Result-Based Markets
// ==========================================

function calculateResultMarkets(grid: number[][]) {
  const homeWin = sumIf(grid, (h, a) => h > a)
  const draw = sumIf(grid, (h, a) => h === a)
  const awayWin = sumIf(grid, (h, a) => h < a)

  return {
    home_or_draw: homeWin + draw,
    away_or_draw: awayWin + draw,
    home_or_away: homeWin + awayWin,
    dnb_home: homeWin / (homeWin + awayWin),   // Excludes draw
    dnb_away: awayWin / (homeWin + awayWin),
    home_clean_sheet: sumIf(grid, (_, a) => a === 0),
    away_clean_sheet: sumIf(grid, (h) => h === 0),
    home_win_to_nil: sumIf(grid, (h, a) => h > 0 && a === 0),
    away_win_to_nil: sumIf(grid, (h, a) => a > 0 && h === 0),
    home_first_goal: 0, // Calculated from Poisson rate below
    away_first_goal: 0,
  }
}

// ==========================================
// Half-Time Markets
// ==========================================

function calculateHTMarkets(homeXG: number, awayXG: number) {
  // First half expected goals ~ 45% of total (slightly less due to tactical setup)
  const htHomeXG = homeXG * 0.43
  const htAwayXG = awayXG * 0.43
  const htGrid = buildScoreGrid(htHomeXG, htAwayXG, 5)

  return {
    ht_over_05: sumIf(htGrid, (h, a) => h + a > 0.5),
    ht_over_15: sumIf(htGrid, (h, a) => h + a > 1.5),
    ht_btts_yes: sumIf(htGrid, (h, a) => h > 0 && a > 0),
  }
}

// ==========================================
// Corners Market
// ==========================================

interface CornerData {
  homeAvgCorners?: number   // Team's avg corners per home game
  awayAvgCorners?: number   // Team's avg corners per away game
  homeAvgCornersAgainst?: number
  awayAvgCornersAgainst?: number
}

function calculateCornerMarkets(data: CornerData) {
  // Default European average: ~10.5 total corners per game
  const homeCorners = data.homeAvgCorners ?? 5.3
  const awayCorners = data.awayAvgCorners ?? 4.8
  const totalExpected = homeCorners + awayCorners

  // Use Poisson approximation for corners (it's reasonable for this range)
  const lambdaCorners = totalExpected

  // Poisson cumulative for corners totals
  let prob_under_85 = 0
  let prob_under_95 = 0
  let prob_under_105 = 0
  let prob_under_115 = 0

  for (let k = 0; k <= 25; k++) {
    const p = poissonProbability(lambdaCorners, k)
    if (k <= 8) prob_under_85 += p
    if (k <= 9) prob_under_95 += p
    if (k <= 10) prob_under_105 += p
    if (k <= 11) prob_under_115 += p
  }

  return {
    corners_over_85: 1 - prob_under_85,
    corners_over_95: 1 - prob_under_95,
    corners_over_105: 1 - prob_under_105,
    corners_over_115: 1 - prob_under_115,
    expected_corners: totalExpected,
  }
}

// ==========================================
// Cards Market
// ==========================================

interface CardData {
  homeAvgYellows?: number    // Team avg yellows at home
  awayAvgYellows?: number    // Team avg yellows away
  refereeAvgYellows?: number // Referee avg yellows per game
  refereeStyle?: string      // lenient/average/strict/card_happy
}

function calculateCardMarkets(data: CardData) {
  // Default averages: ~4.0 yellows per game in top leagues
  const teamAvgCards = (data.homeAvgYellows ?? 2.0) + (data.awayAvgYellows ?? 2.0)
  const refereeAvg = data.refereeAvgYellows ?? 4.0

  // Weight: 60% team stats, 40% referee style
  let expectedCards = teamAvgCards * 0.6 + refereeAvg * 0.4

  // Referee style adjustment
  if (data.refereeStyle === 'strict') expectedCards *= 1.15
  else if (data.refereeStyle === 'card_happy') expectedCards *= 1.3
  else if (data.refereeStyle === 'lenient') expectedCards *= 0.85

  // Poisson cumulative
  let prob_under_25 = 0
  let prob_under_35 = 0
  let prob_under_45 = 0
  let prob_under_55 = 0

  for (let k = 0; k <= 15; k++) {
    const p = poissonProbability(expectedCards, k)
    if (k <= 2) prob_under_25 += p
    if (k <= 3) prob_under_35 += p
    if (k <= 4) prob_under_45 += p
    if (k <= 5) prob_under_55 += p
  }

  return {
    cards_over_25: 1 - prob_under_25,
    cards_over_35: 1 - prob_under_35,
    cards_over_45: 1 - prob_under_45,
    cards_over_55: 1 - prob_under_55,
    expected_cards: Number(expectedCards.toFixed(1)),
  }
}

// ==========================================
// First Goal Probability
// ==========================================

function calculateFirstGoal(homeXG: number, awayXG: number) {
  const totalRate = homeXG + awayXG
  if (totalRate === 0) return { home_first_goal: 0.5, away_first_goal: 0.5 }

  // Probability of scoring first is proportional to scoring rate
  // Then multiply by probability that at least one goal is scored
  const atLeastOneGoal = 1 - Math.exp(-totalRate)

  return {
    home_first_goal: (homeXG / totalRate) * atLeastOneGoal,
    away_first_goal: (awayXG / totalRate) * atLeastOneGoal,
  }
}

// ==========================================
// Best Pick Algorithm
// ==========================================

function findBestPicks(
  markets: Omit<ExtendedMarkets, 'best_pick' | 'top_picks'>,
  homeTeam: string,
  awayTeam: string,
  homeWinProb: number,
  drawProb: number,
  awayWinProb: number,
): BestPick[] {
  const picks: BestPick[] = []

  // Helper to add a pick
  const addPick = (
    market: string,
    selection: string,
    prob: number,
    category: string,
    reasoning: string,
  ) => {
    if (prob < 0.05 || prob > 0.98) return // Skip extreme values

    let confidence: BestPick['confidence']
    if (prob >= 0.75) confidence = 'foarte ridicată'
    else if (prob >= 0.60) confidence = 'ridicată'
    else if (prob >= 0.45) confidence = 'medie'
    else confidence = 'scăzută'

    picks.push({
      market,
      selection,
      probability: prob,
      fair_odds: Number((1 / prob).toFixed(2)),
      confidence,
      reasoning,
      category,
    })
  }

  // Goal markets
  addPick('Peste 0.5 Goluri', 'Da', markets.over_05, 'goluri', 'Probabilitate foarte mare de a vedea cel puțin un gol')
  addPick('Peste 1.5 Goluri', 'Da', markets.over_15, 'goluri', 'Ambele echipe au potențial ofensiv')
  addPick('Peste 2.5 Goluri', 'Da', markets.over_25, 'goluri', 'Echipele au medie mare de goluri')
  addPick('Sub 2.5 Goluri', 'Da', 1 - markets.over_25, 'goluri', 'Echipele sunt defensive / meci tactic')
  addPick('Peste 3.5 Goluri', 'Da', markets.over_35, 'goluri', 'Meci deschis cu multe ocazii așteptate')
  addPick('Sub 3.5 Goluri', 'Da', 1 - markets.over_35, 'goluri', 'Meci echilibrat cu puține goluri așteptate')

  // BTTS
  addPick('GG (Ambele Marchează)', 'Da', markets.btts_yes, 'goluri', 'Ambele echipe au capacitate ofensivă')
  addPick('GG (Ambele Marchează)', 'Nu', markets.btts_no, 'goluri', 'Cel puțin o echipă e vulnerabilă defensiv')

  // Combo
  addPick('GG + Peste 2.5', 'Da', markets.btts_over_25, 'combo', 'Meci deschis cu ambele echipe marcând')
  addPick('GG + Sub 3.5', 'Da', markets.btts_under_35, 'combo', 'Ambele marchează dar meci controlat')

  // Result
  addPick(`Victorie ${homeTeam}`, '1', homeWinProb / 100, 'rezultat', `${homeTeam} e favorită pe teren propriu`)
  addPick('Egal', 'X', drawProb / 100, 'rezultat', 'Echipele sunt foarte echilibrate')
  addPick(`Victorie ${awayTeam}`, '2', awayWinProb / 100, 'rezultat', `${awayTeam} are valoare mai mare`)

  // Double Chance
  addPick('Șansă Dublă 1X', `${homeTeam} sau Egal`, markets.home_or_draw, 'rezultat', `${homeTeam} nu pierde acasă`)
  addPick('Șansă Dublă X2', `Egal sau ${awayTeam}`, markets.away_or_draw, 'rezultat', `${awayTeam} prinde cel puțin egal`)
  addPick('Șansă Dublă 12', 'Fără Egal', markets.home_or_away, 'rezultat', 'Diferență de calitate, egalul improbabil')

  // Clean sheet
  addPick(`${homeTeam} - Fără Gol Primit`, 'Da', markets.home_clean_sheet, 'goluri', `${homeTeam} are apărare solidă`)
  addPick(`${awayTeam} - Fără Gol Primit`, 'Da', markets.away_clean_sheet, 'goluri', `${awayTeam} are apărare solidă`)

  // Half-time
  addPick('Peste 0.5 Goluri R1', 'Da', markets.ht_over_05, 'goluri', 'Gol în prima repriză')
  addPick('Peste 1.5 Goluri R1', 'Da', markets.ht_over_15, 'goluri', 'Mai multe goluri în prima repriză')

  // Corners
  addPick('Cornere Peste 8.5', 'Da', markets.corners_over_85, 'cornere', `${markets.expected_corners.toFixed(1)} cornere așteptate`)
  addPick('Cornere Peste 9.5', 'Da', markets.corners_over_95, 'cornere', `${markets.expected_corners.toFixed(1)} cornere așteptate`)
  addPick('Cornere Peste 10.5', 'Da', markets.corners_over_105, 'cornere', `${markets.expected_corners.toFixed(1)} cornere așteptate`)

  // Cards
  addPick('Cartonașe Peste 2.5', 'Da', markets.cards_over_25, 'cartonașe', `${markets.expected_cards} cartonașe așteptate`)
  addPick('Cartonașe Peste 3.5', 'Da', markets.cards_over_35, 'cartonașe', `${markets.expected_cards} cartonașe așteptate`)
  addPick('Cartonașe Peste 4.5', 'Da', markets.cards_over_45, 'cartonașe', `${markets.expected_cards} cartonașe așteptate`)

  // Sort by probability (highest edge potential first)
  // Best picks are those with high probability at reasonable odds (0.50-0.80 range gives good value)
  picks.sort((a, b) => {
    // Score: prefer picks in the 55-80% range (strong but not too obvious)
    const scoreA = a.probability >= 0.55 && a.probability <= 0.85 ? a.probability * 1.2 : a.probability
    const scoreB = b.probability >= 0.55 && b.probability <= 0.85 ? b.probability * 1.2 : b.probability
    return scoreB - scoreA
  })

  return picks
}

// ==========================================
// Main Calculator
// ==========================================

export interface ExtendedMarketsInput {
  homeXG: number          // Expected home goals
  awayXG: number          // Expected away goals
  homeWinProb: number     // % (0-100)
  drawProb: number        // % (0-100)
  awayWinProb: number     // % (0-100)
  homeTeam: string
  awayTeam: string
  cornerData?: CornerData
  cardData?: CardData
}

export function calculateExtendedMarkets(input: ExtendedMarketsInput): ExtendedMarkets {
  const { homeXG, awayXG, homeTeam, awayTeam, homeWinProb, drawProb, awayWinProb } = input

  // Build Poisson grid
  const grid = buildScoreGrid(homeXG, awayXG)

  // Calculate all market categories
  const goalMarkets = calculateGoalMarkets(grid)
  const resultMarkets = calculateResultMarkets(grid)
  const htMarkets = calculateHTMarkets(homeXG, awayXG)
  const cornerMarkets = calculateCornerMarkets(input.cornerData || {})
  const cardMarkets = calculateCardMarkets(input.cardData || {})
  const firstGoal = calculateFirstGoal(homeXG, awayXG)

  // Combo markets
  const btts_over_25 = sumIf(grid, (h, a) => h > 0 && a > 0 && h + a > 2.5)
  const btts_under_35 = sumIf(grid, (h, a) => h > 0 && a > 0 && h + a < 3.5)

  const markets = {
    ...goalMarkets,
    ...resultMarkets,
    ...htMarkets,
    ...cornerMarkets,
    ...cardMarkets,
    ...firstGoal,
    btts_over_25,
    btts_under_35,
    best_pick: null as BestPick | null,
    top_picks: [] as BestPick[],
  }

  // Find best picks
  const allPicks = findBestPicks(markets, homeTeam, awayTeam, homeWinProb, drawProb, awayWinProb)

  if (allPicks.length > 0) {
    markets.best_pick = allPicks[0]
    markets.top_picks = allPicks.slice(0, 8) // Top 8 picks across all categories
  }

  return markets
}
