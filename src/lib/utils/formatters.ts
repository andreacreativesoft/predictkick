import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'

// Currency formatting
export function formatCurrency(
  amount: number,
  currency: string = 'EUR'
): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Odds formatting (decimal)
export function formatOdds(odds: number): string {
  return odds.toFixed(2)
}

// Probability as percentage
export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`
}

// ROI formatting
export function formatROI(roi: number): string {
  const sign = roi >= 0 ? '+' : ''
  return `${sign}${roi.toFixed(2)}%`
}

// Match date formatting
export function formatMatchDate(date: string | Date): string {
  const d = new Date(date)
  if (isToday(d)) return `Today ${format(d, 'HH:mm')}`
  if (isTomorrow(d)) return `Tomorrow ${format(d, 'HH:mm')}`
  return format(d, 'EEE dd MMM HH:mm')
}

// Relative time
export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// Edge formatting
export function formatEdge(edge: number): string {
  return `${(edge * 100).toFixed(1)}%`
}

// Stake formatting
export function formatStake(stake: number): string {
  return formatCurrency(stake)
}

// Score display
export function formatScore(home: number, away: number): string {
  return `${home} - ${away}`
}

// Form indicator (W/D/L array to string)
export function formatForm(form: string[]): string {
  return form.slice(0, 5).join('')
}

// Compact number (1.2K, 3.4M)
export function formatCompact(num: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(num)
}
