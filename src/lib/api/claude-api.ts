import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeAnalysisRequest, ClaudeAnalysisResponse } from '@/lib/types/api'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
    client = new Anthropic({ apiKey })
  }
  return client
}

const SYSTEM_PROMPT = `You are an expert soccer analyst and betting advisor for PredictKick, an AI-powered prediction platform. Your role is to synthesize all available data and find non-obvious patterns that statistical models might miss.

You receive pre-computed statistical predictions along with raw data about:
- Team form, season stats, xG, and scoring patterns
- Head-to-head history
- Player injuries and suspensions (with impact scores)
- Tactical and contextual factors (manager changes, scandals, derbies, etc.)
- Weather conditions at the venue
- Odds from 6+ bookmakers with movement data
- Manual intelligence inputs from the user

Your job is to:
1. Look for non-obvious patterns the statistical model might miss
2. Identify narrative factors that shift probabilities
3. Adjust the raw prediction by -5% to +5% per outcome
4. Highlight key factors and risk factors
5. Suggest which markets offer the best value

Always respond with valid JSON matching the requested schema. Be concise but insightful.`

// ==========================================
// Main Analysis
// ==========================================

export async function analyzePrediction(
  request: ClaudeAnalysisRequest
): Promise<ClaudeAnalysisResponse> {
  const anthropic = getClient()

  const userPrompt = `Analyze this upcoming match and provide your expert assessment.

## Match Context
${request.fixture_summary}

## Statistical Data
${JSON.stringify(request.stats_data, null, 2)}

## Head-to-Head
${JSON.stringify(request.h2h_data, null, 2)}

## Injuries & Suspensions
${JSON.stringify(request.injuries, null, 2)}

## Contextual Factors
${JSON.stringify(request.context_factors, null, 2)}

## Weather
${JSON.stringify(request.weather, null, 2)}

## Bookmaker Odds
${JSON.stringify(request.odds, null, 2)}

## Manual Intelligence
${JSON.stringify(request.manual_inputs, null, 2)}

## Raw Statistical Prediction
${JSON.stringify(request.raw_prediction, null, 2)}

Respond with JSON matching this schema:
{
  "probability_adjustments": {
    "home_win": <number between -0.05 and 0.05>,
    "draw": <number between -0.05 and 0.05>,
    "away_win": <number between -0.05 and 0.05>
  },
  "narrative": "<2-3 sentence expert analysis>",
  "key_factors": ["<factor 1>", "<factor 2>", ...],
  "risk_factors": ["<risk 1>", "<risk 2>", ...],
  "non_obvious_patterns": ["<pattern 1>", ...],
  "recommended_markets": ["<market 1>", ...],
  "confidence_override": <number 0-100 or null>
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  // Extract text from response
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => {
      if (block.type === 'text') return block.text
      return ''
    })
    .join('')

  // Parse JSON from response
  try {
    // Try to extract JSON from the response (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response')
    }
    return JSON.parse(jsonMatch[0]) as ClaudeAnalysisResponse
  } catch (error) {
    console.error('Failed to parse Claude response:', text)
    // Return neutral adjustments if parsing fails
    return {
      probability_adjustments: { home_win: 0, draw: 0, away_win: 0 },
      narrative: 'AI analysis unavailable for this match.',
      key_factors: [],
      risk_factors: [],
      non_obvious_patterns: [],
      recommended_markets: [],
      confidence_override: null,
    }
  }
}

// ==========================================
// Manual Input Processing
// ==========================================

export async function processManualInput(
  input: { type: string; title: string; description: string | null; team_name: string },
): Promise<{
  interpretation: string
  sentiment: 'positive' | 'negative' | 'neutral'
  impact_estimate: 'low' | 'medium' | 'high' | 'critical'
  affected_markets: string[]
  probability_shift: Record<string, number>
}> {
  const anthropic = getClient()

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: 'You are a soccer betting analyst. Assess the impact of the following intelligence on match predictions. Respond with JSON only.',
    messages: [{
      role: 'user',
      content: `Team: ${input.team_name}
Type: ${input.type}
Title: ${input.title}
Details: ${input.description || 'No additional details'}

Respond with JSON:
{
  "interpretation": "<1-2 sentence assessment>",
  "sentiment": "positive" | "negative" | "neutral",
  "impact_estimate": "low" | "medium" | "high" | "critical",
  "affected_markets": ["h2h", "over_under", "btts", etc.],
  "probability_shift": {
    "home_win": <-0.10 to 0.10>,
    "draw": <-0.10 to 0.10>,
    "away_win": <-0.10 to 0.10>
  }
}`,
    }],
  })

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => {
      if (block.type === 'text') return block.text
      return ''
    })
    .join('')

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    return JSON.parse(jsonMatch[0])
  } catch {
    return {
      interpretation: 'Unable to assess impact.',
      sentiment: 'neutral',
      impact_estimate: 'low',
      affected_markets: [],
      probability_shift: { home_win: 0, draw: 0, away_win: 0 },
    }
  }
}
