import { Target, TrendingUp, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AccuracyPage() {
  const supabase = await createClient()

  // Get completed predictions with actual results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settled } = await supabase
    .from('predictions')
    .select(`
      *,
      fixture:fixtures!predictions_fixture_id_fkey(
        status, home_score, away_score,
        home_team:teams!fixtures_home_team_id_fkey(name, short_name),
        away_team:teams!fixtures_away_team_id_fkey(name, short_name)
      )
    `)
    .not('fixture_id', 'is', null)
    .limit(100) as { data: Array<Record<string, any>> | null }

  const predictions = (settled || []).filter((p: Record<string, any>) => {
    const f = p.fixture as { status: string } | null
    return f?.status === 'finished'
  })

  // Calculate accuracy metrics
  let correctResults = 0
  let correctScores = 0
  let totalPredicted = predictions.length

  for (const pred of predictions as Array<Record<string, any>>) {
    const f = pred.fixture as { home_score: number; away_score: number }
    if (!f) continue

    // Was the 1X2 result correct?
    const actualResult = f.home_score > f.away_score ? 'home' : f.home_score < f.away_score ? 'away' : 'draw'
    const predictedResult =
      (pred.home_win_prob || 0) > (pred.draw_prob || 0) && (pred.home_win_prob || 0) > (pred.away_win_prob || 0) ? 'home' :
      (pred.away_win_prob || 0) > (pred.draw_prob || 0) ? 'away' : 'draw'

    if (actualResult === predictedResult) correctResults++
    if (f.home_score === pred.predicted_score_home && f.away_score === pred.predicted_score_away) correctScores++
  }

  const resultAccuracy = totalPredicted > 0 ? (correctResults / totalPredicted * 100) : 0
  const scoreAccuracy = totalPredicted > 0 ? (correctScores / totalPredicted * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Prediction Accuracy</h1>
        <p className="text-sm text-muted mt-1">Track how well the AI predictions perform against actual results</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <Target className="w-8 h-8 text-accent mx-auto mb-2" />
          <p className="text-3xl font-bold text-foreground">{resultAccuracy.toFixed(0)}%</p>
          <p className="text-xs text-muted mt-1">1X2 Result Accuracy</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <TrendingUp className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="text-3xl font-bold text-foreground">{scoreAccuracy.toFixed(0)}%</p>
          <p className="text-xs text-muted mt-1">Exact Score Accuracy</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <BarChart3 className="w-8 h-8 text-warning mx-auto mb-2" />
          <p className="text-3xl font-bold text-foreground">{totalPredicted}</p>
          <p className="text-xs text-muted mt-1">Predictions Evaluated</p>
        </div>
      </div>

      {/* Recent predictions vs actuals */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Predictions vs Actuals</h3>
        {predictions.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No settled predictions yet. Wait for match results to evaluate accuracy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="pb-2 pr-4">Match</th>
                  <th className="pb-2 pr-4">Predicted</th>
                  <th className="pb-2 pr-4">Actual</th>
                  <th className="pb-2 pr-4">Confidence</th>
                  <th className="pb-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 20).map((pred: Record<string, any>) => {
                  const f = pred.fixture as {
                    home_score: number; away_score: number;
                    home_team: { name: string; short_name: string | null };
                    away_team: { name: string; short_name: string | null };
                  }
                  const isCorrectScore = f.home_score === pred.predicted_score_home && f.away_score === pred.predicted_score_away
                  const actualResult = f.home_score > f.away_score ? 'home' : f.home_score < f.away_score ? 'away' : 'draw'
                  const predictedResult = (pred.home_win_prob || 0) > (pred.draw_prob || 0) && (pred.home_win_prob || 0) > (pred.away_win_prob || 0) ? 'home' : (pred.away_win_prob || 0) > (pred.draw_prob || 0) ? 'away' : 'draw'
                  const isCorrectResult = actualResult === predictedResult

                  return (
                    <tr key={pred.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-foreground">{f.home_team.short_name || f.home_team.name} vs {f.away_team.short_name || f.away_team.name}</td>
                      <td className="py-2 pr-4 text-foreground font-mono">{pred.predicted_score_home}-{pred.predicted_score_away}</td>
                      <td className="py-2 pr-4 text-foreground font-mono">{f.home_score}-{f.away_score}</td>
                      <td className="py-2 pr-4 text-muted">{(pred.confidence_score || 0).toFixed(0)}%</td>
                      <td className="py-2">
                        {isCorrectScore ? (
                          <span className="px-1.5 py-0.5 bg-success/10 text-success text-[10px] font-bold rounded">EXACT</span>
                        ) : isCorrectResult ? (
                          <span className="px-1.5 py-0.5 bg-accent/10 text-accent text-[10px] font-bold rounded">1X2 ✓</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-danger/10 text-danger text-[10px] font-bold rounded">MISS</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
