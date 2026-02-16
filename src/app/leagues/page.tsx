import { Shield } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LeaguesPage() {
  const supabase = await createClient()

  const { data: leagues } = await supabase
    .from('leagues')
    .select('*')
    .eq('is_active', true)
    .order('tier', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leagues</h1>
        <p className="text-sm text-muted mt-1">Browse covered leagues and standings</p>
      </div>

      {!leagues || leagues.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Shield className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No leagues loaded</h2>
          <p className="text-sm text-muted">Run the seed SQL to load the 7 tracked leagues.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.api_id}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-background text-accent">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{league.name}</p>
                  <p className="text-xs text-muted">{league.country} &middot; Tier {league.tier}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
