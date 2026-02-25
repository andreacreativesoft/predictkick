import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateExtendedMarkets } from '@/lib/prediction/extended-markets'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fixtureId = searchParams.get('fixture_id')

    if (!fixtureId) {
      return NextResponse.json({ error: 'fixture_id required' }, { status: 400 })
    }

    // Fetch prediction + fixture + standings + referee data
    const [
      { data: prediction },
      { data: fixture },
    ] = await Promise.all([
      supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('fixture_id', fixtureId)
        .single(),
      supabaseAdmin
        .from('fixtures')
        .select(`
          *,
          home_team:teams!fixtures_home_team_id_fkey(id, name, short_name),
          away_team:teams!fixtures_away_team_id_fkey(id, name, short_name)
        `)
        .eq('id', fixtureId)
        .single(),
    ])

    if (!prediction || !fixture) {
      return NextResponse.json({ error: 'Prediction or fixture not found' }, { status: 404 })
    }

    const homeTeam = fixture.home_team as unknown as { id: string; name: string; short_name: string | null }
    const awayTeam = fixture.away_team as unknown as { id: string; name: string; short_name: string | null }

    // Get season for standings lookup
    const matchDate = new Date(fixture.match_date)
    const year = matchDate.getFullYear()
    const month = matchDate.getMonth()
    const season = month < 7 ? (year - 1).toString() : year.toString()

    // Fetch standings + referee + historical fixture stats in parallel
    const [
      { data: homeStandings },
      { data: awayStandings },
      { data: refereeData },
      { data: recentHomeFixtures },
      { data: recentAwayFixtures },
    ] = await Promise.all([
      supabaseAdmin.from('standings').select('*').eq('team_id', homeTeam.id).eq('season', season).single(),
      supabaseAdmin.from('standings').select('*').eq('team_id', awayTeam.id).eq('season', season).single(),
      fixture.referee
        ? supabaseAdmin.from('referees').select('*').eq('name', fixture.referee).single()
        : Promise.resolve({ data: null }),
      // Get last 10 completed home fixtures for corner/card averages
      supabaseAdmin
        .from('fixtures')
        .select('home_corners, away_corners, home_yellow_cards, away_yellow_cards')
        .eq('home_team_id', homeTeam.id)
        .eq('status', 'finished')
        .order('match_date', { ascending: false })
        .limit(10),
      // Get last 10 completed away fixtures
      supabaseAdmin
        .from('fixtures')
        .select('home_corners, away_corners, home_yellow_cards, away_yellow_cards')
        .eq('away_team_id', awayTeam.id)
        .eq('status', 'finished')
        .order('match_date', { ascending: false })
        .limit(10),
    ])

    // Calculate average corners from historical data
    const homeFixtures = recentHomeFixtures || []
    const awayFixtures = recentAwayFixtures || []

    const validHomeCorners = homeFixtures.filter(f => f.home_corners != null)
    const validAwayCorners = awayFixtures.filter(f => f.away_corners != null)

    const homeAvgCorners = validHomeCorners.length > 0
      ? validHomeCorners.reduce((sum, f) => sum + (f.home_corners || 0), 0) / validHomeCorners.length
      : undefined

    const awayAvgCorners = validAwayCorners.length > 0
      ? validAwayCorners.reduce((sum, f) => sum + (f.away_corners || 0), 0) / validAwayCorners.length
      : undefined

    // Calculate average cards from historical data
    const validHomeCards = homeFixtures.filter(f => f.home_yellow_cards != null)
    const validAwayCards = awayFixtures.filter(f => f.away_yellow_cards != null)

    const homeAvgYellows = validHomeCards.length > 0
      ? validHomeCards.reduce((sum, f) => sum + (f.home_yellow_cards || 0), 0) / validHomeCards.length
      : undefined

    const awayAvgYellows = validAwayCards.length > 0
      ? validAwayCards.reduce((sum, f) => sum + (f.away_yellow_cards || 0), 0) / validAwayCards.length
      : undefined

    const ref = refereeData as Record<string, unknown> | null

    // Calculate extended markets
    const extended = calculateExtendedMarkets({
      homeXG: prediction.predicted_home_goals,
      awayXG: prediction.predicted_away_goals,
      homeWinProb: prediction.home_win_prob,
      drawProb: prediction.draw_prob,
      awayWinProb: prediction.away_win_prob,
      homeTeam: homeTeam.short_name || homeTeam.name,
      awayTeam: awayTeam.short_name || awayTeam.name,
      cornerData: {
        homeAvgCorners,
        awayAvgCorners,
      },
      cardData: {
        homeAvgYellows,
        awayAvgYellows,
        refereeAvgYellows: ref?.avg_yellows_per_game as number | undefined,
        refereeStyle: ref?.cards_style as string | undefined,
      },
    })

    return NextResponse.json({
      fixture_id: fixtureId,
      predicted_home_goals: prediction.predicted_home_goals,
      predicted_away_goals: prediction.predicted_away_goals,
      markets: extended,
      data_sources: {
        home_fixtures_used: validHomeCorners.length,
        away_fixtures_used: validAwayCorners.length,
        referee: ref ? ref.name : null,
        referee_style: ref?.cards_style || null,
        home_standings: !!homeStandings,
        away_standings: !!awayStandings,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
