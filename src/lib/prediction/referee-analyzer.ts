import type { AnalyzerScore } from '@/lib/types/prediction'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function analyzeRefereeAsync(refereeName: string | null): Promise<AnalyzerScore> {
  if (!refereeName) {
    return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.1, details: { noReferee: true } }
  }

  const { data: referee } = await supabaseAdmin
    .from('referees')
    .select('*')
    .eq('name', refereeName)
    .single()

  if (!referee) {
    return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.1, details: { refereeNotFound: true } }
  }

  const homeWinPct = Number(referee.home_win_percentage || 50) / 100
  let homeBoost = (homeWinPct - 0.45) * 0.1 // If referee has home bias

  return {
    home: 0.4 + homeBoost,
    draw: 0.3,
    away: 0.3 - homeBoost,
    confidence: 0.4,
    details: {
      name: referee.name,
      cardsStyle: referee.cards_style,
      avgYellows: referee.avg_yellows_per_game,
      avgFouls: referee.avg_fouls_per_game,
      homeWinPct,
    },
  }
}

// Sync version for use in the pipeline (fallback)
export function analyzeReferee(refereeName: string | null): AnalyzerScore {
  return { home: 0.4, draw: 0.3, away: 0.3, confidence: 0.1, details: { referee: refereeName } }
}
