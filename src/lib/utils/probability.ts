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
export function removeOverround(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number
): { home: number; draw: number; away: number } {
  const totalImplied =
    oddsToImpliedProbability(homeOdds) +
    oddsToImpliedProbability(drawOdds) +
    oddsToImpliedProbability(awayOdds)

  return {
    home: oddsToImpliedProbability(homeOdds) / totalImplied,
    draw: oddsToImpliedProbability(drawOdds) / totalImplied,
    away: oddsToImpliedProbability(awayOdds) / totalImplied,
  }
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
  const q = 1 - probability
  const kelly = (probability * odds - 1) / (odds - 1)
  return Math.max(0, kelly) // Never negative (don't bet against)
}

// Calculate edge (our probability vs implied)
export function calculateEdge(
  ourProbability: number,
  bookmakerOdds: number
): number {
  const impliedProbability = oddsToImpliedProbability(bookmakerOdds)
  return ourProbability - impliedProbability
}

// Normalize probabilities to sum to 1
export function normalizeProbabilities(probs: {
  home: number
  draw: number
  away: number
}): { home: number; draw: number; away: number } {
  const total = probs.home + probs.draw + probs.away
  return {
    home: probs.home / total,
    draw: probs.draw / total,
    away: probs.away / total,
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
): Array<{ home: number; away: number; probability: number }> {
  const scores: Array<{ home: number; away: number; probability: number }> = []

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      scores.push({
        home: h,
        away: a,
        probability: poissonProbability(homeXG, h) * poissonProbability(awayXG, a),
      })
    }
  }

  return scores.sort((a, b) => b.probability - a.probability)
}
