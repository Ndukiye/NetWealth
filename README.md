# NetWealth

MVP scaffold for a Nigerian personal finance app: net worth dashboard, automatic
transaction categorization, AI-powered insights, an AI coach (financial
checkup + goal/retirement/investment planning), cash flow reports, monthly
budgets, asset/liability tracking, and goal tracking. Responsive web app
styled like a mobile app (bottom tab bar on phone screens) with a light/dark
theme toggle.

See [`FEATURES.md`](./FEATURES.md) for a full feature walkthrough, a
step-by-step guide to testing everything, and an audit of this build against
the original MVP brief. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for how to
host it (Render for the API, Vercel for the web app).

## Stack

- **API**: NestJS + Prisma + PostgreSQL, JWT auth
- **Web**: Next.js 14 (App Router) + Tailwind + Recharts, responsive with a
  mobile bottom-tab layout and a light/dark theme (next-themes)
- **Bank aggregation**: pluggable `BankProvider` interface, currently backed by
  a `MockBankProvider` that simulates a Nigerian bank connection (GTBank,
  Access, Zenith, Kuda, OPay) and generates realistic sample transactions
  (UBER, SHOPRITE, MTN, PAYSTACK *NETFLIX, JUMIA, etc.), synced on demand, on
  a schedule, and via a simulated webhook
- **Categorization**: pluggable `Categorizer` interface, currently backed by a
  `MockCategorizer` using keyword rules matching the same transactions above
- **AI insights, coach & alerts**: pluggable `AiAdvisor`, `FinancialPlanner`
  and `AlertChannel` interfaces, currently backed by deterministic rule
  engines (insights, financial checkup, and goal/retirement/investment
  planning) and a mock channel that logs what a WhatsApp/Telegram alert
  would have sent

All of these integration points are designed to be swapped for real providers
(Mono/Okra/OnePipe/Stitch for banking; OpenAI for categorization and
insights; Telegram Bot API for alerts) without touching any calling code —
see "Swapping in real integrations" below.

## Project layout

```
netwealth/
  api/    NestJS backend (REST API under /api)
  web/    Next.js frontend
  docker-compose.yml   Postgres for local dev (optional — see below)
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (either via `docker compose up -d`, or a local install)

## Setup

### 1. Database

If you have Docker:

```bash
docker compose up -d
```

If you're using a local Postgres install instead, create the role and database
it expects (matching `api/.env`):

```bash
sudo -u postgres psql -c "CREATE ROLE netwealth LOGIN PASSWORD 'netwealth' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE netwealth OWNER netwealth;"
```

(`CREATEDB` is needed because `prisma migrate dev` creates a disposable
shadow database to detect drift — without it you'll hit
`P3014: permission denied to create database`.)

### 2. API

```bash
cd api
npm install
npx prisma migrate dev               # creates tables from existing migrations
npm run prisma:seed                  # demo user + sample data
npm run start:dev                    # http://localhost:3001/api
```

Demo login after seeding: `demo@netwealth.app` / `password123`

### 3. Web

```bash
cd web
npm install
npm run dev                          # http://localhost:3000
```

`web/.env.local` already points at `http://localhost:3001/api`; change it if
the API runs elsewhere.

## What's implemented

- Auth: signup/login/me (JWT)
- Accounts: CRUD for bank, cash, crypto, stock, mutual fund, property,
  vehicle, loan, credit facility, mortgage — assets and liabilities are
  derived from account type
- Bank integration: `GET /bank/institutions`, `POST /bank/connect`,
  `POST /bank/accounts/:id/sync` (manual), `POST /bank/webhook` (live-event
  push, unauthenticated + shared-secret like a real provider webhook), and a
  5-minute cron job (`BankSyncScheduler`) that polls every linked account —
  covering both the "live events" and "scheduled syncing" paths the brief
  calls out
- Transactions: list/filter, manual entry, AI-style auto-categorization on
  creation, manual recategorization, delete
- Budgets: monthly limit per category with spend tracking
- Goals: target amount/date with progress
- Reports: net worth (assets − liabilities), cash flow by month, category
  spending breakdown
- AI insights: `GET /insights` — financial health score, budget/spend-spike
  warnings, subscription & salary detection, savings recommendations, shown
  as a rotating corner popup on the dashboard (one insight at a time,
  auto-cycling, dismissible — not an ever-growing list; see `FEATURES.md`)
- AI coach / financial advisor: `POST /planner/chat` (free-text advisor
  Q&A — "I have ₦1m and want to retire at 40, what should I do?"),
  `GET /planner/review` (holistic financial checkup — emergency fund,
  savings rate, debt load, idle cash), `GET /planner/defaults` (prefills
  from your real data), and `POST /planner/plan` — retirement,
  target-amount, and wealth-growth plans with risk-appetite-driven Nigerian
  asset allocations, required monthly savings, and feasibility verdicts
- Purchase simulator: `POST /simulator/afford-check` — "can I afford this?"
  check against liquid balance, recent spending, and budget impact
- Spending alerts: `GET/PATCH /alerts/settings`, `POST /alerts/test`,
  `POST /alerts/check` — mocked WhatsApp/Telegram-style alerts, deduped per
  day, dispatched automatically after every scheduled sync for opted-in users
- Responsive UI: bottom tab bar on phone-width screens, top nav on desktop,
  light/dark theme toggle persisted per browser

## Swapping in real integrations

**Bank provider** — implement `BankProvider`
(`api/src/bank-integration/bank-provider.interface.ts`), register it in
`bank-integration.module.ts`'s factory (keyed off `BANK_PROVIDER` env var),
and set `BANK_PROVIDER=mono` (or `okra`) plus the relevant secret key in
`api/.env`.

**Categorizer** — implement `Categorizer`
(`api/src/categorization/categorizer.interface.ts`), register it in
`categorization.module.ts`'s factory (keyed off `CATEGORIZER` env var), and
set `CATEGORIZER=openai` plus `OPENAI_API_KEY` in `api/.env`.

**AI advisor** (dashboard insights) — implement `AiAdvisor`
(`api/src/insights/advisor.interface.ts`), register it in
`insights.module.ts`'s factory (keyed off `AI_ADVISOR` env var), and set
`AI_ADVISOR=openai` plus `OPENAI_API_KEY` in `api/.env`.

**Financial planner** (AI coach checkup & plans) — implement `FinancialPlanner`
(`api/src/planner/planner.interface.ts`), register it in
`planner.module.ts`'s factory (keyed off `FINANCIAL_PLANNER` env var), and
set `FINANCIAL_PLANNER=openai` plus `OPENAI_API_KEY` in `api/.env` — e.g. to
back the plans with live market data or an LLM instead of the deterministic
rule engine.

**Alert channel** (WhatsApp/Telegram) — implement `AlertChannel`
(`api/src/alerts/alert-channel.interface.ts`), register it in
`alerts.module.ts`'s factory (keyed off `ALERT_CHANNEL` env var), and set
`ALERT_CHANNEL=telegram` plus `TELEGRAM_BOT_TOKEN` in `api/.env`. Telegram's
Bot API is free and the simplest real option to wire up first.

## Not yet built

This scaffold covers the full MVP feature list (see `FEATURES.md` for the
audit against the original brief) but does not include: production auth
hardening (refresh tokens, rate limiting), true LLM conversation for the
advisor chat (it parses intents deterministically today, with no memory of
earlier turns; `FinancialPlanner.chat` is where an LLM slots in), or a
native mobile app (spec
suggested Flutter; this scaffold ships a responsive web app styled to feel
like one instead — bottom tab bar, light/dark theme).
