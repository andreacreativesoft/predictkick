import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getOddsForLeague, findBestOdds, LEAGUE_TO_SPORT_KEY } from '@/lib/api/odds-api'
import { ACTIVE_LEAGUES } from '@/lib/utils/constants'
import { validateCronSecret } from '@/lib/utils/validators'
import { oddsToImpliedProbability } from '@/lib/utils/probability'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let totalSynced = 0

    for (const leagueId of ACTIVE_LEAGUES) {
      const sportKey = LEAGUE_TO_SPORT_KEY[leagueId]
      if (!sportKey) continue

      const events = await getOddsForLeague(sportKey, {
        regions: 'eu',
        markets: 'h2h,totals',
        bookmakers: 'bet365,williamhill,unibet,betfair,onexbet,pinnacle',
      })

      const bestOdds = findBestOdds(events)

      for (const event of events) {
        // Match to our fixture by team names and date
        const { data: fixture } = await supabaseAdmin
          .from('fixtures')
          .select('id')
          .gte('match_date', new Date(event.commence_time).toISOString())
          .lte('match_date', new Date(new Date(event.commence_time).getTime() + 86400000).toISOString())
          .limit(1)
          .single()

        if (!fixture) continue

        const best = bestOdds.find(b => b.event_id === event.id)
        if (!best) continue

        // Calculate averages
        const h2hMarkets = event.bookmakers.flatMap(b =>
          b.markets.filter(m => m.key === 'h2h')
        )
        const homeOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === event.home_team).map(o => o.price))
        const drawOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === 'Draw').map(o => o.price))
        const awayOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === event.away_team).map(o => o.price))

        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

        // Upsert best odds
        await supabaseAdmin
          .from('odds_current')
          .upsert({
            fixture_id: fixture.id,
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
          }, { onConflict: 'fixture_id,market,line' })

        // Store history snapshot per bookmaker
        for (const bookmaker of event.bookmakers) {
          for (const market of bookmaker.markets.filter(m => m.key === 'h2h')) {
            const home = market.outcomes.find(o => o.name === event.home_team)?.price
            const draw = market.outcomes.find(o => o.name === 'Draw')?.price
            const away = market.outcomes.find(o => o.name === event.away_team)?.price

            await supabaseAdmin.from('odds_history').insert({
              fixture_id: fixture.id,
              bookmaker: bookmaker.key,
              market: 'h2h',
              home_odds: home || null,
              draw_odds: draw || null,
              away_odds: away || null,
              line: null,
              is_live: false,
              snapshot_at: new Date().toISOString(),
            })
          }
        }

        totalSynced++
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-odds error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
