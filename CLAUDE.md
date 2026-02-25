# CLAUDE.md — PredictKick

## Project Overview

PredictKick is an AI-powered soccer/football prediction platform. It aggregates data from multiple football APIs, runs a multi-factor statistical prediction engine, applies optional Claude AI synthesis, detects value bets, tracks bankroll performance, and displays everything through a dark-themed Next.js dashboard.

**Live URL:** Deployed on Vercel (serverless).

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 with CSS custom properties (dark theme only)
- **Database:** Supabase (PostgreSQL) with Row-Level Security
- **Cache:** Upstash Redis (serverless-compatible)
- **AI:** Anthropic Claude SDK (`claude-sonnet-4-20250514`)
- **Charts:** Recharts
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Dates:** date-fns
- **Hosting:** Vercel (with Vercel Cron Jobs)

## Project Structure

```
src/
├── app/                          # Next.js App Router pages & API routes
│   ├── page.tsx                  # Dashboard (server component)
│   ├── layout.tsx                # Root layout (sidebar + header shell)
│   ├── globals.css               # Tailwind + CSS custom properties
│   ├── matches/                  # Match list + [id] detail pages
│   ├── leagues/                  # League standings + [id] detail
│   ├── accumulators/             # Accumulator/parlay suggestions
│   ├── news/                     # News & intel page
│   ├── bankroll/                 # Bankroll management UI
│   ├── live/                     # Live match tracker
│   ├── accuracy/                 # Prediction accuracy tracking
│   ├── admin/                    # Admin panel
│   └── api/
│       ├── cron/                 # 15 Vercel cron job routes
│       ├── bankroll/             # Bankroll CRUD API routes
│       └── news/                 # News API route
├── components/
│   └── layout/
│       ├── sidebar.tsx           # Desktop sidebar nav (client component)
│       ├── header.tsx            # Top header bar
│       └── mobile-nav.tsx        # Mobile navigation
└── lib/
    ├── api/
    │   ├── football-api.ts       # Dual-provider: football-data.org + API-Football
    │   ├── claude-api.ts         # Anthropic Claude integration
    │   ├── odds-api.ts           # The Odds API integration
    │   ├── romanian-odds.ts      # Romanian bookmaker scraper
    │   ├── news-api.ts           # GNews API
    │   ├── superliga-scraper.ts  # Romanian football news scraper
    │   └── weather-api.ts        # OpenWeatherMap
    ├── prediction/
    │   ├── engine.ts             # Main prediction engine (orchestrator)
    │   ├── stats-analyzer.ts     # Season stats + form analysis
    │   ├── h2h-analyzer.ts       # Head-to-head analysis
    │   ├── position-context.ts   # League position context
    │   ├── cross-competition.ts  # Multi-competition fatigue/travel
    │   ├── squad-analyzer.ts     # Injuries & squad strength
    │   ├── contextual-analyzer.ts# Manager changes, derbies, etc.
    │   ├── weather-impact.ts     # Weather impact on match
    │   ├── referee-analyzer.ts   # Referee tendency analysis
    │   ├── odds-analyzer.ts      # Market consensus & sharp money
    │   ├── value-detector.ts     # Value bet detection
    │   ├── dominant-team-analyzer.ts
    │   ├── accumulator-builder.ts# Build accumulator/parlay suggestions
    │   └── live-recalculator.ts  # In-play prediction updates
    ├── bankroll/
    │   ├── manager.ts            # Bet placement & staking
    │   ├── kelly-calculator.ts   # Kelly criterion staking
    │   ├── risk-manager.ts       # Risk assessment & stop-loss
    │   └── hedge-calculator.ts   # Hedge bet calculations
    ├── cache/
    │   └── redis.ts              # Upstash Redis: caching + rate limiting
    ├── supabase/
    │   ├── server.ts             # Server-side Supabase client (uses cookies)
    │   ├── client.ts             # Browser-side Supabase client
    │   ├── admin.ts              # Service role client (bypasses RLS)
    │   └── types.ts              # Database types (placeholder for generated)
    ├── types/
    │   ├── api.ts                # External API response types
    │   ├── prediction.ts         # Prediction engine types
    │   ├── bankroll.ts           # Bankroll/betting types
    │   ├── database.ts           # Database entity types
    │   └── live.ts               # Live tracking types
    └── utils/
        ├── constants.ts          # League IDs, weights, cache TTLs, rate limits
        ├── formatters.ts         # Currency, odds, date, probability formatters
        ├── probability.ts        # Poisson, Kelly, odds math utilities
        └── validators.ts         # Input validation helpers
```

## Database Schema (Supabase/PostgreSQL)

Migrations live in `supabase/migrations/` (001 through 014). Key tables:

| Table | Purpose |
|-------|---------|
| `leagues` | Supported leagues (PL, La Liga, Serie A, Bundesliga, Ligue 1, CL, EL) |
| `teams` | Teams with stadium coordinates |
| `players` | Player roster with impact scores |
| `fixtures` | Match schedule and results |
| `standings` | Season standings with detailed stats (xG, form, scoring patterns) |
| `h2h_records` | Head-to-head history between team pairs |
| `predictions` | Generated predictions with full factor breakdown |
| `odds_current` | Current best odds across bookmakers |
| `odds_history` | Historical odds snapshots for movement analysis |
| `odds_romanian` | Romanian bookmaker odds (Superbet, Casa Pariurilor, etc.) |
| `bankroll` | Bankroll tracking |
| `bets` | Individual bet records |
| `bankroll_transactions` | Transaction ledger |
| `match_weather` | Weather data for venues |
| `player_availability` | Injury/suspension data per fixture |
| `contextual_factors` | Manager changes, derbies, morale factors |
| `team_schedule_context` | Fatigue and rotation risk |
| `manual_inputs` | User-provided intelligence |
| `accumulators` | Generated accumulator suggestions |
| `live_events` | In-play match events |

All tables use UUIDs as primary keys. External API IDs are stored in `api_id` columns with UNIQUE constraints. Foreign keys reference internal UUIDs, not external API IDs.

## Key Architecture Decisions

### Dual Football Data Provider
`src/lib/api/football-api.ts` supports two providers behind a `FOOTBALL_DATA_PROVIDER` env var:
- **football-data.org** (default, free tier): PL, La Liga, Serie A, Bundesliga, Ligue 1, CL
- **API-Football** (legacy fallback): Used for injuries, lineups, live events not on free tier

The code translates football-data.org responses into the legacy API-Football response shapes so all downstream consumers work with a single interface.

### Prediction Engine (Weighted Multi-Factor)
`src/lib/prediction/engine.ts` combines 17 weighted factors across 6 tiers:
- **Tier 1 - Hard Stats (42%):** Form, season stats, H2H, home/away splits, scoring patterns
- **Tier 2 - Squad (20%):** Injuries, fatigue/rotation, lineup quality
- **Tier 3 - Situational (15%):** League position, cross-competition, psychology, referee
- **Tier 4 - Market (13%):** Bookmaker consensus, odds movement, sharp vs. public
- **Tier 5 - Environment (5%):** Weather, travel
- **Tier 6 - AI (5%):** Claude analysis (skipped in cron to avoid serverless timeouts)

Weights are defined in `src/lib/utils/constants.ts` as `PREDICTION_WEIGHTS`.

### European Season Logic
Season calculation uses the European football calendar: matches before August belong to the previous year's season. A February 2026 match is season "2025". This logic appears in both `engine.ts` and `football-api.ts`.

### Supabase Client Pattern
Three Supabase clients for different contexts:
- `server.ts` — Server Components (uses cookies, respects RLS)
- `client.ts` — Client Components (browser, respects RLS)
- `admin.ts` — Service role (bypasses RLS, for cron jobs and admin ops only). **Never import in client components.**

### Caching Strategy
Upstash Redis wraps all external API calls via `getCached()` in `src/lib/cache/redis.ts`. TTLs defined in `CACHE_TTL` constant (1 min for live data, up to 6 hours for fixtures/standings).

## Commands

```bash
npm run dev        # Start development server
npm run build      # Production build (also type-checks)
npm run start      # Start production server
npm run lint       # ESLint (Next.js core-web-vitals + TypeScript rules)
```

There is no separate test runner configured. Use `npm run build` to verify type-correctness.

## Vercel Cron Jobs

Defined in `vercel.json`. All cron routes are in `src/app/api/cron/` and are protected by `CRON_SECRET` Bearer token validation. Each route sets `export const maxDuration = 60` for the Vercel 60-second serverless limit.

| Cron Route | Schedule | Purpose |
|-----------|----------|---------|
| `sync-fixtures` | 02:00 UTC | Sync upcoming fixtures from football APIs |
| `sync-standings` | 03:00 UTC | Update league standings |
| `sync-odds` | 04:00 UTC | Fetch odds from The Odds API |
| `sync-romanian-odds` | 04:30 UTC | Scrape Romanian bookmaker odds |
| `sync-injuries` | 05:00 UTC | Sync player injuries |
| `sync-weather` | 06:00 UTC | Fetch weather for upcoming match venues |
| `sync-team-schedule` | 07:00 UTC | Calculate fatigue & rotation risk |
| `sync-european-context` | 08:00 UTC | Sync contextual factors |
| `sync-referee` | 09:00 UTC | Sync referee assignments |
| `sync-news` | 10:00 UTC | Fetch football news |
| `sync-odds-movement` | 11:00 UTC | Track odds movement |
| `generate-predictions` | 12:00 UTC | Generate predictions (max 5/run, no AI) |
| `settle-bets` | 13:00 UTC | Settle completed bets |
| `generate-accumulators` | 14:00 UTC | Build accumulator suggestions |
| `daily-snapshot` | 00:00 UTC | Daily bankroll snapshot |

**Important:** AI prediction via Claude is skipped in cron runs (`SKIP_AI_PREDICTION=true`) to avoid Vercel serverless timeouts. Predictions use statistical-only mode in cron.

## Environment Variables

Required variables (see `.env.local.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (server-only) |
| `FOOTBALL_DATA_API_KEY` | Yes | football-data.org API key |
| `FOOTBALL_DATA_PROVIDER` | No | `football-data` (default) or `api-football` |
| `FOOTBALL_API_KEY` | No | API-Football key (fallback for injuries, etc.) |
| `RAPIDAPI_KEY` | No | RapidAPI key (if using API-Football via RapidAPI) |
| `ODDS_API_KEY` | Yes | The Odds API key |
| `OPENWEATHER_API_KEY` | Yes | OpenWeatherMap key |
| `NEWS_API_KEY` | Yes | GNews API key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `CRON_SECRET` | Yes | Bearer token for cron job auth |
| `SKIP_AI_PREDICTION` | No | Set `true` to skip Claude AI in predictions |

## Code Conventions

### TypeScript
- Strict mode enabled. Path alias: `@/*` maps to `./src/*`
- Use `type` imports where possible (e.g., `import type { ... }`)
- Supabase database types are currently a placeholder (`any`) — generate with `npx supabase gen types typescript`

### Components
- **Server Components** by default (no `'use client'` directive)
- Client Components only when needed (sidebar nav, interactive elements)
- Pages use `export const dynamic = 'force-dynamic'` for real-time data
- Icons from `lucide-react`

### Styling
- Dark theme only (CSS custom properties in `globals.css`)
- Tailwind CSS v4 with `@theme inline` block for custom colors
- Color tokens: `background`, `foreground`, `card`, `border`, `muted`, `accent`, `success`, `danger`, `warning`
- Fonts: Geist Sans + Geist Mono

### API Routes
- All cron routes validate `CRON_SECRET` via `validateCronSecret()`
- Cron routes set `export const maxDuration = 60`
- Cron routes process in batches to stay within Vercel timeout (e.g., max 5 predictions per run)
- Per-league error handling: one league failing doesn't block others
- API routes return JSON with `{ success, ...data, errors? }` shape

### Data Flow
1. External APIs -> Cron routes -> Supabase (via `supabaseAdmin`)
2. Supabase -> Server Components -> Rendered HTML (via `createClient()` from `server.ts`)
3. Prediction engine reads from Supabase, runs analyzers, writes back to `predictions` table

### Supabase Queries
- Use foreign key joins with explicit key names: `teams!fixtures_home_team_id_fkey(*)`
- Supabase may return a single object or array depending on FK uniqueness — handle both:
  ```ts
  const raw = m.predictions as unknown
  const pred = Array.isArray(raw) ? raw[0] : raw
  ```
- Upsert with `onConflict` for idempotent syncs
- Batch operations in chunks of 100 for large datasets

### Supported Leagues
Defined in `src/lib/utils/constants.ts`:
- Premier League (39 / PL)
- La Liga (140 / PD)
- Serie A (135 / SA)
- Bundesliga (78 / BL1)
- Ligue 1 (61 / FL1)
- Champions League (2 / CL)
- Europa League (3 / EC — paid tier only on football-data.org)

## Common Pitfalls

- **Vercel 60s timeout:** All cron routes must complete within 60 seconds. Process in batches, skip AI enrichment in cron.
- **football-data.org rate limit:** 10 requests/minute on free tier. The `fdRateLimitDelay()` function enforces 1-second gaps.
- **European season math:** Always use `month < 7 ? year - 1 : year` for season calculation.
- **Supabase FK joins:** The shape of joined data depends on FK uniqueness. Always handle both array and object returns.
- **Redis cache:** All external API data is cached. To test with fresh data, clear Redis keys or wait for TTL expiry.
- **`supabaseAdmin` security:** Never import `admin.ts` in client-side code. It bypasses Row-Level Security.
- **Odds providers:** International odds come from The Odds API; Romanian odds are scraped separately from Superbet, Casa Pariurilor, etc.
