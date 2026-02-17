import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  identifyDominantTeams,
  assessAccumulatorPick,
  buildAccumulatorCombos,
} from './dominant-team-analyzer'
import type {
  DominanceProfile,
  AccumulatorPick,
  AccumulatorCombo,
} from './dominant-team-analyzer'

// ---------------------------------------------------------------------------
// Refresh dominant team profiles from current standings
// ---------------------------------------------------------------------------
export async function refreshDominantTeams(
  season: string
): Promise<DominanceProfile[]> {
  // Fetch all standings for the season
  const { data: standings } = await supabaseAdmin
    .from('standings')
    .select('*, team:teams(*), league:leagues(*)')
    .eq('season', season)

  if (!standings || standings.length === 0) return []

  // Group by league
  const byLeague = standings.reduce<Record<string, typeof standings>>(
    (acc, s) => {
      const leagueId = s.league_id as string
      if (!acc[leagueId]) acc[leagueId] = []
      acc[leagueId].push(s)
      return acc
    },
    {}
  )

  const allDominant: DominanceProfile[] = []

  for (const [, leagueStandings] of Object.entries(byLeague)) {
    const dominant = identifyDominantTeams(leagueStandings)
    allDominant.push(...dominant)
  }

  // Save to database
  for (const profile of allDominant) {
    await supabaseAdmin.from('dominant_teams').upsert(
      {
        team_id: profile.team_id,
        league_id: profile.league_id,
        season,
        dominance_level: profile.dominance_level,
        dominance_score: profile.dominance_score,
        win_rate: profile.win_rate,
        ppg: profile.ppg,
        goal_difference: profile.goal_difference,
        home_win_rate: profile.home_win_rate,
        away_win_rate: profile.away_win_rate,
        loss_rate: profile.loss_rate,
        avg_goals_scored: profile.avg_goals_scored,
        avg_goals_conceded: profile.avg_goals_conceded,
        clean_sheet_pct: profile.clean_sheet_pct,
        form_score: profile.form_score,
        min_odds_threshold: 1.05 + (1 - profile.win_rate / 100) * 0.5,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,season' }
    )
  }

  return allDominant
}

// ---------------------------------------------------------------------------
// Generate daily accumulator picks from upcoming fixtures
// ---------------------------------------------------------------------------
export async function generateDailyAccumulatorPicks(): Promise<
  AccumulatorPick[]
> {
  const nowDate = new Date()
  const season = (nowDate.getMonth() >= 6 ? nowDate.getFullYear() : nowDate.getFullYear() - 1).toString()

  // Get dominant teams
  const { data: dominantTeams } = await supabaseAdmin
    .from('dominant_teams')
    .select('*, team:teams(*), league:leagues(*)')
    .eq('season', season)
    .in('dominance_level', ['ultra', 'strong'])

  if (!dominantTeams || dominantTeams.length === 0) return []

  // Get upcoming fixtures for dominant teams (next 3 days)
  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const picks: AccumulatorPick[] = []

  for (const dt of dominantTeams) {
    const teamId = dt.team_id as string

    const { data: fixtures } = await supabaseAdmin
      .from('fixtures')
      .select(
        `
        *,
        home_team:teams!fixtures_home_team_id_fkey(*),
        away_team:teams!fixtures_away_team_id_fkey(*),
        league:leagues!fixtures_league_id_fkey(*),
        predictions(*),
        odds_current(*),
        match_weather(*)
      `
      )
      .eq('status', 'scheduled')
      .gte('match_date', now.toISOString())
      .lte('match_date', threeDaysLater.toISOString())
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)

    if (!fixtures) continue

    for (const fixture of fixtures) {
      const isHome = fixture.home_team_id === teamId
      const opponentId = isHome
        ? (fixture.away_team_id as string)
        : (fixture.home_team_id as string)

      // Get opponent standings
      const { data: opponentStandings } = await supabaseAdmin
        .from('standings')
        .select('*')
        .eq('team_id', opponentId)
        .eq('season', season)
        .single()

      // Get injuries for the dominant team in this fixture
      const { data: injuries } = await supabaseAdmin
        .from('player_availability')
        .select('*, player:players(*)')
        .eq('team_id', teamId)
        .eq('fixture_id', fixture.id)

      const teamRecord = dt.team as Record<string, unknown> | null
      const leagueRecord = dt.league as Record<string, unknown> | null

      const profile: DominanceProfile = {
        team_id: dt.team_id as string,
        team_name: (teamRecord?.name as string) || 'Unknown',
        league_id: dt.league_id as string,
        league_name: (leagueRecord?.name as string) || 'Unknown',
        dominance_level: dt.dominance_level as DominanceProfile['dominance_level'],
        dominance_score: Number(dt.dominance_score),
        win_rate: Number(dt.win_rate),
        ppg: Number(dt.ppg),
        goal_difference: dt.goal_difference as number,
        home_win_rate: Number(dt.home_win_rate),
        away_win_rate: Number(dt.away_win_rate),
        form_last5: [],
        form_score: Number(dt.form_score),
        loss_rate: Number(dt.loss_rate),
        draw_rate: 100 - Number(dt.win_rate) - Number(dt.loss_rate),
        avg_goals_scored: Number(dt.avg_goals_scored),
        avg_goals_conceded: Number(dt.avg_goals_conceded),
        clean_sheet_pct: Number(dt.clean_sheet_pct),
      }

      const prediction = Array.isArray(fixture.predictions)
        ? fixture.predictions[0]
        : null
      const odds = Array.isArray(fixture.odds_current)
        ? fixture.odds_current[0]
        : null
      const weather = Array.isArray(fixture.match_weather)
        ? fixture.match_weather[0]
        : null

      const pick = assessAccumulatorPick(
        fixture,
        profile,
        opponentStandings,
        odds,
        prediction,
        weather,
        injuries || []
      )

      if (pick.safety_score >= 60) {
        picks.push(pick)

        // Save to database
        await supabaseAdmin.from('accumulator_picks').insert({
          fixture_id: fixture.id,
          team_id: teamId,
          match_date: new Date(fixture.match_date as string)
            .toISOString()
            .split('T')[0],
          is_home: isHome,
          dominance_score: pick.dominance_score,
          safety_score: pick.safety_score,
          recommended_market: pick.recommended_market,
          min_odds_threshold: pick.min_odds_threshold,
          current_odds: pick.current_odds,
          is_value: pick.is_value,
          risk_factors: pick.risk_factors,
          confidence: pick.confidence,
        })
      }
    }
  }

  return picks
}

// ---------------------------------------------------------------------------
// Build today's accumulator combos from available picks
// ---------------------------------------------------------------------------
export async function buildDailyAccumulators(
  userId?: string
): Promise<AccumulatorCombo[]> {
  const today = new Date().toISOString().split('T')[0]
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data: picks } = await supabaseAdmin
    .from('accumulator_picks')
    .select('*')
    .gte('match_date', today)
    .lte('match_date', threeDays)
    .is('result', null)
    .gte('safety_score', 65)
    .order('safety_score', { ascending: false })

  if (!picks || picks.length < 3) return []

  // Convert DB picks to AccumulatorPick format
  const accaPicks: AccumulatorPick[] = picks.map(
    (p: Record<string, unknown>) => ({
      fixture_id: p.fixture_id as string,
      team_id: p.team_id as string,
      team_name: '', // Will be enriched later
      opponent_name: '',
      league_name: '',
      match_date: p.match_date as string,
      is_home: p.is_home as boolean,
      dominance_score: Number(p.dominance_score),
      opponent_position: 0,
      opponent_zone: null,
      safety_score: Number(p.safety_score),
      risk_factors: (p.risk_factors as string[]) || [],
      recommended_market: p.recommended_market as AccumulatorPick['recommended_market'],
      min_odds_threshold: Number(p.min_odds_threshold),
      current_odds: p.current_odds ? Number(p.current_odds) : null,
      is_value: p.is_value as boolean,
      confidence: p.confidence as AccumulatorPick['confidence'],
    })
  )

  // Build combos at each risk level
  const allCombos: AccumulatorCombo[] = []

  const riskLevels = ['conservative', 'moderate', 'aggressive'] as const

  for (const risk of riskLevels) {
    const maxLegs =
      risk === 'conservative' ? 3 : risk === 'moderate' ? 4 : 6
    const minLegs = risk === 'conservative' ? 2 : 3
    const minSafety =
      risk === 'conservative' ? 80 : risk === 'moderate' ? 70 : 60

    const combos = buildAccumulatorCombos(accaPicks, {
      maxLegs,
      minLegs,
      minSafety,
      maxRisk: risk,
    })

    allCombos.push(...combos.slice(0, 3)) // Top 3 per risk level
  }

  // Save combos
  for (const combo of allCombos) {
    await supabaseAdmin.from('accumulator_combos').insert({
      user_id: userId || null,
      combo_date: today,
      picks: combo.picks.map((p) => ({
        fixture_id: p.fixture_id,
        team_id: p.team_id,
        team_name: p.team_name,
        opponent_name: p.opponent_name,
        market: p.recommended_market,
        odds: p.current_odds,
        safety_score: p.safety_score,
      })),
      total_odds: combo.total_odds,
      expected_win_rate: combo.expected_win_rate,
      expected_value: combo.expected_value,
      legs: combo.legs,
      risk_level: combo.risk_level,
      suggested_stake_pct: combo.suggested_stake_pct,
    })
  }

  return allCombos
}
