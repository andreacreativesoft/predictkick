import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getFixtures, getCurrentSeason, getDateRange } from '@/lib/api/football-api'
import { ACTIVE_LEAGUES } from '@/lib/utils/constants'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const fullSync = url.searchParams.get('full') === 'true'
    const season = getCurrentSeason()
    let totalSynced = 0
    const errors: string[] = []

    // Cache for team and league UUID lookups (api_id -> uuid)
    const teamCache = new Map<number, string>()
    const leagueCache = new Map<number, string>()

    for (const leagueId of ACTIVE_LEAGUES) {
      try {
        const options = fullSync
          ? {}
          : { from: getDateRange(14).from, to: getDateRange(14).to }
        const fixtures = await getFixtures(leagueId, season, options)

        // Batch: collect all unique teams first
        const uniqueTeams = new Map<number, { id: number; name: string; logo: string }>()
        for (const f of fixtures) {
          uniqueTeams.set(f.teams.home.id, { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo })
          uniqueTeams.set(f.teams.away.id, { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo })
        }

        // Batch upsert all teams at once
        if (uniqueTeams.size > 0) {
          const teamRows = Array.from(uniqueTeams.values()).map(t => ({
            api_id: t.id,
            name: t.name,
            logo_url: t.logo,
          }))
          await supabaseAdmin.from('teams').upsert(teamRows, { onConflict: 'api_id' })

          // Batch fetch all team UUIDs
          const teamApiIds = Array.from(uniqueTeams.keys())
          const { data: teams } = await supabaseAdmin
            .from('teams')
            .select('id, api_id')
            .in('api_id', teamApiIds)
          if (teams) {
            for (const t of teams) {
              teamCache.set(t.api_id, t.id)
            }
          }
        }

        // Ensure league UUID is cached
        if (!leagueCache.has(leagueId)) {
          const { data: league } = await supabaseAdmin
            .from('leagues')
            .select('id')
            .eq('api_id', leagueId)
            .single()
          if (league) leagueCache.set(leagueId, league.id)
        }

        const leagueUuid = leagueCache.get(leagueId)
        if (!leagueUuid) {
          errors.push(`League ${leagueId}: no DB entry found`)
          continue
        }

        // Batch upsert all fixtures
        const fixtureRows = fixtures
          .map(f => {
            const homeId = teamCache.get(f.teams.home.id)
            const awayId = teamCache.get(f.teams.away.id)
            if (!homeId || !awayId) return null

            return {
              api_id: f.fixture.id,
              league_id: leagueUuid,
              home_team_id: homeId,
              away_team_id: awayId,
              match_date: f.fixture.date,
              venue: f.fixture.venue?.name || null,
              referee: f.fixture.referee,
              status: f.fixture.status.short === 'NS' ? 'scheduled' :
                      f.fixture.status.short === 'FT' ? 'finished' :
                      f.fixture.status.short,
              home_score: f.goals.home,
              away_score: f.goals.away,
              ht_home_score: f.score.halftime.home,
              ht_away_score: f.score.halftime.away,
            }
          })
          .filter(Boolean)

        if (fixtureRows.length > 0) {
          // Supabase upsert in chunks of 100
          for (let i = 0; i < fixtureRows.length; i += 100) {
            const chunk = fixtureRows.slice(i, i + 100)
            const { error } = await supabaseAdmin
              .from('fixtures')
              .upsert(chunk, { onConflict: 'api_id' })
            if (!error) totalSynced += chunk.length
            else errors.push(`League ${leagueId} fixtures chunk ${i}: ${error.message}`)
          }
        }
      } catch (leagueError) {
        console.error(`sync-fixtures: League ${leagueId} failed:`, leagueError)
        errors.push(`League ${leagueId}: ${String(leagueError)}`)
      }
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      season,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('sync-fixtures error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
