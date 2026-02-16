// Convert decimal odds to implied probability
export function oddsToImpliedProbability(odds: number): number {
  return 1 / odds
}

// Convert probability to decimal odds
export function probabilityToOdds(probability: number): number {
  if (probability <= 0) return Infinity
  return 1 / probability
}

// Remove bookmaker margin (overround) from odds
// Accepts 3 separate numbers OR an array of 3 numbers
export function removeOverround(
  homeOddsOrArray: number | [number, number, number],
  drawOdds?: number,
  awayOdds?: number
): [number, number, number] {
  const h = Array.isArray(homeOddsOrArray) ? homeOddsOrArray[0] : homeOddsOrArray
  const d = Array.isArray(homeOddsOrArray) ? homeOddsOrArray[1] : (drawOdds ?? 3.3)
  const a = Array.isArray(homeOddsOrArray) ? homeOddsOrArray[2] : (awayOdds ?? 3.0)

  const totalImplied =
    oddsToImpliedProbability(h) +
    oddsToImpliedProbability(d) +
    oddsToImpliedProbability(a)

  return [
    oddsToImpliedProbability(h) / totalImplied,
    oddsToImpliedProbability(d) / totalImplied,
    oddsToImpliedProbability(a) / totalImplied,
  ]
}

// Calculate bookmaker overround (margin)
export function calculateOverround(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number
): number {
  return (
    oddsToImpliedProbability(homeOdds) +
    oddsToImpliedProbability(drawOdds) +
    oddsToImpliedProbability(awayOdds) -
    1
  )
}

// Calculate Kelly Criterion fraction
export function kellyFraction(
  probability: number,
  odds: number
): number {
  const kelly = (probability * odds - 1) / (odds - 1)
  return Math.max(0, kelly) // Never negative (don't bet against)
}

// Calculate edge (our probability vs implied from odds)
export function calculateEdge(
  ourProbability: number,
  bookmakerOddsOrImpliedProb: number
): number {
  // If the second arg is > 1, treat as decimal odds and convert
  // If <= 1, treat as already-implied probability
  const impliedProbability = bookmakerOddsOrImpliedProb > 1
    ? oddsToImpliedProbability(bookmakerOddsOrImpliedProb)
    : bookmakerOddsOrImpliedProb
  return ourProbability - impliedProbability
}

// Normalize probabilities to sum to 1
// Accepts 3 separate numbers OR an object
export function normalizeProbabilities(
  homeOrProbs: number | { home: number; draw: number; away: number },
  drawArg?: number,
  awayArg?: number
): { home: number; draw: number; away: number } {
  const home = typeof homeOrProbs === 'number' ? homeOrProbs : homeOrProbs.home
  const draw = typeof homeOrProbs === 'number' ? (drawArg ?? 0) : homeOrProbs.draw
  const away = typeof homeOrProbs === 'number' ? (awayArg ?? 0) : homeOrProbs.away
  const total = home + draw + away
  if (total === 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 }
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
  }
}

// Poisson probability for exact score prediction
export function poissonProbability(
  lambda: number,
  k: number
): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

function factorial(n: number): number {
  if (n <= 1) return 1
  let result = 1
  for (let i = 2; i <= n; i++) result *= i
  return result
}

// Generate score probabilities from expected goals
export function generateScoreProbabilities(
  homeXG: number,
  awayXG: number,
  maxGoals: number = 6
): Array<{ home: number; away: number; homeGoals: number; awayGoals: number; probability: number }> {
  const scores: Array<{ home: number; away: number; homeGoals: number; awayGoals: number; probability: number }> = []

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      scores.push({
        home: h,
        away: a,
        homeGoals: h,
        awayGoals: a,
        probability: poissonProbability(homeXG, h) * poissonProbability(awayXG, a),
      })
    }
  }

  return scores.sort((a, b) => b.probability - a.probability)
}
