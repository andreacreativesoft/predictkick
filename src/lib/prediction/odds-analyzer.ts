import type { AnalyzerScore } from '@/lib/types/prediction'
import { oddsToImpliedProbability, removeOverround } from '@/lib/utils/probability'
// oddsToImpliedProbability used for movement detection below

export function analyzeMarket(
  currentOdds: Record<string, unknown> | null,
  oddsHistory: Array<Record<string, unknown>>
): AnalyzerScore {
  if (!currentOdds) {
    return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.1, details: { noOdds: true } }
  }

  // Market consensus from average odds
  const avgHome = Number(currentOdds.avg_home_odds || 2.5)
  const avgDraw = Number(currentOdds.avg_draw_odds || 3.3)
  const avgAway = Number(currentOdds.avg_away_odds || 3.0)

  // Remove overround from odds to get fair probabilities
  const fair = removeOverround(avgHome, avgDraw, avgAway)

  // Detect movement from history
  let movementDirection: 'home' | 'away' | 'stable' = 'stable'
  if (oddsHistory.length >= 2) {
    const latest = oddsHistory[0]
    const previous = oddsHistory[Math.min(5, oddsHistory.length - 1)]

    const latestHomeImpl = oddsToImpliedProbability(Number(latest.home_odds || avgHome))
    const prevHomeImpl = oddsToImpliedProbability(Number(previous.home_odds || avgHome))

    if (latestHomeImpl - prevHomeImpl > 0.03) movementDirection = 'home'
    else if (prevHomeImpl - latestHomeImpl > 0.03) movementDirection = 'away'
  }

  return {
    home: fair[0],
    draw: fair[1],
    away: fair[2],
    confidence: 0.8,
    details: {
      avgOdds: { home: avgHome, draw: avgDraw, away: avgAway },
      impliedProb: { home: fair[0], draw: fair[1], away: fair[2] },
      movementDirection,
      historyPoints: oddsHistory.length,
      bestHomeOdds: currentOdds.best_home_odds,
      bestDrawOdds: currentOdds.best_draw_odds,
      bestAwayOdds: currentOdds.best_away_odds,
    },
  }
}
