import type { AnalyzerScore } from '@/lib/types/prediction'

export function analyzeSquad(
  injuries: Array<Record<string, unknown>>,
  homeTeamId: string,
  awayTeamId: string
): AnalyzerScore & { lineupStrength: number } {
  if (!injuries || injuries.length === 0) {
    return {
      home: 0.4, draw: 0.3, away: 0.3,
      confidence: 0.3,
      details: { noInjuryData: true },
      lineupStrength: 1,
    }
  }

  const homeInjuries = injuries.filter(i => i.team_id === homeTeamId)
  const awayInjuries = injuries.filter(i => i.team_id === awayTeamId)

  // Calculate weighted impact
  const calculateImpact = (teamInjuries: Array<Record<string, unknown>>): number => {
    return teamInjuries.reduce((sum, injury) => {
      const player = injury.player as Record<string, unknown> | null
      const impact = Number(player?.impact_score || injury.impact_on_team || 0.3)
      const isKey = Boolean(player?.is_key_player)
      return sum + (isKey ? impact * 1.5 : impact)
    }, 0)
  }

  const homeImpact = calculateImpact(homeInjuries)
  const awayImpact = calculateImpact(awayInjuries)

  // Convert impact to probability adjustment
  const homeAdjust = -(homeImpact * 0.05)
  const awayAdjust = -(awayImpact * 0.05)

  let homeProb = 0.4 + homeAdjust - awayAdjust * 0.3
  let awayProb = 0.3 + awayAdjust - homeAdjust * 0.3
  let drawProb = 0.3

  // More injuries = more draw likelihood
  if (homeImpact + awayImpact > 2) drawProb += 0.03

  const total = homeProb + drawProb + awayProb
  homeProb = Math.max(0.05, homeProb / total)
  drawProb = Math.max(0.05, drawProb / total)
  awayProb = Math.max(0.05, awayProb / total)

  return {
    home: homeProb,
    draw: drawProb,
    away: awayProb,
    confidence: Math.min(1, (homeInjuries.length + awayInjuries.length) / 5),
    details: {
      homeInjuryCount: homeInjuries.length,
      awayInjuryCount: awayInjuries.length,
      homeImpact,
      awayImpact,
    },
    lineupStrength: 1 - (homeImpact + awayImpact) / 10,
  }
}
