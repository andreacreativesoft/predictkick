import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'
import { oddsToImpliedProbability } from '@/lib/utils/probability'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get upcoming fixtures with odds
    const { data: fixtures } = await supabaseAdmin
      .from('odds_current')
      .select('fixture_id, best_home_odds, best_draw_odds, best_away_odds, market')
      .eq('market', 'h2h')

    if (!fixtures) return NextResponse.json({ success: true, alerts: 0 })

    let alertCount = 0

    for (const current of fixtures) {
      if (!current.fixture_id) continue

      // Get previous odds snapshot (6+ hours old)
      const sixHoursAgo = new Date(Date.now() - 6 * 3600000).toISOString()
      const { data: prevOdds } = await supabaseAdmin
        .from('odds_history')
        .select('home_odds, draw_odds, away_odds, bookmaker')
        .eq('fixture_id', current.fixture_id)
        .eq('market', 'h2h')
        .lte('snapshot_at', sixHoursAgo)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single()

      if (!prevOdds || !current.best_home_odds || !prevOdds.home_odds) continue

      // Check for significant movements
      const homeImpliedNow = oddsToImpliedProbability(current.best_home_odds)
      const homeImpliedPrev = oddsToImpliedProbability(prevOdds.home_odds)
      const homeShift = Math.abs(homeImpliedNow - homeImpliedPrev)

      if (homeShift > 0.05) {
        await supabaseAdmin.from('odds_alerts').insert({
          fixture_id: current.fixture_id,
          alert_type: homeImpliedNow > homeImpliedPrev ? 'steam_move_home' : 'drift_home',
          market: 'h2h',
          description: `Home odds moved from ${prevOdds.home_odds} to ${current.best_home_odds} (${(homeShift * 100).toFixed(1)}% implied prob shift)`,
          old_odds: prevOdds.home_odds,
          new_odds: current.best_home_odds,
          bookmaker: prevOdds.bookmaker,
          implied_prob_change: Number((homeShift * 100).toFixed(2)),
        })
        alertCount++
      }

      // Check away odds movement
      if (current.best_away_odds && prevOdds.away_odds) {
        const awayImpliedNow = oddsToImpliedProbability(current.best_away_odds)
        const awayImpliedPrev = oddsToImpliedProbability(prevOdds.away_odds)
        const awayShift = Math.abs(awayImpliedNow - awayImpliedPrev)

        if (awayShift > 0.05) {
          await supabaseAdmin.from('odds_alerts').insert({
            fixture_id: current.fixture_id,
            alert_type: awayImpliedNow > awayImpliedPrev ? 'steam_move_away' : 'drift_away',
            market: 'h2h',
            description: `Away odds moved from ${prevOdds.away_odds} to ${current.best_away_odds} (${(awayShift * 100).toFixed(1)}% implied prob shift)`,
            old_odds: prevOdds.away_odds,
            new_odds: current.best_away_odds,
            bookmaker: prevOdds.bookmaker,
            implied_prob_change: Number((awayShift * 100).toFixed(2)),
          })
          alertCount++
        }
      }
    }

    return NextResponse.json({ success: true, alerts: alertCount })
  } catch (error) {
    console.error('sync-odds-movement error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
