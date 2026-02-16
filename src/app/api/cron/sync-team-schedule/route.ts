import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all upcoming fixtures
    const { data: upcomingFixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id, home_team_id, away_team_id, match_date, league_id')
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())
      .order('match_date', { ascending: true })

    if (!upcomingFixtures) return NextResponse.json({ success: true, synced: 0 })

    let totalSynced = 0

    for (const fixture of upcomingFixtures) {
      for (const teamId of [fixture.home_team_id, fixture.away_team_id]) {
        if (!teamId) continue

        // Find previous match for this team
        const { data: prevMatch } = await supabaseAdmin
          .from('fixtures')
          .select('match_date, venue, league_id')
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .lt('match_date', fixture.match_date)
          .order('match_date', { ascending: false })
          .limit(1)
          .single()

        // Find next match after this one
        const { data: nextMatch } = await supabaseAdmin
          .from('fixtures')
          .select('match_date, league_id')
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .gt('match_date', fixture.match_date)
          .order('match_date', { ascending: true })
          .limit(1)
          .single()

        // Count fixtures in 7 days and 30 days
        const sevenDaysAgo = new Date(fixture.match_date)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const thirtyDaysAgo = new Date(fixture.match_date)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { count: congestion7d } = await supabaseAdmin
          .from('fixtures')
          .select('*', { count: 'exact', head: true })
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .gte('match_date', sevenDaysAgo.toISOString())
          .lte('match_date', fixture.match_date)

        const { count: congestion30d } = await supabaseAdmin
          .from('fixtures')
          .select('*', { count: 'exact', head: true })
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .gte('match_date', thirtyDaysAgo.toISOString())
          .lte('match_date', fixture.match_date)

        const daysSincePrev = prevMatch
          ? Math.round((new Date(fixture.match_date).getTime() - new Date(prevMatch.match_date).getTime()) / 86400000)
          : null

        const daysUntilNext = nextMatch
          ? Math.round((new Date(nextMatch.match_date).getTime() - new Date(fixture.match_date).getTime()) / 86400000)
          : null

        // Calculate fatigue score (higher = more fatigued)
        let fatigue = 0.3
        if (daysSincePrev !== null) {
          if (daysSincePrev <= 2) fatigue = 0.9
          else if (daysSincePrev <= 3) fatigue = 0.7
          else if (daysSincePrev <= 4) fatigue = 0.5
          else fatigue = 0.3
        }

        // Rotation risk
        let rotationRisk = 0.2
        if (daysUntilNext !== null && daysUntilNext <= 3) rotationRisk = 0.6
        if ((congestion7d || 0) >= 3) rotationRisk = Math.max(rotationRisk, 0.7)

        await supabaseAdmin.from('team_schedule_context').upsert({
          team_id: teamId,
          fixture_id: fixture.id,
          prev_match_date: prevMatch?.match_date || null,
          days_since_prev_match: daysSincePrev,
          next_match_date: nextMatch?.match_date || null,
          days_until_next_match: daysUntilNext,
          fatigue_score: fatigue,
          rotation_risk: rotationRisk,
          fixture_congestion_7d: congestion7d || 0,
          fixture_congestion_30d: congestion30d || 0,
          updated_at: new Date().toISOString(),
        })

        totalSynced++
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-team-schedule error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
