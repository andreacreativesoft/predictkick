import type { AnalyzerScore } from '@/lib/types/prediction'

export function analyzeCrossCompetition(
  homeSchedule: Record<string, unknown> | null,
  awaySchedule: Record<string, unknown> | null
): AnalyzerScore & { fatigue: number; travel: number } {
  const defaultResult = {
    home: 0.4, draw: 0.3, away: 0.3,
    confidence: 0.3,
    details: {},
    fatigue: 0.3,
    travel: 0,
  }

  if (!homeSchedule && !awaySchedule) return defaultResult

  let homeAdjust = 0
  let awayAdjust = 0

  const homeFatigue = Number(homeSchedule?.fatigue_score || 0.3)
  const awayFatigue = Number(awaySchedule?.fatigue_score || 0.3)
  const homeRotation = Number(homeSchedule?.rotation_risk || 0.2)
  const awayRotation = Number(awaySchedule?.rotation_risk || 0.2)
  const homeCongestion7d = Number(homeSchedule?.fixture_congestion_7d || 0)
  const awayCongestion7d = Number(awaySchedule?.fixture_congestion_7d || 0)

  // Fatigue impact
  if (homeFatigue > 0.7) homeAdjust -= 0.05
  else if (homeFatigue > 0.5) homeAdjust -= 0.02

  if (awayFatigue > 0.7) awayAdjust -= 0.05
  else if (awayFatigue > 0.5) awayAdjust -= 0.02

  // Rotation risk impacts performance
  if (homeRotation > 0.6) homeAdjust -= 0.03
  if (awayRotation > 0.6) awayAdjust -= 0.03

  // Congestion
  if (homeCongestion7d >= 3) homeAdjust -= 0.04
  if (awayCongestion7d >= 3) awayAdjust -= 0.04

  let homeProb = 0.4 + homeAdjust - awayAdjust * 0.5
  let awayProb = 0.3 + awayAdjust - homeAdjust * 0.5
  let drawProb = 0.3

  // Fatigue tends to increase draws
  const fatigueSum = homeFatigue + awayFatigue
  if (fatigueSum > 1.2) drawProb += 0.03

  const total = homeProb + drawProb + awayProb
  homeProb /= total
  drawProb /= total
  awayProb /= total

  return {
    home: homeProb,
    draw: drawProb,
    away: awayProb,
    confidence: 0.5,
    details: {
      homeFatigue, awayFatigue,
      homeRotation, awayRotation,
      homeCongestion7d, awayCongestion7d,
    },
    fatigue: (homeFatigue + awayFatigue) / 2,
    travel: Number(homeSchedule?.prev_match_travel_km || 0),
  }
}
