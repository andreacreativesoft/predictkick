'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Trophy,
  BarChart3,
  Wallet,
  Radio,
  Settings,
  Target,
  TrendingUp,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/matches', label: 'Matches', icon: Trophy },
  { href: '/leagues', label: 'Leagues', icon: BarChart3 },
  { href: '/bankroll', label: 'Bankroll', icon: Wallet },
  { href: '/live', label: 'Live Tracker', icon: Radio },
  { href: '/accuracy', label: 'Accuracy', icon: Target },
  { href: '/admin', label: 'Admin', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">PredictKick</h1>
          <p className="text-xs text-muted">AI Predictions</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-foreground hover:bg-card-hover'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        <p className="text-xs text-muted">v1.0.0 - Development</p>
      </div>
    </aside>
  )
}
