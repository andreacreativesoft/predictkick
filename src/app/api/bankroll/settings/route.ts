import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    const { data: bankroll } = await supabaseAdmin
      .from('bankroll')
      .select('id')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!bankroll) {
      return NextResponse.json({ error: 'No active bankroll found' }, { status: 404 })
    }

    const allowedFields = [
      'staking_mode', 'kelly_fraction', 'flat_stake',
      'max_single_bet_pct', 'max_daily_exposure_pct',
      'min_bet_pct', 'stop_loss_pct',
    ]

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { error } = await supabaseAdmin
      .from('bankroll')
      .update(updateData)
      .eq('id', bankroll.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
