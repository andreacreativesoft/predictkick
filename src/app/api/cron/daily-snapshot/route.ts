import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    // Get all active bankrolls
    const { data: bankrolls } = await supabaseAdmin
      .from('bankroll')
      .select('id, current_amount, user_id')
      .eq('status', 'active')

    if (!bankrolls) return NextResponse.json({ success: true, snapshots: 0 })

    let snapshots = 0

    for (const bankroll of bankrolls) {
      // Get today's bets for this bankroll
      const startOfDay = `${today}T00:00:00.000Z`
      const endOfDay = `${today}T23:59:59.999Z`

      const { data: todaysBets } = await supabaseAdmin
        .from('bets')
        .select('status, stake, result')
        .eq('bankroll_id', bankroll.id)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)

      const betsPlaced = todaysBets?.length || 0
      const betsWon = todaysBets?.filter(b => b.status === 'won').length || 0
      const betsLost = todaysBets?.filter(b => b.status === 'lost').length || 0
      const totalStaked = todaysBets?.reduce((sum, b) => sum + b.stake, 0) || 0
      const totalReturns = todaysBets?.reduce((sum, b) => sum + (b.result && b.result > 0 ? b.result + (b.stake || 0) : 0), 0) || 0

      // Get previous day's closing balance
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const { data: prevSnapshot } = await supabaseAdmin
        .from('bankroll_daily')
        .select('closing_balance')
        .eq('bankroll_id', bankroll.id)
        .eq('date', yesterday.toISOString().split('T')[0])
        .single()

      const openingBalance = prevSnapshot?.closing_balance || bankroll.current_amount

      await supabaseAdmin.from('bankroll_daily').upsert({
        bankroll_id: bankroll.id,
        date: today,
        opening_balance: openingBalance,
        closing_balance: bankroll.current_amount,
        bets_placed: betsPlaced,
        bets_won: betsWon,
        bets_lost: betsLost,
        total_staked: totalStaked,
        total_returns: totalReturns,
        daily_pnl: bankroll.current_amount - openingBalance,
        roi: totalStaked > 0 ? Number(((totalReturns - totalStaked) / totalStaked * 100).toFixed(2)) : 0,
      }, { onConflict: 'bankroll_id,date' })

      snapshots++
    }

    // Also expire old contextual factors
    await supabaseAdmin
      .from('contextual_factors')
      .update({ is_active: false })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)

    return NextResponse.json({ success: true, snapshots })
  } catch (error) {
    console.error('daily-snapshot error:', error)
    return NextResponse.json({ error: 'Snapshot failed', details: String(error) }, { status: 500 })
  }
}
