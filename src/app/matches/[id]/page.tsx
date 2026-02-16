import { notFound } from 'next/navigation'
import { ArrowLeft, Brain, BarChart3, TrendingUp, Cloud, Shield, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

  const prediction = (fixture.predictions as unknown as Array<Record<string, unknown>>)?.[0]
  const odds = (fixture.odds_current as unknown as Array<Record<string, unknown>>)?.[0]
  const weather = (fixture.match_weather as unknown as Array<Record<string, unknown>>)?.[0]
  const homeTeam = fixture.home_team as unknown as Record<string, unknown>
  const awayTeam = fixture.away_team as unknown as Record<string, unknown>
  const league = fixture.league as unknown as Record<string, unknown>
  const valueBets = (prediction?.value_bets as Array<Record<string, unknown>>) || []

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/matches" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Matches
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="text-xs text-muted mb-4">{String(league?.name)} &middot; {new Date(fixture.match_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(fixture.match_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>

        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-xl font-bold text-foreground">{String(homeTeam?.name)}</p>
            <p className="text-xs text-muted mt-1">Home</p>
          </div>

          {prediction ? (
            <div className="text-center px-8">
              <div className="text-3xl font-bold text-accent">
                {String(prediction.predicted_score_home)}-{String(prediction.predicted_score_away)}
              </div>
              <p className="text-xs text-muted mt-1">Predicted Score</p>
            </div>
          ) : (
            <div className="text-center px-8">
              <div className="text-3xl font-bold text-muted">vs</div>
            </div>
          )}

          <div className="text-center flex-1">
            <p className="text-xl font-bold text-foreground">{String(awayTeam?.name)}</p>
            <p className="text-xs text-muted mt-1">Away</p>
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
                  <BarChart3 className="w-4 h-4 text-accent" /> Match Probabilities
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Home Win', value: Number(prediction.home_win_prob), color: 'bg-accent' },
                    { label: 'Draw', value: Number(prediction.draw_prob), color: 'bg-warning' },
                    { label: 'Away Win', value: Number(prediction.away_win_prob), color: 'bg-danger' },
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
                    <p className="text-xs text-muted">Over 2.5</p>
                    <p className="text-sm font-bold text-foreground">{Number(prediction.over_25_prob).toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted">BTTS Yes</p>
                    <p className="text-sm font-bold text-foreground">{Number(prediction.btts_yes_prob).toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted">Confidence</p>
                    <p className="text-sm font-bold text-accent">{Number(prediction.confidence_score).toFixed(0)}%</p>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {prediction.ai_analysis && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-accent" /> AI Analysis
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{String(prediction.ai_analysis)}</p>

                  {Array.isArray(prediction.key_factors) && prediction.key_factors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-foreground mb-2">Key Factors</p>
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
                      <p className="text-xs font-semibold text-foreground mb-2">Risk Factors</p>
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

          {!prediction && (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Brain className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No prediction generated yet</p>
              <p className="text-xs text-muted mt-1">Run the generate-predictions cron job to analyze this match.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Best Odds */}
          {odds && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Best Odds</h3>
              <div className="space-y-2">
                {[
                  { label: 'Home', odds: odds.best_home_odds, book: odds.best_home_bookmaker },
                  { label: 'Draw', odds: odds.best_draw_odds, book: odds.best_draw_bookmaker },
                  { label: 'Away', odds: odds.best_away_odds, book: odds.best_away_bookmaker },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-2 bg-background rounded-lg">
                    <span className="text-xs text-muted">{item.label}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">{Number(item.odds).toFixed(2)}</span>
                      <span className="text-[10px] text-muted ml-1">{String(item.book)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Value Bets */}
          {valueBets.length > 0 && (
            <div className="bg-card border border-success/20 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-success mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Value Bets
              </h3>
              <div className="space-y-2">
                {valueBets.map((vb, i) => (
                  <div key={i} className="p-2 bg-success/5 rounded-lg border border-success/10">
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-foreground capitalize">{String(vb.selection)}</span>
                      <span className="text-xs font-bold text-success">+{(Number(vb.edge) * 100).toFixed(1)}% edge</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted">@ {Number(vb.best_odds).toFixed(2)} ({String(vb.bookmaker)})</span>
                      <span className="text-[10px] text-muted">Kelly: {Number(vb.kelly_stake_pct).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weather */}
          {weather && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-accent" /> Weather
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted">Temp:</span> <span className="text-foreground">{Number(weather.pre_temperature)}°C</span></div>
                <div><span className="text-muted">Wind:</span> <span className="text-foreground">{Number(weather.pre_wind_speed)} m/s</span></div>
                <div><span className="text-muted">Rain:</span> <span className="text-foreground">{Number(weather.pre_rain_probability)}%</span></div>
                <div><span className="text-muted">Condition:</span> <span className="text-foreground capitalize">{String(weather.pre_condition)}</span></div>
              </div>
              {weather.weather_impact_description ? (
                <p className="text-[10px] text-muted mt-2 pt-2 border-t border-border">{String(weather.weather_impact_description)}</p>
              ) : null}
            </div>
          )}

          {/* Match Info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" /> Match Info
            </h3>
            <div className="space-y-2 text-xs">
              {fixture.venue && <div><span className="text-muted">Venue:</span> <span className="text-foreground">{fixture.venue}</span></div>}
              {fixture.referee && <div><span className="text-muted">Referee:</span> <span className="text-foreground">{fixture.referee}</span></div>}
              {prediction?.model_version && <div><span className="text-muted">Model:</span> <span className="text-foreground">{String(prediction.model_version)}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
