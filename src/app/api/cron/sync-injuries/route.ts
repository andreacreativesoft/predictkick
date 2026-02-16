import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getInjuries, getCurrentSeason } from '@/lib/api/football-api'
import { ACTIVE_LEAGUES } from '@/lib/utils/constants'
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

    for (const leagueId of ACTIVE_LEAGUES) {
      try {
      const injuries = await getInjuries(leagueId, season)

      for (const injury of injuries) {
        // Get or create player
        const { data: player } = await supabaseAdmin
          .from('players')
          .upsert({
            api_id: injury.player.id,
            name: injury.player.name,
            photo_url: injury.player.photo,
          }, { onConflict: 'api_id' })
          .select('id')
          .single()

        const { data: team } = await supabaseAdmin
          .from('teams')
          .select('id')
          .eq('api_id', injury.team.id)
          .single()

        if (!player || !team) continue

        // Find upcoming fixture for this team
        const { data: fixture } = await supabaseAdmin
          .from('fixtures')
          .select('id')
          .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
          .eq('status', 'scheduled')
          .gte('match_date', new Date().toISOString())
          .order('match_date', { ascending: true })
          .limit(1)
          .single()

        const status = injury.player.type === 'Missing Fixture'
          ? 'injured'
          : injury.player.reason?.toLowerCase().includes('suspend')
            ? 'suspended'
            : injury.player.reason?.toLowerCase().includes('doubt')
              ? 'doubtful'
              : 'injured'

        await supabaseAdmin.from('player_availability').upsert({
          player_id: player.id,
          team_id: team.id,
          fixture_id: fixture?.id || null,
          status,
          reason: injury.player.reason,
          source: 'api',
          updated_at: new Date().toISOString(),
        })

        totalSynced++
      }
      } catch (leagueError) {
        console.error(`sync-injuries: League ${leagueId} failed:`, leagueError)
        errors.push(`League ${leagueId}: ${String(leagueError)}`)
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced, errors: errors.length > 0 ? errors : undefined })
  } catch (error) {
    console.error('sync-injuries error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
