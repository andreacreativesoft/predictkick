import { supabaseAdmin } from '@/lib/supabase/admin'
import { PREDICTION_WEIGHTS, MIN_VALUE_EDGE } from '@/lib/utils/constants'
import { normalizeProbabilities, generateScoreProbabilities, kellyFraction, calculateEdge } from '@/lib/utils/probability'
import { analyzeStats } from './stats-analyzer'
import { analyzeH2H } from './h2h-analyzer'
import { analyzePositionContext } from './position-context'
import { analyzeCrossCompetition } from './cross-competition'
import { analyzeSquad } from './squad-analyzer'
import { analyzeContextualFactors } from './contextual-analyzer'
import { analyzeWeather } from './weather-impact'
import { analyzeReferee } from './referee-analyzer'
import { analyzeMarket } from './odds-analyzer'
import { analyzePrediction as claudeAnalyze } from '@/lib/api/claude-api'
import { detectValueBets } from './value-detector'
import type { PredictionResult, AnalyzerScore } from '@/lib/types/prediction'

export async function generatePrediction(fixtureId: string): Promise<PredictionResult> {
  // 1. Gather all data
  const { data: fixture } = await supabaseAdmin
    .from('fixtures')
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(*),
      away_team:teams!fixtures_away_team_id_fkey(*),
      league:leagues!fixtures_league_id_fkey(*)
    `)
    .eq('id', fixtureId)
    .single()

  if (!fixture) throw new Error(`Fixture ${fixtureId} not found`)

  const season = new Date(fixture.match_date).getFullYear().toString()

  // Fetch all supporting data in parallel
  const [
    homeStandings,
    awayStandings,
    h2hData,
    homeSchedule,
    awaySchedule,
    injuries,
    contextFactors,
    weather,
    odds,
    oddsHistory,
    manualInputs,
  ] = await Promise.all([
    supabaseAdmin.from('standings').select('*').eq('team_id', fixture.home_team_id).eq('season', season).single().then(r => r.data),
    supabaseAdmin.from('standings').select('*').eq('team_id', fixture.away_team_id).eq('season', season).single().then(r => r.data),
    supabaseAdmin.from('h2h_records').select('*').or(`and(team_a_id.eq.${fixture.home_team_id},team_b_id.eq.${fixture.away_team_id}),and(team_a_id.eq.${fixture.away_team_id},team_b_id.eq.${fixture.home_team_id})`).single().then(r => r.data),
    supabaseAdmin.from('team_schedule_context').select('*').eq('team_id', fixture.home_team_id).eq('fixture_id', fixtureId).single().then(r => r.data),
    supabaseAdmin.from('team_schedule_context').select('*').eq('team_id', fixture.away_team_id).eq('fixture_id', fixtureId).single().then(r => r.data),
    supabaseAdmin.from('player_availability').select('*, player:players(*)').or(`team_id.eq.${fixture.home_team_id},team_id.eq.${fixture.away_team_id}`).eq('fixture_id', fixtureId).then(r => r.data || []),
    supabaseAdmin.from('contextual_factors').select('*').or(`team_id.eq.${fixture.home_team_id},team_id.eq.${fixture.away_team_id}`).eq('is_active', true).then(r => r.data || []),
    supabaseAdmin.from('match_weather').select('*').eq('fixture_id', fixtureId).single().then(r => r.data),
    supabaseAdmin.from('odds_current').select('*').eq('fixture_id', fixtureId).eq('market', 'h2h').single().then(r => r.data),
    supabaseAdmin.from('odds_history').select('*').eq('fixture_id', fixtureId).eq('market', 'h2h').order('snapshot_at', { ascending: false }).limit(50).then(r => r.data || []),
    supabaseAdmin.from('manual_inputs').select('*').eq('fixture_id', fixtureId).eq('is_processed', false).then(r => r.data || []),
  ])

  // 2. Run each analyzer
  const statsScore = analyzeStats(homeStandings, awayStandings)
  const h2hScore = analyzeH2H(h2hData, fixture.home_team_id!)
  const positionScore = analyzePositionContext(homeStandings, awayStandings)
  const crossCompScore = analyzeCrossCompetition(homeSchedule, awaySchedule)
  const squadScore = analyzeSquad(injuries, fixture.home_team_id!, fixture.away_team_id!)
  const contextScore = analyzeContextualFactors(contextFactors, fixture.home_team_id!)
  const weatherScore = analyzeWeather(weather)
  const refereeScore = analyzeReferee(fixture.referee)
  const marketScore = analyzeMarket(odds, oddsHistory)

  // 3. Weighted combination
  const factors: Record<string, { score: AnalyzerScore; weight: number }> = {
    current_form: { score: statsScore, weight: PREDICTION_WEIGHTS.current_form },
    season_stats: { score: statsScore, weight: PREDICTION_WEIGHTS.season_stats },
    h2h_record: { score: h2hScore, weight: PREDICTION_WEIGHTS.h2h_record },
    home_away_splits: { score: statsScore, weight: PREDICTION_WEIGHTS.home_away_splits },
    scoring_patterns: { score: statsScore, weight: PREDICTION_WEIGHTS.scoring_patterns },
    injuries_suspensions: { score: squadScore, weight: PREDICTION_WEIGHTS.injuries_suspensions },
    fatigue_rotation: { score: crossCompScore, weight: PREDICTION_WEIGHTS.fatigue_rotation },
    lineup_quality: { score: squadScore, weight: PREDICTION_WEIGHTS.lineup_quality },
    league_position_context: { score: positionScore, weight: PREDICTION_WEIGHTS.league_position_context },
    cross_competition: { score: crossCompScore, weight: PREDICTION_WEIGHTS.cross_competition },
    psychological_factors: { score: contextScore, weight: PREDICTION_WEIGHTS.psychological_factors },
    referee_factor: { score: refereeScore, weight: PREDICTION_WEIGHTS.referee_factor },
    bookmaker_consensus: { score: marketScore, weight: PREDICTION_WEIGHTS.bookmaker_consensus },
    odds_movement: { score: marketScore, weight: PREDICTION_WEIGHTS.odds_movement },
    sharp_vs_public: { score: marketScore, weight: PREDICTION_WEIGHTS.sharp_vs_public },
    weather: { score: weatherScore, weight: PREDICTION_WEIGHTS.weather },
    travel_conditions: { score: crossCompScore, weight: PREDICTION_WEIGHTS.travel_conditions },
  }

  // Weighted sum
  let homeProb = 0
  let drawProb = 0
  let awayProb = 0
  let totalWeight = 0

  for (const [, { score, weight }] of Object.entries(factors)) {
    homeProb += score.home * weight
    drawProb += score.draw * weight
    awayProb += score.away * weight
    totalWeight += weight
  }

  // Normalize to exclude AI weight (0.95 total)
  homeProb /= totalWeight
  drawProb /= totalWeight
  awayProb /= totalWeight

  const normalized = normalizeProbabilities(homeProb, drawProb, awayProb)

  // 4. Calculate goal expectations and derived markets
  const homeGoals = (homeStandings?.avg_goals_scored || 1.3) * (awayStandings?.avg_goals_conceded || 1.3) / 1.3
  const awayGoals = (awayStandings?.avg_goals_scored || 1.1) * (homeStandings?.avg_goals_conceded || 1.1) / 1.3

  const scoreProbabilities = generateScoreProbabilities(homeGoals, awayGoals)

  // Over/Under 2.5
  let over25 = 0
  for (const { homeGoals: h, awayGoals: a, probability } of scoreProbabilities) {
    if (h + a > 2.5) over25 += probability
  }

  // BTTS
  let bttsYes = 0
  for (const { homeGoals: h, awayGoals: a, probability } of scoreProbabilities) {
    if (h > 0 && a > 0) bttsYes += probability
  }

  // Data completeness
  const dataPoints = [
    homeStandings, awayStandings, h2hData, homeSchedule, awaySchedule,
    injuries.length > 0 ? true : null, weather, odds
  ]
  const dataCompleteness = dataPoints.filter(Boolean).length / dataPoints.length * 100

  const rawPrediction = {
    home_win_prob: normalized.home * 100,
    draw_prob: normalized.draw * 100,
    away_win_prob: normalized.away * 100,
    over_25_prob: over25 * 100,
    under_25_prob: (1 - over25) * 100,
    btts_yes_prob: bttsYes * 100,
    btts_no_prob: (1 - bttsYes) * 100,
    predicted_home_goals: Number(homeGoals.toFixed(2)),
    predicted_away_goals: Number(awayGoals.toFixed(2)),
    confidence_score: dataCompleteness * (statsScore.confidence + marketScore.confidence) / 2,
    data_completeness: dataCompleteness,
  }

  // 5. AI Synthesis (5% weight)
  let aiAnalysis = ''
  let keyFactors: string[] = []
  let riskFactors: string[] = []

  try {
    const homeTeam = fixture.home_team as { name: string }
    const awayTeam = fixture.away_team as { name: string }
    const league = fixture.league as { name: string }

    const aiResult = await claudeAnalyze({
      fixture_summary: `${homeTeam.name} vs ${awayTeam.name} - ${league.name} - ${fixture.match_date}`,
      stats_data: { home: homeStandings, away: awayStandings },
      h2h_data: h2hData || {},
      injuries: injuries,
      context_factors: contextFactors,
      weather: weather || {},
      odds: odds || {},
      manual_inputs: manualInputs,
      raw_prediction: rawPrediction,
    })

    // Apply AI adjustments (clamped to ±5%)
    rawPrediction.home_win_prob += Math.max(-5, Math.min(5, aiResult.probability_adjustments.home_win * 100))
    rawPrediction.draw_prob += Math.max(-5, Math.min(5, aiResult.probability_adjustments.draw * 100))
    rawPrediction.away_win_prob += Math.max(-5, Math.min(5, aiResult.probability_adjustments.away_win * 100))

    // Re-normalize
    const total = rawPrediction.home_win_prob + rawPrediction.draw_prob + rawPrediction.away_win_prob
    rawPrediction.home_win_prob = rawPrediction.home_win_prob / total * 100
    rawPrediction.draw_prob = rawPrediction.draw_prob / total * 100
    rawPrediction.away_win_prob = rawPrediction.away_win_prob / total * 100

    aiAnalysis = aiResult.narrative
    keyFactors = aiResult.key_factors
    riskFactors = aiResult.risk_factors
  } catch (err) {
    console.error('AI synthesis failed, using raw prediction:', err)
    aiAnalysis = 'AI analysis unavailable.'
  }

  // 6. Most likely scores
  const topScores = scoreProbabilities
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5)
    .map(s => ({ score: `${s.homeGoals}-${s.awayGoals}`, probability: Number((s.probability * 100).toFixed(1)) }))

  // 7. Detect value bets
  const valueBets = detectValueBets(rawPrediction, odds)

  // 8. Build final result
  const result: PredictionResult = {
    fixture_id: fixtureId,
    ...rawPrediction,
    predicted_score_home: topScores[0] ? parseInt(topScores[0].score.split('-')[0]) : Math.round(homeGoals),
    predicted_score_away: topScores[0] ? parseInt(topScores[0].score.split('-')[1]) : Math.round(awayGoals),
    top_5_scores: topScores,
    ht_home_win_prob: rawPrediction.home_win_prob * 0.7,
    ht_draw_prob: rawPrediction.draw_prob * 1.4,
    ht_away_win_prob: rawPrediction.away_win_prob * 0.7,
    factor_weights: PREDICTION_WEIGHTS,
    factor_details: factors as unknown as Record<string, AnalyzerScore>,
    value_bets: valueBets,
    ai_analysis: aiAnalysis,
    key_factors: keyFactors,
    risk_factors: riskFactors,
    context_applied: { contextFactors: contextFactors.length, manualInputs: manualInputs.length },
    weather_impact: weather?.weather_impact_description || null,
    injury_impact: injuries.length > 0 ? `${injuries.length} players affected` : null,
    fatigue_impact: homeSchedule?.fatigue_score && homeSchedule.fatigue_score > 0.6 ? 'High fatigue detected' : null,
    position_impact: positionScore.details?.description as string || null,
    model_version: 'v2.0',
  }

  // 9. Save to database
  await supabaseAdmin.from('predictions').upsert({
    fixture_id: fixtureId,
    home_win_prob: result.home_win_prob,
    draw_prob: result.draw_prob,
    away_win_prob: result.away_win_prob,
    over_25_prob: result.over_25_prob,
    under_25_prob: result.under_25_prob,
    btts_yes_prob: result.btts_yes_prob,
    btts_no_prob: result.btts_no_prob,
    predicted_home_goals: result.predicted_home_goals,
    predicted_away_goals: result.predicted_away_goals,
    predicted_score_home: result.predicted_score_home,
    predicted_score_away: result.predicted_score_away,
    top_5_scores: result.top_5_scores,
    ht_home_win_prob: result.ht_home_win_prob,
    ht_draw_prob: result.ht_draw_prob,
    ht_away_win_prob: result.ht_away_win_prob,
    confidence_score: result.confidence_score,
    data_completeness: result.data_completeness,
    factor_weights: result.factor_weights,
    factor_details: result.factor_details as unknown as Record<string, unknown>,
    value_bets: result.value_bets,
    ai_analysis: result.ai_analysis,
    key_factors: result.key_factors,
    risk_factors: result.risk_factors,
    context_applied: result.context_applied,
    weather_impact: result.weather_impact,
    injury_impact: result.injury_impact,
    fatigue_impact: result.fatigue_impact,
    position_impact: result.position_impact,
    model_version: result.model_version,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'fixture_id' })

  // Mark manual inputs as processed
  if (manualInputs.length > 0) {
    await supabaseAdmin
      .from('manual_inputs')
      .update({ is_processed: true })
      .in('id', manualInputs.map(m => m.id))
  }

  return result
}
