import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getOddsForLeague, findBestOdds, LEAGUE_TO_SPORT_KEY } from '@/lib/api/odds-api'
import { ACTIVE_LEAGUES } from '@/lib/utils/constants'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let totalSynced = 0
    const errors: string[] = []

    // Pre-fetch all scheduled fixtures for matching
    const { data: allFixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id, match_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())

    if (!allFixtures || allFixtures.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No scheduled fixtures' })
    }

    for (const leagueId of ACTIVE_LEAGUES) {
      try {
        const sportKey = LEAGUE_TO_SPORT_KEY[leagueId]
        if (!sportKey) continue

        const events = await getOddsForLeague(sportKey, {
          regions: 'eu',
          markets: 'h2h',
          bookmakers: 'bet365,williamhill,unibet,betfair,pinnacle',
        })

        if (!events || events.length === 0) continue

        const bestOdds = findBestOdds(events)
        const oddsCurrentRows: Record<string, unknown>[] = []
        const oddsHistoryRows: Record<string, unknown>[] = []

        for (const event of events) {
          // Match to fixture by date (within same day)
          const eventDate = new Date(event.commence_time)
          const matched = allFixtures.find(f => {
            const fDate = new Date(f.match_date)
            return Math.abs(fDate.getTime() - eventDate.getTime()) < 86400000
          })

          if (!matched) continue

          const best = bestOdds.find(b => b.event_id === event.id)
          if (!best) continue

          const h2hMarkets = event.bookmakers.flatMap(b =>
            b.markets.filter(m => m.key === 'h2h')
          )
          const homeOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === event.home_team).map(o => o.price))
          const drawOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === 'Draw').map(o => o.price))
          const awayOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === event.away_team).map(o => o.price))
          const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

          oddsCurrentRows.push({
            fixture_id: matched.id,
            market: 'h2h',
            best_home_odds: best.best_home.odds || null,
            best_home_bookmaker: best.best_home.bookmaker || null,
            best_draw_odds: best.best_draw.odds || null,
            best_draw_bookmaker: best.best_draw.bookmaker || null,
            best_away_odds: best.best_away.odds || null,
            best_away_bookmaker: best.best_away.bookmaker || null,
            avg_home_odds: avg(homeOdds),
            avg_draw_odds: avg(drawOdds),
            avg_away_odds: avg(awayOdds),
            line: null,
            updated_at: new Date().toISOString(),
          })

          // Collect history rows
          for (const bookmaker of event.bookmakers) {
            for (const market of bookmaker.markets.filter(m => m.key === 'h2h')) {
              oddsHistoryRows.push({
                fixture_id: matched.id,
                bookmaker: bookmaker.key,
                market: 'h2h',
                home_odds: market.outcomes.find(o => o.name === event.home_team)?.price || null,
                draw_odds: market.outcomes.find(o => o.name === 'Draw')?.price || null,
                away_odds: market.outcomes.find(o => o.name === event.away_team)?.price || null,
                line: null,
                is_live: false,
                snapshot_at: new Date().toISOString(),
              })
            }
          }
        }

        // Batch upsert odds_current
        if (oddsCurrentRows.length > 0) {
          const { error } = await supabaseAdmin
            .from('odds_current')
            .upsert(oddsCurrentRows, { onConflict: 'fixture_id,market,line' })
          if (!error) totalSynced += oddsCurrentRows.length
          else errors.push(`League ${leagueId} odds_current: ${error.message}`)
        }

        // Batch insert odds_history
        if (oddsHistoryRows.length > 0) {
          for (let i = 0; i < oddsHistoryRows.length; i += 100) {
            const chunk = oddsHistoryRows.slice(i, i + 100)
            await supabaseAdmin.from('odds_history').insert(chunk)
          }
        }
      } catch (leagueError) {
        console.error(`sync-odds: League ${leagueId} failed:`, leagueError)
        errors.push(`League ${leagueId}: ${String(leagueError)}`)
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced, errors: errors.length > 0 ? errors : undefined })
  } catch (error) {
    console.error('sync-odds error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
