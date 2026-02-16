import { NextResponse } from 'next/server'
import { validateCronSecret } from '@/lib/utils/validators'
import {
  refreshDominantTeams,
  generateDailyAccumulatorPicks,
  buildDailyAccumulators,
} from '@/lib/prediction/accumulator-builder'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const season = new Date().getFullYear().toString()

    // Step 1: Refresh dominant team profiles
    const dominantTeams = await refreshDominantTeams(season)

    // Step 2: Generate daily picks
    const picks = await generateDailyAccumulatorPicks()

    // Step 3: Build combos
    const combos = await buildDailyAccumulators()

    return NextResponse.json({
      success: true,
      dominant_teams: dominantTeams.length,
      picks_generated: picks.length,
      combos_built: combos.length,
      combos_summary: combos.map((c) => ({
        legs: c.legs,
        total_odds: c.total_odds.toFixed(2),
        risk: c.risk_level,
        expected_win_rate: (c.expected_win_rate * 100).toFixed(1) + '%',
      })),
    })
  } catch (error) {
    console.error('Accumulator generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate accumulators', details: String(error) },
      { status: 500 }
    )
  }
}
