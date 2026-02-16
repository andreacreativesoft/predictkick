import type { AnalyzerScore, StatsScore, ScoringPatterns } from '@/lib/types/prediction'

export function analyzeStats(
  homeStandings: Record<string, unknown> | null,
  awayStandings: Record<string, unknown> | null
): StatsScore {
  const defaultScore: StatsScore = {
    home: 0.4, draw: 0.3, away: 0.3,
    confidence: 0.3,
    details: {},
    homeAwayDiff: 0,
    patterns: { homeEarlyGoals: 0, homeLateGoals: 0, awayEarlyGoals: 0, awayLateGoals: 0, homeSetPieces: 0, awaySetPieces: 0 },
    formScore: 0.5,
    seasonScore: 0.5,
  }

  if (!homeStandings || !awayStandings) return defaultScore

  const home = homeStandings as Record<string, number | string | string[] | null>
  const away = awayStandings as Record<string, number | string | string[] | null>

  // Form analysis (last 5 results)
  const homeForm = (home.form_last5 as string[] || [])
  const awayForm = (away.form_last5 as string[] || [])

  const formPoints = (form: string[]): number => {
    return form.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0) / Math.max(form.length * 3, 1)
  }

  const homeFormScore = formPoints(homeForm)
  const awayFormScore = formPoints(awayForm)

  // PPG comparison
  const homePPG = Number(home.ppg || 0)
  const awayPPG = Number(away.ppg || 0)
  const ppgDiff = homePPG - awayPPG
  const maxPPG = Math.max(homePPG, awayPPG, 1)

  // Goal stats
  const homeAvgScored = Number(home.avg_goals_scored || 1.3)
  const homeAvgConceded = Number(home.avg_goals_conceded || 1.1)
  const awayAvgScored = Number(away.avg_goals_scored || 1.1)
  const awayAvgConceded = Number(away.avg_goals_conceded || 1.3)

  // xG if available
  const homeXG = Number(home.xg_for || homeAvgScored)
  const awayXG = Number(away.xg_for || awayAvgScored)

  // Home advantage factor (typically +7-10% for home team)
  const homeAdvantage = 0.08

  // Calculate raw probabilities
  const homeStrength = (homeFormScore * 0.3 + (homePPG / maxPPG) * 0.3 + (homeXG / (homeXG + awayXG + 0.01)) * 0.4)
  const awayStrength = (awayFormScore * 0.3 + (awayPPG / maxPPG) * 0.3 + (awayXG / (homeXG + awayXG + 0.01)) * 0.4)

  let homeWin = homeStrength * 0.5 + homeAdvantage
  let awayWin = awayStrength * 0.5 - homeAdvantage * 0.3
  let draw = 1 - homeWin - awayWin

  // Clamp
  homeWin = Math.max(0.1, Math.min(0.8, homeWin))
  awayWin = Math.max(0.05, Math.min(0.7, awayWin))
  draw = Math.max(0.1, Math.min(0.4, draw))

  // Normalize
  const total = homeWin + draw + awayWin
  homeWin /= total
  draw /= total
  awayWin /= total

  // Confidence based on data quality
  const played = Number(home.played || 0) + Number(away.played || 0)
  const confidence = Math.min(1, played / 40)

  // Scoring patterns
  const patterns: ScoringPatterns = {
    homeEarlyGoals: (Number(home.goals_0_15 || 0) + Number(home.goals_16_30 || 0)) / Math.max(Number(home.goals_for || 1), 1),
    homeLateGoals: (Number(home.goals_61_75 || 0) + Number(home.goals_76_90 || 0)) / Math.max(Number(home.goals_for || 1), 1),
    awayEarlyGoals: (Number(away.goals_0_15 || 0) + Number(away.goals_16_30 || 0)) / Math.max(Number(away.goals_for || 1), 1),
    awayLateGoals: (Number(away.goals_61_75 || 0) + Number(away.goals_76_90 || 0)) / Math.max(Number(away.goals_for || 1), 1),
    homeSetPieces: 0,
    awaySetPieces: 0,
  }

  return {
    home: homeWin,
    draw,
    away: awayWin,
    confidence,
    details: { homePPG, awayPPG, homeXG, awayXG, homeFormScore, awayFormScore },
    homeAwayDiff: ppgDiff,
    patterns,
    formScore: (homeFormScore + awayFormScore) / 2,
    seasonScore: (homePPG + awayPPG) / 6,
  }
}
