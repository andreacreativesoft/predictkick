import { notFound } from 'next/navigation'
import { ArrowLeft, Brain, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ExtendedMarketsPanel } from '@/components/match/extended-markets'
import { MatchSidebar } from '@/components/match/match-sidebar'

export const dynamic = 'force-dynamic'

// Bookmaker display names (nice labels for all known bookmaker API keys)
const BOOKMAKER_LABELS: Record<string, string> = {
  // Romanian bookmakers
  superbet: 'Superbet',
  casa_pariurilor: 'Casa Pariurilor',
  las_vegas: 'Las Vegas',
  baum_bet: 'Baum Bet',
  betano: 'Betano',
  suprabets: 'Suprabets',
  // International bookmakers
  bet365: 'Bet365',
  williamhill: 'William Hill',
  unibet: 'Unibet',
  unibet_eu: 'Unibet EU',
  unibet_se: 'Unibet SE',
  unibet_nl: 'Unibet NL',
  unibet_uk: 'Unibet UK',
  betfair: 'Betfair Exchange',
  betfair_ex_uk: 'Betfair Exchange',
  betfair_sb_uk: 'Betfair Sportsbook',
  pinnacle: 'Pinnacle',
  '1xbet': '1xBet',
  matchbook: 'Matchbook',
  betsson: 'Betsson',
  nordicbet: 'NordicBet',
  betonlineag: 'BetOnline',
  betanysports: 'BetAnySports',
  paddypower: 'Paddy Power',
  grosvenor: 'Grosvenor',
  casumo: 'Casumo',
  coolbet: 'Coolbet',
  leovegas_se: 'LeoVegas',
  betclic_fr: 'Betclic',
  parionssport_fr: 'Parions Sport',
  codere_it: 'Codere',
  marathon_bet: 'Marathon Bet',
  livescorebet_eu: 'LiveScore Bet',
  sport888: '888sport',
  coral: 'Coral',
  ladbrokes_uk: 'Ladbrokes',
  betway: 'Betway',
  skybet: 'Sky Bet',
  bodog: 'Bodog',
  bovada: 'Bovada',
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  betmgm: 'BetMGM',
  pointsbet_us: 'PointsBet',
  mybookieag: 'MyBookie',
  lowvig: 'LowVig',
  betus: 'BetUS',
  tipico_de: 'Tipico',
  everygame: 'Everygame',
  superbook: 'SuperBook',
  gtbets: 'GTBets',
  betrivers: 'BetRivers',
  williamhill_us: 'Caesars',
}

// Romanian bookmaker keys for ordering
const ROMANIAN_BOOKMAKERS = new Set(['superbet', 'casa_pariurilor', 'las_vegas', 'baum_bet', 'betano', 'suprabets'])

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: fixture } = await supabase
    .from('fixtures')
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(*),
      away_team:teams!fixtures_away_team_id_fkey(*),
      league:leagues!fixtures_league_id_fkey(*),
      predictions(*),
      odds_current(*),
      match_weather(*)
    `)
    .eq('id', id)
    .single()

  if (!fixture) notFound()

  // Fetch Romanian odds for this fixture
  const { data: romanianOdds } = await supabase
    .from('odds_romanian')
    .select('*')
    .eq('fixture_id', id)
    .eq('market', 'h2h')
    .order('bookmaker')

  // Fetch value alerts for this fixture
  const { data: valueAlerts } = await supabase
    .from('odds_value_alerts')
    .select('*')
    .eq('fixture_id', id)
    .order('edge_pct', { ascending: false })

  // Fetch odds history for bookmaker breakdown
  const { data: oddsHistory } = await supabase
    .from('odds_history')
    .select('bookmaker, home_odds, draw_odds, away_odds')
    .eq('fixture_id', id)
    .eq('market', 'h2h')
    .order('snapshot_at', { ascending: false })

  // Get latest odds per bookmaker from history
  const latestByBookmaker = new Map<string, Record<string, unknown>>()
  for (const row of oddsHistory || []) {
    if (!latestByBookmaker.has(row.bookmaker as string)) {
      latestByBookmaker.set(row.bookmaker as string, row)
    }
  }

  // Supabase returns single object for unique FK, array for non-unique
  const getFirst = (raw: unknown) => Array.isArray(raw) ? raw[0] : raw
  const prediction = getFirst(fixture.predictions) as Record<string, unknown> | null
  const odds = getFirst(fixture.odds_current) as Record<string, unknown> | null
  const weather = getFirst(fixture.match_weather) as Record<string, unknown> | null
  const homeTeam = fixture.home_team as unknown as Record<string, unknown>
  const awayTeam = fixture.away_team as unknown as Record<string, unknown>
  const league = fixture.league as unknown as Record<string, unknown>
  const valueBets = (prediction?.value_bets as Array<Record<string, unknown>>) || []
  const roOdds = (romanianOdds || []) as Array<Record<string, unknown>>
  const alerts = (valueAlerts || []) as Array<Record<string, unknown>>

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/matches" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Înapoi la Meciuri
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="text-xs text-muted mb-4">{String(league?.name)} &middot; {new Date(fixture.match_date).toLocaleDateString('ro-RO', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} ora {new Date(fixture.match_date).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</div>

        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xl font-bold text-foreground">{String(homeTeam?.name)}</p>
            <p className="text-xs text-muted mt-1">Gazde</p>
          </div>

          {prediction ? (
            <div className="text-center px-8">
              <div className="text-3xl font-bold text-accent">
                {String(prediction.predicted_score_home)}-{String(prediction.predicted_score_away)}
              </div>
              <p className="text-xs text-muted mt-1">Scor Prezis</p>
            </div>
          ) : (
            <div className="text-center px-8">
              <div className="text-3xl font-bold text-muted">vs</div>
            </div>
          )}

          <div className="text-center flex-1">
            <p className="text-xl font-bold text-foreground">{String(awayTeam?.name)}</p>
            <p className="text-xs text-muted mt-1">Oaspeți</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Prediction panel */}
        <div className="lg:col-span-2 space-y-4">
          {prediction && (
            <>
              {/* Probabilities */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" /> Probabilități Meci
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Victorie Gazde', value: Number(prediction.home_win_prob), color: 'bg-accent' },
                    { label: 'Egal', value: Number(prediction.draw_prob), color: 'bg-warning' },
                    { label: 'Victorie Oaspeți', value: Number(prediction.away_win_prob), color: 'bg-danger' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">{item.label}</span>
                        <span className="font-semibold text-foreground">{item.value.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-xs text-muted">Peste 2.5</p>
                    <p className="text-sm font-bold text-foreground">{Number(prediction.over_25_prob).toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted">GG Da</p>
                    <p className="text-sm font-bold text-foreground">{Number(prediction.btts_yes_prob).toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted">Încredere</p>
                    <p className="text-sm font-bold text-accent">{Number(prediction.confidence_score).toFixed(0)}%</p>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {prediction.ai_analysis && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-accent" /> Analiză AI
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{String(prediction.ai_analysis)}</p>

                  {Array.isArray(prediction.key_factors) && prediction.key_factors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-foreground mb-2">Factori Cheie</p>
                      <ul className="space-y-1">
                        {(prediction.key_factors as string[]).map((factor: string, i: number) => (
                          <li key={i} className="text-xs text-muted flex items-start gap-1.5">
                            <TrendingUp className="w-3 h-3 text-success mt-0.5 flex-shrink-0" />
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(prediction.risk_factors) && prediction.risk_factors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-foreground mb-2">Factori de Risc</p>
                      <ul className="space-y-1">
                        {(prediction.risk_factors as string[]).map((risk: string, i: number) => (
                          <li key={i} className="text-xs text-muted flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-warning mt-0.5 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Extended Markets - All Predictions */}
          {prediction && (
            <ExtendedMarketsPanel fixtureId={id} />
          )}

          {!prediction && (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Brain className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Nicio predicție generată încă</p>
              <p className="text-xs text-muted mt-1">Rulează job-ul de predicții pentru a analiza acest meci.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <MatchSidebar
          fixtureId={id}
          roRows={roOdds.map((ro) => ({
            key: String(ro.bookmaker),
            name: BOOKMAKER_LABELS[String(ro.bookmaker)] || String(ro.bookmaker),
            home: Number(ro.home_odds),
            draw: Number(ro.draw_odds),
            away: Number(ro.away_odds),
            isRomanian: true,
          }))}
          intlRows={Array.from(latestByBookmaker.entries()).map(([bk, row]) => ({
            key: bk,
            name: BOOKMAKER_LABELS[bk] || bk.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            home: Number(row.home_odds),
            draw: Number(row.draw_odds),
            away: Number(row.away_odds),
            isRomanian: false,
          }))}
          valueBets={valueBets.map(vb => ({
            selection: String(vb.selection),
            edge: Number(vb.edge),
            best_odds: Number(vb.best_odds),
            bookmaker: String(vb.bookmaker),
            kelly_stake_pct: Number(vb.kelly_stake_pct),
          }))}
          alerts={alerts.map(a => ({
            bookmaker: String(a.bookmaker),
            selection: String(a.selection),
            romanian_odds: Number(a.romanian_odds),
            international_avg: Number(a.international_avg),
            edge_pct: Number(a.edge_pct),
          }))}
          weather={weather ? {
            pre_temperature: Number(weather.pre_temperature),
            pre_wind_speed: Number(weather.pre_wind_speed),
            pre_rain_probability: Number(weather.pre_rain_probability),
            pre_condition: String(weather.pre_condition),
            weather_impact_description: weather.weather_impact_description ? String(weather.weather_impact_description) : undefined,
          } : null}
          venue={fixture.venue || null}
          referee={fixture.referee || null}
          modelVersion={prediction?.model_version ? String(prediction.model_version) : null}
          homeTeamId={String(homeTeam?.id)}
          awayTeamId={String(awayTeam?.id)}
          bookmakerLabels={BOOKMAKER_LABELS}
        />
      </div>
    </div>
  )
}
