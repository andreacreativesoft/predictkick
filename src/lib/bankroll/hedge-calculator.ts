import type { HedgeOption, CashoutCalculation } from '@/lib/types/bankroll'

export function calculateHedgeOptions(
  originalStake: number,
  originalOdds: number,
  selection: string,
  currentLiveOdds: { home: number; draw: number; away: number },
  currentScore: { home: number; away: number },
  minute: number
): HedgeOption[] {
  const potentialReturn = originalStake * originalOdds
  const options: HedgeOption[] = []

  // Option 1: Hold (do nothing)
  const holdEV = estimateHoldEV(selection, currentLiveOdds, potentialReturn, originalStake)
  options.push({
    type: 'hold',
    description: 'Keep your bet and wait for the final result',
    action: 'No action needed',
    guaranteed_profit: null,
    expected_value: holdEV,
    risk_level: 'high',
    recommended: holdEV > potentialReturn * 0.5,
    details: { currentOdds: currentLiveOdds, potentialReturn },
  })

  // Option 2: Cash out (lay bet against opposite outcome)
  const cashoutValue = calculateCashoutValue(originalStake, originalOdds, selection, currentLiveOdds)
  options.push({
    type: 'cashout',
    description: `Cash out now for ${cashoutValue.current_value.toFixed(2)}`,
    action: `Accept cashout of ${cashoutValue.current_value.toFixed(2)}`,
    guaranteed_profit: cashoutValue.current_value - originalStake,
    expected_value: cashoutValue.current_value,
    risk_level: 'none',
    recommended: cashoutValue.recommendation === 'cashout',
    details: cashoutValue,
  })

  // Option 3: Single hedge (bet on draw/opposite)
  if (minute < 80) {
    const hedgeStake = calculateSingleHedge(originalStake, originalOdds, selection, currentLiveOdds)
    if (hedgeStake.stake > 0) {
      const guaranteedProfit = Math.min(
        potentialReturn - originalStake - hedgeStake.stake,
        hedgeStake.stake * hedgeStake.odds - hedgeStake.stake - originalStake
      )

      options.push({
        type: 'single_hedge',
        description: `Bet ${hedgeStake.stake.toFixed(2)} on ${hedgeStake.selection} @ ${hedgeStake.odds.toFixed(2)}`,
        action: `Place hedge bet: ${hedgeStake.stake.toFixed(2)} on ${hedgeStake.selection}`,
        guaranteed_profit: guaranteedProfit > 0 ? guaranteedProfit : null,
        expected_value: (potentialReturn + hedgeStake.stake * hedgeStake.odds) / 2 - originalStake - hedgeStake.stake,
        risk_level: 'low',
        recommended: guaranteedProfit > 0,
        details: hedgeStake,
      })
    }
  }

  // Option 4: Full hedge (guarantee profit on all outcomes)
  const fullHedge = calculateFullHedge(originalStake, originalOdds, selection, currentLiveOdds)
  if (fullHedge.totalStake > 0) {
    options.push({
      type: 'full_hedge',
      description: 'Lock in guaranteed profit regardless of outcome',
      action: `Place hedges totaling ${fullHedge.totalStake.toFixed(2)}`,
      guaranteed_profit: fullHedge.guaranteedProfit,
      expected_value: fullHedge.guaranteedProfit,
      risk_level: 'none',
      recommended: fullHedge.guaranteedProfit > originalStake * 0.1,
      details: fullHedge,
    })
  }

  return options.sort((a, b) => {
    if (a.recommended && !b.recommended) return -1
    if (!a.recommended && b.recommended) return 1
    return (b.expected_value || 0) - (a.expected_value || 0)
  })
}

export function calculateCashoutValue(
  originalStake: number,
  originalOdds: number,
  selection: string,
  currentLiveOdds: { home: number; draw: number; away: number }
): CashoutCalculation {
  // Cashout value = original stake * (original odds / current odds for same selection)
  const currentOdds =
    selection === 'home' ? currentLiveOdds.home :
    selection === 'draw' ? currentLiveOdds.draw :
    currentLiveOdds.away

  const currentValue = currentOdds > 0
    ? originalStake * (originalOdds / currentOdds)
    : originalStake

  const potentialReturn = originalStake * originalOdds
  const unrealizedPnl = currentValue - originalStake
  const unrealizedPnlPct = (unrealizedPnl / originalStake) * 100

  // EV comparison
  const impliedWinProb = 1 / currentOdds
  const holdEV = impliedWinProb * potentialReturn - originalStake

  let recommendation: CashoutCalculation['recommendation'] = 'hold'
  let reasoning = 'Expected value of holding is higher than cashout.'

  if (currentValue > holdEV + originalStake) {
    recommendation = 'cashout'
    reasoning = 'Cashout value exceeds expected value of holding.'
  } else if (unrealizedPnlPct > 30 && currentValue > holdEV * 0.9 + originalStake) {
    recommendation = 'partial_cashout'
    reasoning = 'Significant profit available. Consider partial cashout to lock in some gains.'
  }

  return {
    current_value: Number(currentValue.toFixed(2)),
    original_stake: originalStake,
    potential_return: potentialReturn,
    unrealized_pnl: Number(unrealizedPnl.toFixed(2)),
    unrealized_pnl_pct: Number(unrealizedPnlPct.toFixed(1)),
    cashout_vs_ev: currentValue > holdEV + originalStake ? 'better' : currentValue < holdEV * 0.8 + originalStake ? 'worse' : 'similar',
    recommendation,
    reasoning,
  }
}

function estimateHoldEV(
  selection: string,
  currentLiveOdds: { home: number; draw: number; away: number },
  potentialReturn: number,
  originalStake: number
): number {
  const currentOdds =
    selection === 'home' ? currentLiveOdds.home :
    selection === 'draw' ? currentLiveOdds.draw :
    currentLiveOdds.away

  const winProb = currentOdds > 0 ? 1 / currentOdds : 0.33
  return winProb * potentialReturn - originalStake
}

function calculateSingleHedge(
  originalStake: number,
  originalOdds: number,
  selection: string,
  currentLiveOdds: { home: number; draw: number; away: number }
): { stake: number; odds: number; selection: string } {
  // Hedge on the opposite outcome
  const hedgeSelection: string = selection === 'home' ? 'away' : 'home'
  const hedgeOdds =
    hedgeSelection === 'home' ? currentLiveOdds.home :
    hedgeSelection === 'draw' ? currentLiveOdds.draw :
    currentLiveOdds.away

  if (hedgeOdds <= 1) return { stake: 0, odds: 0, selection: '' }

  // Calculate hedge stake to equalize profit
  const potentialReturn = originalStake * originalOdds
  const hedgeStake = (potentialReturn - originalStake) / (hedgeOdds - 1)

  return {
    stake: Number(Math.max(0, hedgeStake).toFixed(2)),
    odds: hedgeOdds,
    selection: hedgeSelection,
  }
}

function calculateFullHedge(
  originalStake: number,
  originalOdds: number,
  selection: string,
  currentLiveOdds: { home: number; draw: number; away: number }
): { totalStake: number; guaranteedProfit: number; bets: Array<{ selection: string; stake: number; odds: number }> } {
  const potentialReturn = originalStake * originalOdds
  const bets: Array<{ selection: string; stake: number; odds: number }> = []

  // We need to bet on all other outcomes
  const outcomes = ['home', 'draw', 'away'].filter(o => o !== selection)
  let totalHedgeStake = 0

  for (const outcome of outcomes) {
    const odds =
      outcome === 'home' ? currentLiveOdds.home :
      outcome === 'draw' ? currentLiveOdds.draw :
      currentLiveOdds.away

    if (odds <= 1) continue

    // Stake to get same return as original bet
    const stake = potentialReturn / odds
    bets.push({ selection: outcome, stake: Number(stake.toFixed(2)), odds })
    totalHedgeStake += stake
  }

  const guaranteedProfit = potentialReturn - originalStake - totalHedgeStake

  return {
    totalStake: Number(totalHedgeStake.toFixed(2)),
    guaranteedProfit: Number(guaranteedProfit.toFixed(2)),
    bets,
  }
}
