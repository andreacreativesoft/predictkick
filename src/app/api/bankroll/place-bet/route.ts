import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { placeBet } from '@/lib/bankroll/manager'
import type { BetPlacement } from '@/lib/types/bankroll'

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      fixture_id,
      prediction_id,
      market,
      selection,
      odds,
      bookmaker,
      stake,
      stake_method = 'manual',
      kelly_edge = 0,
      confidence = 0,
    } = body

    if (!fixture_id || !market || !selection || !odds || !stake) {
      return NextResponse.json({ error: 'Missing required fields: fixture_id, market, selection, odds, stake' }, { status: 400 })
    }

    // Get active bankroll
    const { data: bankroll } = await supabaseAdmin
      .from('bankroll')
      .select('id, current_amount')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!bankroll) {
      return NextResponse.json({ error: 'No active bankroll found' }, { status: 404 })
    }

    if (stake > bankroll.current_amount) {
      return NextResponse.json({ error: 'Insufficient bankroll balance' }, { status: 400 })
    }

    const placement: BetPlacement = {
      fixture_id,
      prediction_id: prediction_id || null,
      market,
      selection,
      odds: Number(odds),
      bookmaker: bookmaker || 'manual',
      stake: Number(stake),
      stake_method,
      kelly_edge: Number(kelly_edge),
      confidence: Number(confidence),
    }

    const result = await placeBet(bankroll.id, placement)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      betId: result.betId,
      newBalance: bankroll.current_amount - Number(stake),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
