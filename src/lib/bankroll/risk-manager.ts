import { supabaseAdmin } from '@/lib/supabase/admin'
import type { RiskAssessment } from '@/lib/types/bankroll'

export async function assessRisk(
  bankrollId: string,
  proposedStake: number
): Promise<RiskAssessment> {
  // Get bankroll data
  const { data: bankroll } = await supabaseAdmin
    .from('bankroll')
    .select('*')
    .eq('id', bankrollId)
    .single()

  if (!bankroll) {
    return {
      current_drawdown: 0,
      max_drawdown: 30,
      at_stop_loss: false,
      daily_exposure: 0,
      daily_exposure_pct: 0,
      max_daily_exposure: 0,
      streak_adjustment: 1,
      kelly_modifier: 1,
      can_place_bet: false,
      rejection_reason: 'Bankroll not found',
    }
  }

  // Current drawdown
  const peakAmount = bankroll.peak_amount || bankroll.initial_amount
  const currentDrawdown = ((peakAmount - bankroll.current_amount) / peakAmount) * 100

  // Daily exposure - sum of active bet stakes today
  const today = new Date().toISOString().split('T')[0]
  const { data: todaysBets } = await supabaseAdmin
    .from('bets')
    .select('stake')
    .eq('bankroll_id', bankrollId)
    .eq('status', 'active')
    .gte('created_at', `${today}T00:00:00.000Z`)

  const dailyExposure = (todaysBets || []).reduce((sum, bet) => sum + bet.stake, 0) + proposedStake
  const dailyExposurePct = (dailyExposure / bankroll.current_amount) * 100
  const maxDailyExposure = bankroll.current_amount * (bankroll.max_daily_exposure_pct / 100)

  // Streak adjustment
  let streakAdjustment = 1
  if (bankroll.current_streak < -3) {
    streakAdjustment = 0.7  // Reduce stakes on losing streak
  } else if (bankroll.current_streak < -5) {
    streakAdjustment = 0.5
  } else if (bankroll.current_streak > 5) {
    streakAdjustment = 0.9  // Slight reduction on winning streak (avoid overconfidence)
  }

  // Kelly modifier based on drawdown
  let kellyModifier = 1
  if (currentDrawdown > 20) kellyModifier = 0.5
  else if (currentDrawdown > 15) kellyModifier = 0.7
  else if (currentDrawdown > 10) kellyModifier = 0.85

  // Check stop loss
  const atStopLoss = currentDrawdown >= bankroll.stop_loss_pct

  // Can we place the bet?
  let canPlace = true
  let rejectionReason: string | null = null

  if (atStopLoss) {
    canPlace = false
    rejectionReason = `Stop loss triggered: ${currentDrawdown.toFixed(1)}% drawdown exceeds ${bankroll.stop_loss_pct}% limit`
  } else if (dailyExposurePct > bankroll.max_daily_exposure_pct) {
    canPlace = false
    rejectionReason = `Daily exposure limit: ${dailyExposurePct.toFixed(1)}% exceeds ${bankroll.max_daily_exposure_pct}% limit`
  } else if (proposedStake > bankroll.current_amount * (bankroll.max_single_bet_pct / 100)) {
    canPlace = false
    rejectionReason = `Stake too large: exceeds ${bankroll.max_single_bet_pct}% single bet limit`
  } else if (proposedStake < bankroll.current_amount * (bankroll.min_bet_pct / 100)) {
    canPlace = false
    rejectionReason = `Stake too small: below ${bankroll.min_bet_pct}% minimum`
  }

  return {
    current_drawdown: currentDrawdown,
    max_drawdown: bankroll.stop_loss_pct,
    at_stop_loss: atStopLoss,
    daily_exposure: dailyExposure,
    daily_exposure_pct: dailyExposurePct,
    max_daily_exposure: maxDailyExposure,
    streak_adjustment: streakAdjustment,
    kelly_modifier: kellyModifier,
    can_place_bet: canPlace,
    rejection_reason: rejectionReason,
  }
}
