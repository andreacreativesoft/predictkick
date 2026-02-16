import { kellyFraction } from '@/lib/utils/probability'
import { KELLY_DEFAULTS } from '@/lib/utils/constants'
import type { KellyResult, StakingConfig } from '@/lib/types/bankroll'

export function calculateKellyStake(
  ourProbability: number,
  odds: number,
  bankrollAmount: number,
  config: StakingConfig = {
    mode: 'kelly',
    kelly_fraction: 'half',
    flat_stake: null,
    percentage_stake: null,
    max_single_bet_pct: KELLY_DEFAULTS.maxSingleBetPct,
    max_daily_exposure_pct: KELLY_DEFAULTS.maxDailyExposurePct,
    min_bet_pct: KELLY_DEFAULTS.minBetPct,
    stop_loss_pct: KELLY_DEFAULTS.stopLossPct,
  }
): KellyResult {
  // Edge = our probability - implied probability
  const impliedProb = 1 / odds
  const edge = ourProbability - impliedProb

  if (edge <= 0) {
    return {
      edge,
      kellyFraction: 0,
      adjustedFraction: 0,
      suggestedStake: 0,
      suggestedStakePct: 0,
      maxAllowed: bankrollAmount * (config.max_single_bet_pct / 100),
      riskLevel: 'extreme',
    }
  }

  // Full Kelly fraction
  const fullKelly = kellyFraction(ourProbability, odds)

  // Apply fraction modifier
  const fractionMultiplier =
    config.kelly_fraction === 'full' ? 1.0 :
    config.kelly_fraction === 'half' ? 0.5 :
    0.25

  const adjustedKelly = fullKelly * fractionMultiplier

  // Calculate stake amount
  const maxStakePct = config.max_single_bet_pct / 100
  const minStakePct = config.min_bet_pct / 100
  const stakePct = Math.max(minStakePct, Math.min(maxStakePct, adjustedKelly))
  const stakeAmount = Number((bankrollAmount * stakePct).toFixed(2))

  // Risk level
  let riskLevel: KellyResult['riskLevel'] = 'low'
  if (stakePct > 0.04) riskLevel = 'extreme'
  else if (stakePct > 0.03) riskLevel = 'high'
  else if (stakePct > 0.02) riskLevel = 'medium'

  return {
    edge,
    kellyFraction: fullKelly,
    adjustedFraction: adjustedKelly,
    suggestedStake: stakeAmount,
    suggestedStakePct: stakePct * 100,
    maxAllowed: bankrollAmount * maxStakePct,
    riskLevel,
  }
}

export function calculateFlatStake(
  bankrollAmount: number,
  flatStake: number | null,
  maxSingleBetPct: number = KELLY_DEFAULTS.maxSingleBetPct
): number {
  if (flatStake) return Math.min(flatStake, bankrollAmount * maxSingleBetPct / 100)
  return bankrollAmount * 0.02 // Default 2% flat
}

export function calculatePercentageStake(
  bankrollAmount: number,
  percentage: number = 2,
  maxSingleBetPct: number = KELLY_DEFAULTS.maxSingleBetPct
): number {
  const pct = Math.min(percentage, maxSingleBetPct)
  return Number((bankrollAmount * pct / 100).toFixed(2))
}
