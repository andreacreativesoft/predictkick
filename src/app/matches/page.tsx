import { Trophy, TrendingUp, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function MatchesPage() {
  const supabase = await createClient()

  // Fetch upcoming fixtures with teams, predictions, and odds
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(id, name, short_name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, short_name, logo_url),
      league:leagues!fixtures_league_id_fkey(id, name, country, logo_url),
      predictions(
        home_win_prob, draw_prob, away_win_prob,
        predicted_score_home, predicted_score_away,
        confidence_score, value_bets
      ),
      odds_current(
        best_home_odds, best_home_bookmaker,
        best_draw_odds, best_draw_bookmaker,
        best_away_odds, best_away_bookmaker
      )
    `)
    .eq('status', 'scheduled')
    .gte('match_date', new Date().toISOString())
    .order('match_date', { ascending: true })
    .limit(50)

  const matches = fixtures || []

  // Group by date
  const grouped = matches.reduce<Record<string, typeof matches>>((acc, match) => {
    const date = new Date(match.match_date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(match)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Matches</h1>
          <p className="text-sm text-muted mt-1">
            Upcoming fixtures with AI predictions and odds
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-accent/10 text-accent text-sm rounded-lg border border-accent/20">
            All Leagues
          </button>
          <button className="px-3 py-1.5 bg-background text-muted text-sm rounded-lg border border-border hover:text-foreground">
            Value Bets Only
          </button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No upcoming matches
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            Run the sync-fixtures cron job to load upcoming fixtures from the API.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dateMatches]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              {date}
            </h2>
            <div className="space-y-3">
              {dateMatches.map((match) => {
                const prediction = (match.predictions as unknown as Array<Record<string, unknown>>)?.[0]
                const odds = (match.odds_current as unknown as Array<Record<string, unknown>>)?.[0]
                const homeTeam = match.home_team as unknown as { name: string; short_name: string | null; logo_url: string | null }
                const awayTeam = match.away_team as unknown as { name: string; short_name: string | null; logo_url: string | null }
                const league = match.league as unknown as { name: string; logo_url: string | null }
                const valueBets = (prediction?.value_bets as Array<Record<string, unknown>>) || []
                const hasValue = valueBets.length > 0

                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="block bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">{league?.name}</span>
                        {hasValue && (
                          <span className="px-1.5 py-0.5 bg-success/10 text-success text-[10px] font-bold rounded">
                            VALUE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Clock className="w-3 h-3" />
                        {new Date(match.match_date).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Teams */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {homeTeam?.short_name || homeTeam?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {awayTeam?.short_name || awayTeam?.name}
                          </span>
                        </div>
                      </div>

                      {/* Prediction */}
                      {prediction ? (
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-foreground">
                              {String(prediction.predicted_score_home)}-{String(prediction.predicted_score_away)}
                            </div>
                            <div className="text-[10px] text-muted">Predicted</div>
                          </div>

                          {/* Probability bars */}
                          <div className="w-24 space-y-1">
                            <ProbBar
                              label="H"
                              value={Number(prediction.home_win_prob)}
                              color="text-accent"
                            />
                            <ProbBar
                              label="D"
                              value={Number(prediction.draw_prob)}
                              color="text-muted"
                            />
                            <ProbBar
                              label="A"
                              value={Number(prediction.away_win_prob)}
                              color="text-danger"
                            />
                          </div>

                          {/* Confidence */}
                          <div className="text-center w-12">
                            <div className="text-xs font-bold text-accent">
                              {Number(prediction.confidence_score).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-muted">Conf</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">No prediction yet</span>
                      )}

                      {/* Odds */}
                      {odds && (
                        <div className="hidden lg:flex items-center gap-2 ml-4">
                          <OddsBadge label="H" odds={Number(odds.best_home_odds)} />
                          <OddsBadge label="D" odds={Number(odds.best_draw_odds)} />
                          <OddsBadge label="A" odds={Number(odds.best_away_odds)} />
                        </div>
                      )}

                      <ChevronRight className="w-4 h-4 text-muted ml-2" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] w-3 text-muted">{label}</span>
      <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color === 'text-accent' ? 'bg-accent' : color === 'text-danger' ? 'bg-danger' : 'bg-muted'}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[10px] w-8 text-right text-muted">{value.toFixed(0)}%</span>
    </div>
  )
}

function OddsBadge({ label, odds }: { label: string; odds: number }) {
  if (!odds) return null
  return (
    <div className="text-center px-2 py-1 bg-background rounded border border-border min-w-[48px]">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="text-xs font-semibold text-foreground">{odds.toFixed(2)}</div>
    </div>
  )
}
