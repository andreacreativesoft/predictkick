import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateKellyStake, calculateFlatStake, calculatePercentageStake } from './kelly-calculator'
import { assessRisk } from './risk-manager'
import type { BetPlacement, StakingConfig } from '@/lib/types/bankroll'

export async function placeBet(
  bankrollId: string,
  placement: BetPlacement
): Promise<{ success: boolean; betId?: string; error?: string }> {
  // 1. Get bankroll
  const { data: bankroll } = await supabaseAdmin
    .from('bankroll')
    .select('*')
    .eq('id', bankrollId)
    .single()

  if (!bankroll) return { success: false, error: 'Bankroll not found' }

  // 2. Risk assessment
  const risk = await assessRisk(bankrollId, placement.stake)
  if (!risk.can_place_bet) {
    return { success: false, error: risk.rejection_reason || 'Risk check failed' }
  }

  // 3. Apply risk modifiers to stake
  const adjustedStake = Number((placement.stake * risk.streak_adjustment * risk.kelly_modifier).toFixed(2))

  // 4. Insert bet
  const { data: bet, error: betError } = await supabaseAdmin
    .from('bets')
    .insert({
      user_id: bankroll.user_id,
      bankroll_id: bankrollId,
      prediction_id: placement.prediction_id,
      fixture_id: placement.fixture_id,
      market: placement.market,
      selection: placement.selection,
      odds: placement.odds,
      bookmaker: placement.bookmaker,
      stake: adjustedStake,
      potential_return: Number((adjustedStake * placement.odds).toFixed(2)),
      stake_method: placement.stake_method,
      kelly_edge: placement.kelly_edge,
      confidence_at_placement: placement.confidence,
      status: 'active',
    })
    .select('id')
    .single()

  if (betError || !bet) {
    return { success: false, error: betError?.message || 'Failed to create bet' }
  }

  // 5. Update bankroll
  await supabaseAdmin
    .from('bankroll')
    .update({
      current_amount: bankroll.current_amount - adjustedStake,
      total_bets: bankroll.total_bets + 1,
      total_staked: bankroll.total_staked + adjustedStake,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bankrollId)

  // 6. Record transaction
  await supabaseAdmin
    .from('bankroll_transactions')
    .insert({
      bankroll_id: bankrollId,
      bet_id: bet.id,
      type: 'bet_placed',
      amount: -adjustedStake,
      balance_after: bankroll.current_amount - adjustedStake,
      description: `${placement.market} ${placement.selection} @ ${placement.odds} (${placement.bookmaker})`,
    })

  return { success: true, betId: bet.id }
}

export function suggestStake(
  ourProbability: number,
  odds: number,
  bankrollAmount: number,
  config: StakingConfig
): { stake: number; method: string } {
  switch (config.mode) {
    case 'kelly': {
      const result = calculateKellyStake(ourProbability, odds, bankrollAmount, config)
      return { stake: result.suggestedStake, method: `kelly_${config.kelly_fraction}` }
    }
    case 'flat':
      return { stake: calculateFlatStake(bankrollAmount, config.flat_stake, config.max_single_bet_pct), method: 'flat' }
    case 'percentage':
      return { stake: calculatePercentageStake(bankrollAmount, config.percentage_stake || 2, config.max_single_bet_pct), method: 'percentage' }
    default:
      return { stake: bankrollAmount * 0.02, method: 'default' }
  }
}
