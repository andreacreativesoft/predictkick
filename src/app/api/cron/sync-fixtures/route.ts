import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getFixtures, getCurrentSeason, getDateRange } from '@/lib/api/football-api'
import { ACTIVE_LEAGUES } from '@/lib/utils/constants'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 300

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const fullSync = url.searchParams.get('full') === 'true'
    const season = getCurrentSeason()
    let totalSynced = 0

    for (const leagueId of ACTIVE_LEAGUES) {
      // Full sync: get all season fixtures; normal: next 14 days only
      const options = fullSync
        ? {} // No date filter = all fixtures for the season
        : { from: getDateRange(14).from, to: getDateRange(14).to }
      const fixtures = await getFixtures(leagueId, season, options)

      for (const fixture of fixtures) {
        // Upsert team references first
        for (const side of ['home', 'away'] as const) {
          const team = fixture.teams[side]
          await supabaseAdmin
            .from('teams')
            .upsert({
              api_id: team.id,
              name: team.name,
              logo_url: team.logo,
            }, { onConflict: 'api_id' })
        }

        // Get team UUIDs
        const { data: homeTeam } = await supabaseAdmin
          .from('teams')
          .select('id')
          .eq('api_id', fixture.teams.home.id)
          .single()

        const { data: awayTeam } = await supabaseAdmin
          .from('teams')
          .select('id')
          .eq('api_id', fixture.teams.away.id)
          .single()

        const { data: league } = await supabaseAdmin
          .from('leagues')
          .select('id')
          .eq('api_id', fixture.league.id)
          .single()

        if (!homeTeam || !awayTeam || !league) continue

        // Upsert fixture
        const { error } = await supabaseAdmin
          .from('fixtures')
          .upsert({
            api_id: fixture.fixture.id,
            league_id: league.id,
            home_team_id: homeTeam.id,
            away_team_id: awayTeam.id,
            match_date: fixture.fixture.date,
            venue: fixture.fixture.venue?.name || null,
            referee: fixture.fixture.referee,
            status: fixture.fixture.status.short === 'NS' ? 'scheduled' :
                    fixture.fixture.status.short === 'FT' ? 'finished' :
                    fixture.fixture.status.short,
            home_score: fixture.goals.home,
            away_score: fixture.goals.away,
            ht_home_score: fixture.score.halftime.home,
            ht_away_score: fixture.score.halftime.away,
          }, { onConflict: 'api_id' })

        if (!error) totalSynced++
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-fixtures error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
