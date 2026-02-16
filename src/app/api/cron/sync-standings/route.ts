import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getStandings, getCurrentSeason } from '@/lib/api/football-api'
import { ACTIVE_LEAGUES } from '@/lib/utils/constants'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

function determineZone(position: number, totalTeams: number, description: string | null): string {
  if (description?.toLowerCase().includes('champions league')) return 'cl_qualify'
  if (description?.toLowerCase().includes('europa')) return 'el_qualify'
  if (description?.toLowerCase().includes('relegation')) return 'relegation'
  if (position <= 2) return 'champion'
  if (position <= 4) return 'cl_qualify'
  if (position <= 7) return 'el_qualify'
  if (position >= totalTeams - 2) return 'relegation'
  if (position >= totalTeams - 4) return 'relegation_playoff'
  return 'mid_table'
}

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const season = getCurrentSeason()
    let totalSynced = 0

    for (const leagueId of ACTIVE_LEAGUES) {
      const standingsData = await getStandings(leagueId, season)

      for (const leagueStanding of standingsData) {
        const standings = leagueStanding.league.standings[0] || []
        const totalTeams = standings.length

        for (const entry of standings) {
          const { data: team } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('api_id', entry.team.id)
            .single()

          const { data: league } = await supabaseAdmin
            .from('leagues')
            .select('id')
            .eq('api_id', leagueId)
            .single()

          if (!team || !league) continue

          const zone = determineZone(entry.rank, totalTeams, entry.description)
          const form = entry.form ? entry.form.split('') : []

          const { error } = await supabaseAdmin
            .from('standings')
            .upsert({
              league_id: league.id,
              team_id: team.id,
              season: String(season),
              position: entry.rank,
              played: entry.all.played,
              won: entry.all.win,
              drawn: entry.all.draw,
              lost: entry.all.lose,
              goals_for: entry.all.goals.for,
              goals_against: entry.all.goals.against,
              goal_difference: entry.goalsDiff,
              points: entry.points,
              ppg: entry.all.played > 0 ? Number((entry.points / entry.all.played).toFixed(2)) : 0,
              zone,
              form_last5: form.slice(-5),
              form_last10: form.slice(-10),
              home_record: entry.home,
              away_record: entry.away,
              avg_goals_scored: entry.all.played > 0 ? Number((entry.all.goals.for / entry.all.played).toFixed(2)) : 0,
              avg_goals_conceded: entry.all.played > 0 ? Number((entry.all.goals.against / entry.all.played).toFixed(2)) : 0,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'league_id,team_id,season' })

          if (!error) totalSynced++
        }
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-standings error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
