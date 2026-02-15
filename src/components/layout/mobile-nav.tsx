'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Trophy,
  Wallet,
  Radio,
  Settings,
} from 'lucide-react'

const mobileNavItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/matches', label: 'Matches', icon: Trophy },
  { href: '/bankroll', label: 'Bankroll', icon: Wallet },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/admin', label: 'Admin', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 ${
                isActive ? 'text-accent' : 'text-muted'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
