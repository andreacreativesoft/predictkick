import type { AnalyzerScore } from '@/lib/types/prediction'

export function analyzeWeather(
  weather: Record<string, unknown> | null
): AnalyzerScore {
  if (!weather) {
    return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.1, details: { noData: true } }
  }

  const impactScore = Number(weather.weather_impact_score || 0)
  const temp = Number(weather.pre_temperature || 15)
  const windSpeed = Number(weather.pre_wind_speed || 0)
  const rainMm = Number(weather.pre_rain_mm || 0)

  // Weather generally favors home team (familiar conditions) and draws (fewer goals)
  let homeBoost = impactScore * 0.02
  let drawBoost = impactScore * 0.04
  let awayPenalty = impactScore * 0.03

  // Heavy rain/wind: boosts unders, favors physical teams
  if (rainMm > 3 || windSpeed > 10) {
    drawBoost += 0.03
    awayPenalty += 0.02
  }

  let homeProb = 0.4 + homeBoost
  let drawProb = 0.3 + drawBoost
  let awayProb = 0.3 - awayPenalty

  const total = homeProb + drawProb + awayProb
  homeProb /= total
  drawProb /= total
  awayProb /= total

  return {
    home: homeProb,
    draw: drawProb,
    away: awayProb,
    confidence: impactScore > 0.1 ? 0.6 : 0.2,
    details: {
      temperature: temp,
      windSpeed,
      rainMm,
      impactScore,
      description: weather.weather_impact_description,
    },
  }
}
