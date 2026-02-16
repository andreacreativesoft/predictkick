import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get active bets where the fixture has finished
    const { data: activeBets } = await supabaseAdmin
      .from('bets')
      .select(`
        id, user_id, bankroll_id, market, selection, odds, stake,
        fixture:fixtures!bets_fixture_id_fkey(
          id, status, home_score, away_score
        )
      `)
      .eq('status', 'active')

    if (!activeBets) return NextResponse.json({ success: true, settled: 0 })

    let settled = 0

    for (const bet of activeBets) {
      const fixture = bet.fixture as unknown as { id: string; status: string; home_score: number | null; away_score: number | null }
      if (!fixture || fixture.status !== 'finished') continue
      if (fixture.home_score === null || fixture.away_score === null) continue

      let won = false
      const homeScore = fixture.home_score
      const awayScore = fixture.away_score

      // Determine result based on market and selection
      if (bet.market === 'h2h') {
        if (bet.selection === 'home' && homeScore > awayScore) won = true
        if (bet.selection === 'draw' && homeScore === awayScore) won = true
        if (bet.selection === 'away' && awayScore > homeScore) won = true
      } else if (bet.market === 'over_25') {
        if (bet.selection === 'over' && homeScore + awayScore > 2.5) won = true
        if (bet.selection === 'under' && homeScore + awayScore < 2.5) won = true
      } else if (bet.market === 'btts') {
        if (bet.selection === 'yes' && homeScore > 0 && awayScore > 0) won = true
        if (bet.selection === 'no' && (homeScore === 0 || awayScore === 0)) won = true
      }

      const result = won ? bet.stake * (bet.odds - 1) : -bet.stake

      // Update bet
      await supabaseAdmin
        .from('bets')
        .update({
          status: won ? 'won' : 'lost',
          result,
          settled_at: new Date().toISOString(),
        })
        .eq('id', bet.id)

      // Update bankroll
      if (bet.bankroll_id) {
        const returnAmount = won ? bet.stake * bet.odds : 0

        // Try RPC first, fall back to manual update
        const { error: rpcError } = await supabaseAdmin.rpc('update_bankroll_after_settlement', {
          p_bankroll_id: bet.bankroll_id,
          p_return_amount: returnAmount,
          p_won: won,
        })

        if (rpcError) {
          // RPC doesn't exist yet, do it manually
          const { data: bankroll } = await supabaseAdmin
            .from('bankroll')
            .select('current_amount, winning_bets, losing_bets, total_returns')
            .eq('id', bet.bankroll_id!)
            .single()

          if (bankroll) {
            await supabaseAdmin
              .from('bankroll')
              .update({
                current_amount: bankroll.current_amount + returnAmount,
                winning_bets: won ? bankroll.winning_bets + 1 : bankroll.winning_bets,
                losing_bets: won ? bankroll.losing_bets : bankroll.losing_bets + 1,
                total_returns: bankroll.total_returns + returnAmount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', bet.bankroll_id!)
          }
        }

        // Record transaction
        const { data: bankrollData } = await supabaseAdmin
          .from('bankroll')
          .select('current_amount')
          .eq('id', bet.bankroll_id)
          .single()

        await supabaseAdmin.from('bankroll_transactions').insert({
          bankroll_id: bet.bankroll_id,
          bet_id: bet.id,
          type: won ? 'bet_won' : 'bet_lost',
          amount: won ? returnAmount : -bet.stake,
          balance_after: bankrollData?.current_amount || 0,
          description: `${bet.market} ${bet.selection} @ ${bet.odds} - ${won ? 'WON' : 'LOST'}`,
        })
      }

      settled++
    }

    return NextResponse.json({ success: true, settled })
  } catch (error) {
    console.error('settle-bets error:', error)
    return NextResponse.json({ error: 'Settlement failed', details: String(error) }, { status: 500 })
  }
}
