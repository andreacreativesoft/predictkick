import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, amount } = body

    if (!type || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Type and positive amount required' }, { status: 400 })
    }

    if (!['deposit', 'withdrawal'].includes(type)) {
      return NextResponse.json({ error: 'Type must be deposit or withdrawal' }, { status: 400 })
    }

    // Get active bankroll
    const { data: bankroll } = await supabaseAdmin
      .from('bankroll')
      .select('*')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!bankroll) {
      return NextResponse.json({ error: 'No active bankroll found' }, { status: 404 })
    }

    const newBalance = type === 'deposit'
      ? bankroll.current_amount + amount
      : bankroll.current_amount - amount

    if (newBalance < 0) {
      return NextResponse.json({ error: 'Insufficient balance for withdrawal' }, { status: 400 })
    }

    // Update bankroll
    const updateData: Record<string, unknown> = {
      current_amount: newBalance,
      updated_at: new Date().toISOString(),
    }

    // Update peak if deposit pushes above
    if (type === 'deposit' && newBalance > (bankroll.peak_amount || bankroll.initial_amount)) {
      updateData.peak_amount = newBalance
      updateData.drawdown_from_peak = 0
    }

    // Update initial amount if it's a top-up deposit (adds to capital base)
    if (type === 'deposit') {
      updateData.initial_amount = bankroll.initial_amount + amount
    }

    const { error: updateError } = await supabaseAdmin
      .from('bankroll')
      .update(updateData)
      .eq('id', bankroll.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Record transaction
    const { error: txError } = await supabaseAdmin
      .from('bankroll_transactions')
      .insert({
        bankroll_id: bankroll.id,
        type,
        amount: type === 'deposit' ? amount : -amount,
        balance_after: newBalance,
        description: type === 'deposit' ? `Deposit of €${amount}` : `Withdrawal of €${amount}`,
      })

    if (txError) {
      console.error('Transaction log error:', txError)
    }

    return NextResponse.json({
      success: true,
      balance: newBalance,
      type,
      amount,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
