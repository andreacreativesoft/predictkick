// Validate cron job authorization
export function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

// Validate UUID format
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// Validate decimal odds (must be > 1.0)
export function isValidOdds(odds: number): boolean {
  return odds > 1.0 && odds < 1000
}

// Validate probability (0-1)
export function isValidProbability(prob: number): boolean {
  return prob >= 0 && prob <= 1
}

// Validate stake amount
export function isValidStake(stake: number, minStake: number = 0.01): boolean {
  return stake >= minStake && Number.isFinite(stake)
}

// Validate date string (ISO format)
export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

// Validate API-Football league ID
export function isValidLeagueId(leagueId: number): boolean {
  const validIds = [39, 140, 135, 78, 61, 2, 3]
  return validIds.includes(leagueId)
}
