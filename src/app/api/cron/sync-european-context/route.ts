import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getStandings, getCurrentSeason } from '@/lib/api/football-api'
import { LEAGUE_IDS } from '@/lib/utils/constants'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const season = getCurrentSeason()
    let totalSynced = 0
    const errors: string[] = []
    const europeanLeagues = [LEAGUE_IDS.CHAMPIONS_LEAGUE, LEAGUE_IDS.EUROPA_LEAGUE]

    for (const leagueId of europeanLeagues) {
      try {
      const competition = leagueId === LEAGUE_IDS.CHAMPIONS_LEAGUE
        ? 'Champions League'
        : 'Europa League'

      const standingsData = await getStandings(leagueId, season)

      for (const data of standingsData) {
        for (const group of data.league.standings) {
          for (const entry of group) {
            const { data: team } = await supabaseAdmin
              .from('teams')
              .select('id')
              .eq('api_id', entry.team.id)
              .single()

            if (!team) continue

            const isQualified = entry.description?.toLowerCase().includes('promotion') || false
            const isEliminated = entry.description?.toLowerCase().includes('elimination') || false

            await supabaseAdmin.from('european_context').upsert({
              team_id: team.id,
              competition,
              season: String(season),
              group_position: entry.rank,
              group_points: entry.points,
              is_qualified: isQualified,
              is_eliminated: isEliminated,
              must_win_next: !isQualified && !isEliminated && entry.rank > 2,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'team_id,competition,season' })

            totalSynced++
          }
        }
      }
      } catch (leagueError) {
        console.error(`sync-european-context: League ${leagueId} failed:`, leagueError)
        errors.push(`League ${leagueId}: ${String(leagueError)}`)
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced, errors: errors.length > 0 ? errors : undefined })
  } catch (error) {
    console.error('sync-european-context error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
