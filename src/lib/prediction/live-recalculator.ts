import { EVENT_IMPACT_MATRIX } from '@/lib/types/live'
import type { EventImpactTemplate } from '@/lib/types/live'

export function calculateEventImpact(
  eventType: string,
  teamIsHome: boolean,
  currentScore: { home: number; away: number },
  minute: number
): EventImpactTemplate {
  // Determine specific event key
  let key = eventType

  if (eventType === 'goal') {
    if (teamIsHome) {
      key = currentScore.home > currentScore.away ? 'goal_home_leading' : 'goal_equalizer'
    } else {
      key = currentScore.away > currentScore.home ? 'goal_away_leading' : 'goal_equalizer'
    }
  } else if (eventType === 'red_card') {
    key = teamIsHome ? 'red_card_home' : 'red_card_away'
  }

  const baseImpact = EVENT_IMPACT_MATRIX[key] || {
    home_win_shift: 0,
    draw_shift: 0,
    away_win_shift: 0,
    over_25_shift: 0,
    btts_shift: 0,
    severity: 'low' as const,
  }

  // Time-weight: events later in the match have more impact
  const timeMultiplier = minute > 75 ? 1.3 : minute > 60 ? 1.1 : minute < 15 ? 0.7 : 1.0

  return {
    home_win_shift: baseImpact.home_win_shift * timeMultiplier,
    draw_shift: baseImpact.draw_shift * timeMultiplier,
    away_win_shift: baseImpact.away_win_shift * timeMultiplier,
    over_25_shift: baseImpact.over_25_shift * (minute < 45 ? 1.2 : 0.8),
    btts_shift: baseImpact.btts_shift,
    severity: baseImpact.severity,
  }
}
