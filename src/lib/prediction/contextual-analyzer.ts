import type { AnalyzerScore } from '@/lib/types/prediction'

export function analyzeContextualFactors(
  factors: Array<Record<string, unknown>>,
  homeTeamId: string
): AnalyzerScore {
  if (!factors || factors.length === 0) {
    return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.2, details: { noFactors: true } }
  }

  let homeAdjust = 0
  let awayAdjust = 0
  const appliedFactors: string[] = []

  for (const factor of factors) {
    const isHome = factor.team_id === homeTeamId
    const sentiment = String(factor.sentiment || 'neutral')
    const impact = Number(factor.impact_score || 0.5)
    const type = String(factor.factor_type || 'custom')

    let adjustment = 0

    switch (type) {
      case 'manager_change':
        adjustment = sentiment === 'positive' ? impact * 0.04 : -impact * 0.03
        break
      case 'scandal':
      case 'fan_protest':
      case 'dressing_room_conflict':
        adjustment = -impact * 0.04
        break
      case 'winning_momentum':
        adjustment = impact * 0.03
        break
      case 'losing_spiral':
        adjustment = -impact * 0.05
        break
      case 'derby_intensity':
        adjustment = isHome ? impact * 0.03 : -impact * 0.01
        break
      case 'revenge_motivation':
        adjustment = impact * 0.02
        break
      case 'nothing_to_play_for':
        adjustment = -impact * 0.04
        break
      case 'relegation_pressure':
        adjustment = isHome ? impact * 0.05 : -impact * 0.02
        break
      case 'title_pressure':
        adjustment = impact * 0.02
        break
      default:
        adjustment = sentiment === 'positive' ? impact * 0.02 : sentiment === 'negative' ? -impact * 0.02 : 0
    }

    if (isHome) homeAdjust += adjustment
    else awayAdjust += adjustment

    appliedFactors.push(`${type}: ${sentiment} (${(adjustment * 100).toFixed(1)}%)`)
  }

  let homeProb = 0.4 + homeAdjust
  let awayProb = 0.3 + awayAdjust
  let drawProb = 0.3

  const total = homeProb + drawProb + awayProb
  homeProb /= total
  drawProb /= total
  awayProb /= total

  return {
    home: homeProb,
    draw: drawProb,
    away: awayProb,
    confidence: Math.min(1, factors.length / 5),
    details: { factorsApplied: appliedFactors, count: factors.length },
  }
}
