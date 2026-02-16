import { MIN_VALUE_EDGE } from '@/lib/utils/constants'
import { oddsToImpliedProbability, kellyFraction, calculateEdge } from '@/lib/utils/probability'
import type { ValueBetResult } from '@/lib/types/prediction'

export function detectValueBets(
  prediction: {
    home_win_prob: number
    draw_prob: number
    away_win_prob: number
    over_25_prob: number
    btts_yes_prob: number
  },
  odds: Record<string, unknown> | null
): ValueBetResult[] {
  if (!odds) return []

  const valueBets: ValueBetResult[] = []

  const markets = [
    { market: 'h2h', selection: 'home', ourProb: prediction.home_win_prob / 100, oddsField: 'best_home_odds', bookmakerField: 'best_home_bookmaker' },
    { market: 'h2h', selection: 'draw', ourProb: prediction.draw_prob / 100, oddsField: 'best_draw_odds', bookmakerField: 'best_draw_bookmaker' },
    { market: 'h2h', selection: 'away', ourProb: prediction.away_win_prob / 100, oddsField: 'best_away_odds', bookmakerField: 'best_away_bookmaker' },
  ]

  for (const { market, selection, ourProb, oddsField, bookmakerField } of markets) {
    const bestOdds = Number(odds[oddsField])
    const bookmaker = String(odds[bookmakerField] || 'unknown')

    if (!bestOdds || bestOdds <= 1) continue

    const impliedProb = oddsToImpliedProbability(bestOdds)
    const edge = calculateEdge(ourProb, impliedProb)

    if (edge >= MIN_VALUE_EDGE) {
      const kelly = kellyFraction(ourProb, bestOdds)

      valueBets.push({
        market,
        selection,
        our_prob: ourProb,
        implied_prob: impliedProb,
        edge,
        best_odds: bestOdds,
        bookmaker,
        kelly_stake_pct: Math.min(kelly * 100, 5),
        confidence: edge > 0.10 ? 'high' : edge > 0.05 ? 'medium' : 'low',
      })
    }
  }

  return valueBets.sort((a, b) => b.edge - a.edge)
}
