import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get fixtures in next 3 days that don't have predictions yet
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const { data: fixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id')
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())
      .lte('match_date', threeDaysFromNow.toISOString())

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ success: true, generated: 0 })
    }

    // Filter out fixtures that already have predictions
    const { data: existingPredictions } = await supabaseAdmin
      .from('predictions')
      .select('fixture_id')
      .in('fixture_id', fixtures.map(f => f.id))

    const existingIds = new Set(existingPredictions?.map(p => p.fixture_id) || [])
    const needsPrediction = fixtures.filter(f => !existingIds.has(f.id))

    let generated = 0

    for (const fixture of needsPrediction) {
      try {
        // Dynamically import prediction engine to avoid loading it for all cron jobs
        const { generatePrediction } = await import('@/lib/prediction/engine')
        await generatePrediction(fixture.id)
        generated++
      } catch (err) {
        console.error(`Prediction failed for fixture ${fixture.id}:`, err)
      }
    }

    return NextResponse.json({ success: true, generated, total: fixtures.length })
  } catch (error) {
    console.error('generate-predictions error:', error)
    return NextResponse.json({ error: 'Generation failed', details: String(error) }, { status: 500 })
  }
}
