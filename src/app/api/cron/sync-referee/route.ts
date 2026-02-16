import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get upcoming fixtures with referee assignments
    const { data: fixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id, referee')
      .eq('status', 'scheduled')
      .not('referee', 'is', null)
      .gte('match_date', new Date().toISOString())

    if (!fixtures) return NextResponse.json({ success: true, synced: 0 })

    let totalSynced = 0

    for (const fixture of fixtures) {
      if (!fixture.referee) continue

      // Upsert referee (we get stats from past fixtures)
      const { data: existingRef } = await supabaseAdmin
        .from('referees')
        .select('id')
        .eq('name', fixture.referee)
        .single()

      if (!existingRef) {
        // Calculate referee stats from finished fixtures
        const { data: refFixtures } = await supabaseAdmin
          .from('fixtures')
          .select('home_fouls, away_fouls, home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards')
          .eq('referee', fixture.referee)
          .eq('status', 'finished')

        if (refFixtures && refFixtures.length > 0) {
          const totalGames = refFixtures.length
          const avgFouls = refFixtures.reduce((sum, f) => sum + (f.home_fouls || 0) + (f.away_fouls || 0), 0) / totalGames
          const avgYellows = refFixtures.reduce((sum, f) => sum + (f.home_yellow_cards || 0) + (f.away_yellow_cards || 0), 0) / totalGames
          const avgReds = refFixtures.reduce((sum, f) => sum + (f.home_red_cards || 0) + (f.away_red_cards || 0), 0) / totalGames

          let cardsStyle: string = 'average'
          if (avgYellows > 5) cardsStyle = 'card_happy'
          else if (avgYellows > 4) cardsStyle = 'strict'
          else if (avgYellows < 2.5) cardsStyle = 'lenient'

          await supabaseAdmin.from('referees').insert({
            name: fixture.referee,
            avg_fouls_per_game: Number(avgFouls.toFixed(1)),
            avg_yellows_per_game: Number(avgYellows.toFixed(2)),
            avg_reds_per_game: Number(avgReds.toFixed(3)),
            cards_style: cardsStyle,
            updated_at: new Date().toISOString(),
          })

          totalSynced++
        }
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-referee error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
