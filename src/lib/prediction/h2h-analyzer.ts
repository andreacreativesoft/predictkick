import type { AnalyzerScore } from '@/lib/types/prediction'

export function analyzeH2H(
  h2h: Record<string, unknown> | null,
  homeTeamId: string
): AnalyzerScore {
  if (!h2h || !h2h.total_matches || Number(h2h.total_matches) === 0) {
    return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.1, details: { noData: true } }
  }

  const total = Number(h2h.total_matches)
  const isTeamA = h2h.team_a_id === homeTeamId

  const homeWins = Number(isTeamA ? h2h.team_a_wins : h2h.team_b_wins) || 0
  const awayWins = Number(isTeamA ? h2h.team_b_wins : h2h.team_a_wins) || 0
  const draws = Number(h2h.draws) || 0

  let homeProb = homeWins / total
  let drawProb = draws / total
  let awayProb = awayWins / total

  // Regress toward mean (H2H is less reliable with few matches)
  const weight = Math.min(total / 10, 1)
  homeProb = homeProb * weight + 0.4 * (1 - weight)
  drawProb = drawProb * weight + 0.3 * (1 - weight)
  awayProb = awayProb * weight + 0.3 * (1 - weight)

  // Normalize
  const sum = homeProb + drawProb + awayProb
  homeProb /= sum
  drawProb /= sum
  awayProb /= sum

  return {
    home: homeProb,
    draw: drawProb,
    away: awayProb,
    confidence: Math.min(1, total / 10),
    details: {
      totalMatches: total,
      homeWins,
      draws,
      awayWins,
      avgGoals: h2h.avg_goals,
      bttsCount: h2h.btts_count,
      over25Count: h2h.over_25_count,
    },
  }
}
