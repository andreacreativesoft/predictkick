import { Settings, Plus, FileText, AlertCircle, Zap } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()

  const { count: factorCount } = await supabase
    .from('contextual_factors')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: inputCount } = await supabase
    .from('manual_inputs')
    .select('*', { count: 'exact', head: true })
    .eq('is_processed', false)

  const { count: alertCount } = await supabase
    .from('odds_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-sm text-muted mt-1">Manual inputs, contextual factors, and system management</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background text-accent"><FileText className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted">Active Factors</p>
              <p className="text-xl font-bold text-foreground">{factorCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background text-warning"><AlertCircle className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted">Unprocessed Inputs</p>
              <p className="text-xl font-bold text-foreground">{inputCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background text-danger"><Zap className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted">Unread Alerts</p>
              <p className="text-xl font-bold text-foreground">{alertCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Add Injury', href: '/admin/inputs?type=injury', icon: Plus, desc: 'Report a player injury or update' },
            { label: 'Add Lineup Leak', href: '/admin/inputs?type=lineup', icon: Plus, desc: 'Add leaked or expected lineup info' },
            { label: 'Add News Intel', href: '/admin/inputs?type=news', icon: Plus, desc: 'Scandal, manager change, protest' },
            { label: 'Manage Factors', href: '/admin/factors', icon: Settings, desc: 'View and edit contextual factors' },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="p-3 bg-background rounded-lg border border-border hover:border-accent/30 transition-colors"
            >
              <action.icon className="w-5 h-5 text-accent mb-2" />
              <p className="text-xs font-semibold text-foreground">{action.label}</p>
              <p className="text-[10px] text-muted mt-0.5">{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Cron job status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Cron Jobs</h3>
        <div className="space-y-2">
          {[
            'sync-fixtures', 'sync-standings', 'sync-odds', 'sync-injuries',
            'sync-weather', 'sync-team-schedule', 'sync-european-context',
            'sync-referee', 'sync-news', 'sync-odds-movement',
            'generate-predictions', 'settle-bets', 'daily-snapshot',
          ].map((job) => (
            <div key={job} className="flex items-center justify-between py-1.5 px-3 bg-background rounded-lg">
              <span className="text-xs text-foreground">{job}</span>
              <span className="text-[10px] text-muted">Daily</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
