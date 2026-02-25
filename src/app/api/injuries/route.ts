import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const homeTeamId = searchParams.get('home_team_id')
    const awayTeamId = searchParams.get('away_team_id')

    if (!homeTeamId || !awayTeamId) {
      return NextResponse.json({ error: 'home_team_id and away_team_id required' }, { status: 400 })
    }

    // Query player availability for both teams
    const { data: availability } = await supabaseAdmin
      .from('player_availability')
      .select(`
        id,
        status,
        reason,
        expected_return,
        impact_on_team,
        player:players!player_availability_player_id_fkey(name, position, team_id, is_key_player),
        team:teams!player_availability_team_id_fkey(name, short_name)
      `)
      .in('team_id', [homeTeamId, awayTeamId])
      .in('status', ['injured', 'suspended', 'doubtful'])
      .order('impact_on_team', { ascending: false })

    const injuries = (availability || []).map((a: Record<string, unknown>) => {
      const player = a.player as Record<string, unknown> | null
      const team = a.team as Record<string, unknown> | null
      return {
        id: a.id,
        player_name: player?.name || 'Unknown',
        team_name: team?.short_name || team?.name || '',
        status: a.status,
        reason: a.reason || '',
        expected_return: a.expected_return,
        impact_on_team: Number(a.impact_on_team) || 0,
      }
    })

    return NextResponse.json({ injuries })
  } catch (error) {
    return NextResponse.json({ error: String(error), injuries: [] }, { status: 500 })
  }
}
