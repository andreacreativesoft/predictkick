import type { AnalyzerScore } from '@/lib/types/prediction'

export function analyzePositionContext(
  homeStandings: Record<string, unknown> | null,
  awayStandings: Record<string, unknown> | null
): AnalyzerScore {
  if (!homeStandings || !awayStandings) {
    return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.2, details: {} }
  }

  const homeZone = String(homeStandings.zone || 'mid_table')
  const awayZone = String(awayStandings.zone || 'mid_table')

  let homeBoost = 0
  let awayBoost = 0
  const details: Record<string, unknown> = { homeZone, awayZone }

  // Home team modifiers
  switch (homeZone) {
    case 'champion':
      homeBoost += 0.05
      details.homeMotivation = 'title_contender'
      break
    case 'cl_qualify':
      homeBoost += 0.03
      details.homeMotivation = 'cl_race'
      break
    case 'relegation':
      homeBoost += 0.07 // desperate home advantage
      details.homeMotivation = 'relegation_fight_home'
      break
    case 'relegation_playoff':
      homeBoost += 0.04
      details.homeMotivation = 'relegation_battle'
      break
    case 'mid_table':
      homeBoost -= 0.02
      details.homeMotivation = 'mid_table_apathy'
      break
  }

  // Away team modifiers
  switch (awayZone) {
    case 'champion':
      awayBoost += 0.05
      details.awayMotivation = 'title_contender'
      break
    case 'cl_qualify':
      awayBoost += 0.03
      details.awayMotivation = 'cl_race'
      break
    case 'relegation':
      awayBoost -= 0.02 // anxiety away
      details.awayMotivation = 'relegation_fight_away'
      break
    case 'mid_table':
      awayBoost -= 0.02
      details.awayMotivation = 'mid_table_apathy'
      break
  }

  // Position differential (top team vs bottom team => more decisive result)
  const posDiff = Math.abs(Number(homeStandings.position || 10) - Number(awayStandings.position || 10))
  const drawReduction = posDiff > 10 ? 0.05 : posDiff > 5 ? 0.02 : 0

  let homeProb = 0.4 + homeBoost
  let awayProb = 0.3 + awayBoost
  let drawProb = 0.3 - drawReduction

  const total = homeProb + drawProb + awayProb
  homeProb /= total
  drawProb /= total
  awayProb /= total

  return {
    home: homeProb,
    draw: drawProb,
    away: awayProb,
    confidence: 0.7,
    details: { ...details, positionDifference: posDiff, description: `Home: ${homeZone}, Away: ${awayZone}` },
  }
}
