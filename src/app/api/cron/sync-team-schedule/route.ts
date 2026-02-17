import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch ALL fixtures (scheduled + finished) in one query for in-memory computation
    const { data: allFixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id, home_team_id, away_team_id, match_date, status, league_id')
      .order('match_date', { ascending: true })

    if (!allFixtures) return NextResponse.json({ success: true, synced: 0 })

    // Build a per-team fixture timeline (sorted by date)
    const teamFixtures = new Map<string, Array<{ id: string; match_date: string; status: string }>>()

    for (const f of allFixtures) {
      for (const teamId of [f.home_team_id, f.away_team_id]) {
        if (!teamId) continue
        if (!teamFixtures.has(teamId)) teamFixtures.set(teamId, [])
        teamFixtures.get(teamId)!.push({ id: f.id, match_date: f.match_date, status: f.status })
      }
    }

    // Get upcoming fixtures only
    const now = new Date().toISOString()
    const upcoming = allFixtures.filter(f => f.status === 'scheduled' && f.match_date >= now)

    const rows: Record<string, unknown>[] = []

    for (const fixture of upcoming) {
      for (const teamId of [fixture.home_team_id, fixture.away_team_id]) {
        if (!teamId) continue

        const timeline = teamFixtures.get(teamId) || []
        const fixtureDate = new Date(fixture.match_date)

        // Find previous match
        const prevMatches = timeline.filter(t => t.match_date < fixture.match_date)
        const prevMatch = prevMatches[prevMatches.length - 1] || null

        // Find next match after this one
        const nextMatches = timeline.filter(t => t.match_date > fixture.match_date)
        const nextMatch = nextMatches[0] || null

        // Count congestion
        const sevenDaysAgo = new Date(fixtureDate)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const thirtyDaysAgo = new Date(fixtureDate)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const congestion7d = timeline.filter(t =>
          t.match_date >= sevenDaysAgo.toISOString() && t.match_date <= fixture.match_date
        ).length

        const congestion30d = timeline.filter(t =>
          t.match_date >= thirtyDaysAgo.toISOString() && t.match_date <= fixture.match_date
        ).length

        const daysSincePrev = prevMatch
          ? Math.round((fixtureDate.getTime() - new Date(prevMatch.match_date).getTime()) / 86400000)
          : null

        const daysUntilNext = nextMatch
          ? Math.round((new Date(nextMatch.match_date).getTime() - fixtureDate.getTime()) / 86400000)
          : null

        let fatigue = 0.3
        if (daysSincePrev !== null) {
          if (daysSincePrev <= 2) fatigue = 0.9
          else if (daysSincePrev <= 3) fatigue = 0.7
          else if (daysSincePrev <= 4) fatigue = 0.5
          else fatigue = 0.3
        }

        let rotationRisk = 0.2
        if (daysUntilNext !== null && daysUntilNext <= 3) rotationRisk = 0.6
        if (congestion7d >= 3) rotationRisk = Math.max(rotationRisk, 0.7)

        rows.push({
          team_id: teamId,
          fixture_id: fixture.id,
          prev_match_date: prevMatch?.match_date || null,
          days_since_prev_match: daysSincePrev,
          next_match_date: nextMatch?.match_date || null,
          days_until_next_match: daysUntilNext,
          fatigue_score: fatigue,
          rotation_risk: rotationRisk,
          fixture_congestion_7d: congestion7d,
          fixture_congestion_30d: congestion30d,
          updated_at: new Date().toISOString(),
        })
      }
    }

    // Batch upsert all schedule context rows
    let totalSynced = 0
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100)
      const { error } = await supabaseAdmin
        .from('team_schedule_context')
        .upsert(chunk)
      if (!error) totalSynced += chunk.length
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-team-schedule error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
