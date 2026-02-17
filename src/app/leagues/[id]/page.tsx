import { notFound } from 'next/navigation'
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiId = Number(id)
  const supabase = await createClient()

  // Fetch league by api_id
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('api_id', apiId)
    .single()

  if (!league) notFound()

  // Fetch current season standings
  const now = new Date()
  const season = (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1).toString()

  const { data: standings } = await supabase
    .from('standings')
    .select('*, team:teams(id, name, short_name, logo_url)')
    .eq('league_id', league.id)
    .eq('season', season)
    .order('position', { ascending: true })

  // Fetch upcoming fixtures for this league
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(id, name, short_name),
      away_team:teams!fixtures_away_team_id_fkey(id, name, short_name)
    `)
    .eq('league_id', league.id)
    .eq('status', 'scheduled')
    .gte('match_date', new Date().toISOString())
    .order('match_date', { ascending: true })
    .limit(20)

  const upcomingMatches = fixtures || []

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/leagues" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Leagues
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{league.name}</h1>
        <p className="text-sm text-muted mt-1">{league.country} &middot; Season {season}/{Number(season) + 1}</p>
      </div>

      {/* Standings table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" /> Standings
        </h3>

        {!standings || standings.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No standings data available. Run the sync-standings cron job.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="pb-2 pr-2 w-8">#</th>
                  <th className="pb-2 pr-4">Team</th>
                  <th className="pb-2 pr-2 text-center">P</th>
                  <th className="pb-2 pr-2 text-center">W</th>
                  <th className="pb-2 pr-2 text-center">D</th>
                  <th className="pb-2 pr-2 text-center">L</th>
                  <th className="pb-2 pr-2 text-center">GF</th>
                  <th className="pb-2 pr-2 text-center">GA</th>
                  <th className="pb-2 pr-2 text-center">GD</th>
                  <th className="pb-2 pr-2 text-center">Pts</th>
                  <th className="pb-2 text-center">Form</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const team = row.team as unknown as { id: string; name: string; short_name: string | null } | null
                  const gd = Number(row.goals_for || 0) - Number(row.goals_against || 0)
                  const formStr = typeof row.form_last5 === 'string' ? row.form_last5 : ''

                  // Zone coloring
                  const pos = Number(row.position)
                  let zoneBorder = ''
                  if (pos <= 4) zoneBorder = 'border-l-2 border-l-success'
                  else if (pos <= 6) zoneBorder = 'border-l-2 border-l-accent'
                  else if (pos >= (standings.length - 2)) zoneBorder = 'border-l-2 border-l-danger'

                  return (
                    <tr key={row.id} className={`border-b border-border/50 ${zoneBorder}`}>
                      <td className="py-2 pr-2 text-muted font-semibold">{pos}</td>
                      <td className="py-2 pr-4 text-foreground font-medium">
                        {team?.short_name || team?.name || 'Unknown'}
                      </td>
                      <td className="py-2 pr-2 text-center text-muted">{row.played}</td>
                      <td className="py-2 pr-2 text-center text-foreground">{row.won}</td>
                      <td className="py-2 pr-2 text-center text-muted">{row.drawn}</td>
                      <td className="py-2 pr-2 text-center text-muted">{row.lost}</td>
                      <td className="py-2 pr-2 text-center text-muted">{row.goals_for}</td>
                      <td className="py-2 pr-2 text-center text-muted">{row.goals_against}</td>
                      <td className={`py-2 pr-2 text-center font-semibold ${gd > 0 ? 'text-success' : gd < 0 ? 'text-danger' : 'text-muted'}`}>
                        {gd > 0 ? `+${gd}` : gd}
                      </td>
                      <td className="py-2 pr-2 text-center text-foreground font-bold">{row.points}</td>
                      <td className="py-2 text-center">
                        <div className="flex gap-0.5 justify-center">
                          {formStr.split('').slice(-5).map((ch, i) => (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold ${
                                ch === 'W' ? 'bg-success/20 text-success' :
                                ch === 'D' ? 'bg-warning/20 text-warning' :
                                ch === 'L' ? 'bg-danger/20 text-danger' :
                                'bg-muted/20 text-muted'
                              }`}
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Zone legend */}
        {standings && standings.length > 0 && (
          <div className="flex gap-4 mt-4 pt-3 border-t border-border text-[10px] text-muted">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-success" /> Champions League
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-accent" /> Europa League
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-danger" /> Relegation
            </div>
          </div>
        )}
      </div>

      {/* Upcoming fixtures */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Fixtures</h3>

        {upcomingMatches.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No upcoming fixtures</p>
        ) : (
          <div className="space-y-2">
            {upcomingMatches.map((match) => {
              const home = match.home_team as unknown as { name: string; short_name: string | null } | null
              const away = match.away_team as unknown as { name: string; short_name: string | null } | null
              const date = new Date(match.match_date)

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border border-border/50 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-center w-16">
                      <p className="text-[10px] text-muted">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs font-semibold text-foreground">{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{home?.short_name || home?.name || 'TBD'}</span>
                        <span className="text-muted mx-2">vs</span>
                        <span className="font-semibold">{away?.short_name || away?.name || 'TBD'}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
