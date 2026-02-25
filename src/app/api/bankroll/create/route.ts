import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      initial_amount,
      currency = 'EUR',
      staking_mode = 'kelly',
      kelly_fraction = 'half',
      flat_stake = null,
      max_single_bet_pct = 5,
      max_daily_exposure_pct = 15,
      stop_loss_pct = 30,
    } = body

    if (!initial_amount || initial_amount <= 0) {
      return NextResponse.json({ error: 'Initial amount must be greater than 0' }, { status: 400 })
    }

    // Check if active bankroll already exists
    const { data: existing } = await supabaseAdmin
      .from('bankroll')
      .select('id')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Active bankroll already exists' }, { status: 409 })
    }

    const { data: bankroll, error } = await supabaseAdmin
      .from('bankroll')
      .insert({
        user_id: DEFAULT_USER_ID,
        initial_amount,
        current_amount: initial_amount,
        currency,
        peak_amount: initial_amount,
        drawdown_from_peak: 0,
        status: 'active',
        staking_mode,
        kelly_fraction,
        flat_stake,
        max_single_bet_pct,
        max_daily_exposure_pct,
        stop_loss_pct,
        total_bets: 0,
        winning_bets: 0,
        losing_bets: 0,
        void_bets: 0,
        total_staked: 0,
        total_returns: 0,
        roi: 0,
        current_streak: 0,
        longest_winning_streak: 0,
        longest_losing_streak: 0,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Record initial deposit transaction
    await supabaseAdmin
      .from('bankroll_transactions')
      .insert({
        bankroll_id: bankroll.id,
        type: 'deposit',
        amount: initial_amount,
        balance_after: initial_amount,
        description: 'Initial bankroll deposit',
      })

    return NextResponse.json({ success: true, bankroll })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
