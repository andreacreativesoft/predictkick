import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Manually settle a bet (admin action)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { bet_id, result_status } = body // result_status: 'won' | 'lost' | 'void'

    if (!bet_id || !['won', 'lost', 'void'].includes(result_status)) {
      return NextResponse.json({ error: 'bet_id and result_status (won/lost/void) required' }, { status: 400 })
    }

    // Get the bet
    const { data: bet } = await supabaseAdmin
      .from('bets')
      .select('*, bankroll:bankroll!bets_bankroll_id_fkey(*)')
      .eq('id', bet_id)
      .single()

    if (!bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 })
    }

    if (bet.status !== 'active') {
      return NextResponse.json({ error: `Bet already settled: ${bet.status}` }, { status: 400 })
    }

    const bankroll = bet.bankroll as Record<string, number>

    let resultAmount = 0
    let balanceChange = 0
    const updateBankroll: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (result_status === 'won') {
      resultAmount = Number(((bet.odds - 1) * bet.stake).toFixed(2))
      balanceChange = bet.stake * bet.odds // return stake + profit
      updateBankroll.current_amount = bankroll.current_amount + balanceChange
      updateBankroll.winning_bets = bankroll.winning_bets + 1
      updateBankroll.total_returns = bankroll.total_returns + balanceChange
      updateBankroll.current_streak = bankroll.current_streak >= 0
        ? bankroll.current_streak + 1
        : 1

      if (bankroll.current_amount + balanceChange > (bankroll.peak_amount || bankroll.initial_amount)) {
        updateBankroll.peak_amount = bankroll.current_amount + balanceChange
        updateBankroll.drawdown_from_peak = 0
      }
    } else if (result_status === 'lost') {
      resultAmount = -bet.stake
      balanceChange = 0 // stake already deducted
      updateBankroll.losing_bets = bankroll.losing_bets + 1
      updateBankroll.current_streak = bankroll.current_streak <= 0
        ? bankroll.current_streak - 1
        : -1
    } else {
      // void - return stake
      resultAmount = 0
      balanceChange = bet.stake
      updateBankroll.current_amount = bankroll.current_amount + bet.stake
      updateBankroll.void_bets = bankroll.void_bets + 1
      updateBankroll.total_staked = bankroll.total_staked - bet.stake
    }

    // Update ROI
    const totalReturns = (updateBankroll.total_returns as number) || bankroll.total_returns
    const totalStaked = (updateBankroll.total_staked as number) || bankroll.total_staked
    if (totalStaked > 0) {
      updateBankroll.roi = Number((((totalReturns - totalStaked) / totalStaked) * 100).toFixed(2))
    }

    // Update bet
    await supabaseAdmin
      .from('bets')
      .update({
        status: result_status,
        result: resultAmount,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bet_id)

    // Update bankroll
    await supabaseAdmin
      .from('bankroll')
      .update(updateBankroll)
      .eq('id', bet.bankroll_id)

    // Record transaction
    if (result_status !== 'lost') {
      await supabaseAdmin
        .from('bankroll_transactions')
        .insert({
          bankroll_id: bet.bankroll_id,
          bet_id,
          type: result_status === 'won' ? 'bet_won' : 'bet_void',
          amount: balanceChange,
          balance_after: (updateBankroll.current_amount as number) || bankroll.current_amount,
          description: result_status === 'won'
            ? `Won: ${bet.market} ${bet.selection} @ ${bet.odds}`
            : `Void: ${bet.market} ${bet.selection} - stake returned`,
        })
    }

    return NextResponse.json({
      success: true,
      result: result_status,
      resultAmount,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
