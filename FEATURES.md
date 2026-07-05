# NetWealth — Features & Testing Guide

This is a walkthrough of everything in the MVP and exactly how to try it. For
install/run instructions see [`README.md`](./README.md). Everything below
assumes the API is running on `http://localhost:3001` and the web app on
`http://localhost:3000`, with the database seeded (`npm run prisma:seed` in
`api/`).

Demo login: **demo@netwealth.app** / **password123**

---

## 1. Auth

Email/password signup and login, JWT-based (`api/src/auth`). The token is
stored in `localStorage` on the frontend and attached to every API request.

**Try it:** Log out (top right), then try visiting `http://localhost:3000/dashboard`
directly — you'll get bounced to `/login`. Log back in with the demo account,
or hit "Sign up" to create a fresh account (it'll start empty — see §4 to
populate it).

---

## 2. Net worth dashboard

`GET /reports/net-worth` sums every account's balance, split by
`kind: ASSET | LIABILITY` (derived automatically from account type — see §3),
and returns `netWorth = totalAssets - totalLiabilities` plus a breakdown by
account type.

**Try it:** `/dashboard` shows the net worth figure, total assets/liabilities
cards, and an "Assets by type" / "Liabilities by type" breakdown. Add or
remove an account on `/accounts` and refresh — the numbers update immediately
since nothing is cached.

---

## 3. Asset & liability tracking

Ten account types are supported: `BANK, CASH, CRYPTO, STOCK, MUTUAL_FUND,
PROPERTY, VEHICLE` (assets) and `LOAN, CREDIT_FACILITY, MORTGAGE`
(liabilities). The asset/liability split (`kind`) is computed server-side
from the type, not chosen by the user — see `account-type.util.ts`.

**Try it:** `/accounts` → "Add manual account" → pick "Property" or "Loan"
and watch it land in the correct assets/liabilities bucket on the dashboard.

---

## 4. Bank connections (mock Open Banking provider) — live events + scheduled sync

Real Nigerian Open Banking aggregators (Mono, Okra, OnePipe, Stitch) require
paid accounts and live bank credentials, so this MVP ships a `MockBankProvider`
behind the same `BankProvider` interface a real one would implement
(`api/src/bank-integration/bank-provider.interface.ts`). It simulates linking
an account at GTBank/Access/Zenith/Kuda/OPay and generates realistic
transaction history.

The brief specifically calls out that real-time bank connectivity isn't
guaranteed for every Nigerian bank, and that the app should handle both live
push events *and* scheduled polling. This is implemented as three separate
sync paths, all funneling through the same `performSync` logic
(`BankIntegrationService`):

1. **Manual sync** — the "Sync" button in the UI (`POST /bank/accounts/:id/sync`).
2. **Live event (webhook)** — `POST /bank/webhook` with `{ providerAccountId }`.
   This is what a real Mono/Okra webhook call looks like: no user JWT (the
   caller is the provider's server), authenticated instead by an optional
   shared secret (`BANK_WEBHOOK_SECRET`) the same way a real webhook
   signature check would work.
3. **Scheduled sync** — `BankSyncScheduler` runs every 5 minutes
   (`@nestjs/schedule`) and polls every linked account, as a fallback for
   banks that don't push webhooks reliably. Toggle with
   `SCHEDULED_SYNC_ENABLED` in `api/.env`.

**Try it:**
- `/accounts` → click any bank under "Connect a bank (mock provider)". A new
  account appears instantly with a starting balance and is auto-synced (see
  the "Synced ..." timestamp). Click "Sync" to pull more simulated
  transactions.
- Simulate a live webhook push directly:
  ```bash
  curl -X POST http://localhost:3001/api/bank/webhook \
    -H "Content-Type: application/json" \
    -d '{"providerAccountId": "<copy from GET /api/accounts>"}'
  ```
- Watch the API logs — every 5 minutes you'll see a
  `[BankSyncScheduler] Scheduled sync: N/M linked accounts synced` line.

**To wire up a real provider:** implement `BankProvider`, register it in
`bank-integration.module.ts`, set `BANK_PROVIDER=mono` (or `okra`) and the
relevant secret key in `api/.env`.

---

## 5. Automatic transaction categorization

Every transaction — whether pulled from a bank sync or entered manually — is
run through a `Categorizer` (`api/src/categorization`). The MVP ships a
keyword-rule implementation (`MockCategorizer`) behind the same interface an
LLM-based categorizer would use, covering patterns like:

| Transaction contains | Category |
|---|---|
| UBER, BOLT | Transport |
| SHOPRITE, SPAR | Groceries |
| MTN, AIRTEL, VTU, TOPUP | Airtime & Data |
| NETFLIX, DSTV, SPOTIFY | Entertainment |
| JUMIA, KONGA | Shopping |
| SALARY, PAYROLL | Salary |
| TRANSFER FROM | Transfer |
| IKEDC, EKEDC, ELECTRICITY | Utilities |

**Try it:** `/transactions` — every seeded/synced transaction already has a
category assigned. Use the dropdown on any row to recategorize it manually;
this is recorded as `categorizedBy: "user"` (vs `"rule"` or eventually `"ai"`)
so future model training could prioritize correcting rule mistakes over
re-litigating user corrections.

**To wire up a real LLM:** implement `Categorizer`, register it in
`categorization.module.ts`, set `CATEGORIZER=openai` and `OPENAI_API_KEY` in
`api/.env`.

---

## 6. AI-powered dashboard insights

This is the "AI-powered" part of the product surface. `GET /insights`
(`api/src/insights`) computes, from the user's *own* transactions/budgets/
goals — no external calls, no hallucination risk:

- **Financial health score (0–100)** — a blend of savings rate this month
  (40 pts), budget adherence (30 pts), and cash flow trend vs last month
  (30 pts). Shown as a ring gauge on the dashboard.
- **Budget warnings** — flags any budget you're over, or within 15% of the
  limit.
- **Spending spikes** — flags a category if this month's spend is >30% above
  your recent monthly average for that category.
- **Subscription detection** — groups transactions by merchant, and flags
  ones that recur every ~20–40 days with <20% amount variance across **3+
  occurrences** (2+ is treated as coincidence, not a pattern — see note
  below). Predicts the next charge date.
- **Salary/income prediction** — same recurrence detection, applied to
  income transactions, to predict your next payday.
- **Savings recommendations** — a nudge if your savings rate is under 10%
  (naming your biggest expense category and, if you have one, a goal to
  redirect savings toward), or a pat on the back if it's over 20%.

It's presented as a **single rotating popup pinned to the corner of the
dashboard** (`components/insight-toast.tsx`) — one insight at a time,
auto-cycling every few seconds, with dots/arrows to navigate and pause-on-
hover — rather than a list that grows longer as insights pile up. The ✕
button collapses it to a small sparkles bubble that brings it back on tap.
Non-blocking by design (the request that prompted this feature was
explicitly for something non-intrusive).

**This is a deterministic rule engine, not an LLM call** — same input always
produces the same output, and every number in an insight message traces back
to a real query against your data. It's built behind an `AiAdvisor` interface
(`api/src/insights/advisor.interface.ts`) specifically so it can be swapped
for an OpenAI-backed implementation later (`AI_ADVISOR=openai` in
`api/.env`) without touching the dashboard code.

**Try it:** `/dashboard` — the popup in the bottom-right corner. The seed
data is deliberately built with ~4 months of recurring DSTV/Netflix charges
and salary payments so subscription/salary detection has something real to
find; try `POST /bank/accounts/:id/sync` a few times or add manual
transactions to watch the health score and insights change.

---

## 7. AI Coach — your financial advisor

The `/coach` page (`api/src/planner`) is the "personal wealth manager"
feature: tell it what you're aiming for and your risk appetite, and it
builds a plan **from your real NetWealth data** — balances, detected income,
and actual spending. Three parts:

**a) Ask the advisor** (`POST /planner/chat`) — a chat box where you type
questions in plain English: *"I have ₦1m and want to retire at 40, what
should I do?"*, *"What should I invest in? I don't like risk"*, *"Can I
afford ₦250k?"*, *"I want to buy a house of ₦20m in 5 years"*, *"How am I
doing financially?"*. It parses amounts (`1m`, `₦500k`, `2 million`), ages,
horizons, and risk phrasing (including negations like "I don't like risky
investments" → conservative) out of the question, routes to an intent, and
answers with real numbers from your accounts — reusing the same plan/review
engines underneath. Every reply comes with tappable follow-up suggestion
chips. When it has to assume something (your age, a timeframe) it says so
and tells you what to add for a tighter answer.

**b) Financial checkup** (`GET /planner/review`) — runs automatically when
the page loads, like an advisor reviewing your file before talking goals.
Four areas, each rated good / watch / needs action with specific naira
numbers:

- **Emergency fund** — months of typical expenses covered by liquid savings
  (target: 6 months in a money market fund).
- **Savings rate** — what % of detected income survives the month (benchmark:
  20%).
- **Debt load** — liabilities as a share of assets, with the reminder that
  Nigerian loan rates usually beat any safe investment return.
- **Idle cash** — flags naira sitting in current accounts beyond the
  emergency fund, where inflation eats it.

**c) Goal planner** (`POST /planner/plan`) — three modes:

- **Retire early** — "I have ₦1,000,000, I want to retire at 40": computes
  the pot needed to sustain your lifestyle indefinitely (safe-withdrawal-rate
  rule), the exact monthly amount to save and invest, your implied savings
  rate and lifestyle cap, and a feasibility verdict
  (`on_track / achievable / stretch / unrealistic`). When it's a stretch, it
  quantifies the alternatives: retiring 5 years later, or a 20% leaner
  lifestyle.
- **Save for a target** — house deposit, school fees, a car: target amount +
  horizon → required monthly saving. Goals under 3 years away automatically
  get a capital-preservation allocation regardless of chosen risk appetite —
  growth assets are too volatile that close to the finish line.
- **Grow my wealth** — no fixed target: projects what your capital + monthly
  savings compound into over the horizon, and shows how much of the outcome
  is growth vs money you put in.

Every plan includes a **risk-appetite-driven allocation with Nigerian
instruments** (T-bills/money market, FGN bonds, NGX index funds, dollar
assets/Eurobond funds, REITs, and a capped crypto sleeve for aggressive) with
a one-line rationale per slice, plus written advice and explicit assumptions.
All returns are stated in *real* (inflation-adjusted) terms — critical in a
high-inflation economy — so every figure reads in today's naira.

The form prefills from your data (`GET /planner/defaults`): average monthly
spend, liquid+invested balances as starting capital, and income − expenses
as monthly saving capacity — all overridable.

**This is a deterministic rule engine** behind a `FinancialPlanner` interface
(`api/src/planner/planner.interface.ts`), same pattern as everything else:
swap in a live-market-data or LLM-backed implementation with
`FINANCIAL_PLANNER=openai` in `api/.env` without touching the page. It is
educational guidance, not licensed financial advice, and says so in its
assumptions.

**Try it:** `/coach` → ask the chat *"I have 1m and want to retire at 40,
what should I do?"* or tap a suggestion chip. The checkup loads on its own
below it. Then pick "Retire early", set age 30 → retire at 40, and hit
**Build my plan** for the full breakdown — verdict, allocation bars, monthly
saving required, and what retiring at 45 instead would cost. Try "Save for
a target" with a 2-year horizon to see the short-horizon allocation
override kick in.

---

## 8. "Can I afford this?" purchase simulator

`POST /simulator/afford-check` (`api/src/simulator`) checks a hypothetical
purchase against your real liquid balance (bank + cash accounts), your
average monthly spend over the last 3 months, and — if you pick a category —
the impact on that category's budget for the month.

Verdict is one of `affordable` / `tight` / `not_affordable`:
- `not_affordable` — the amount exceeds your liquid balance.
- `tight` — you can cover it, but it'd leave you with less than half a
  typical month's expenses.
- `affordable` — comfortably covered.

**Try it:** `/dashboard` → the "Can I afford this?" card. Try a small amount
(affordable), a huge one (not affordable), and pick a category that already
has a tight budget to see the budget-impact warning appended to the message.

---

## 9. Spending alerts (WhatsApp/Telegram-style)

`api/src/alerts` implements the "non-intrusive alerts on your phone" idea
from the brief. It's built the same way as the bank/categorizer/insights
mocks: an `AlertChannel` interface (`send(destination, message)`) with a
`MockAlertChannel` that logs what would have been sent and records it in the
database, so the UI can show alert history without needing real WhatsApp
Business / Telegram Bot credentials.

- `GET/PATCH /alerts/settings` — enable/disable alerts, set a destination
  (modeled as a Telegram chat ID).
- `POST /alerts/test` — sends one test message immediately.
- `POST /alerts/check` — runs the same `AiAdvisor` insight engine behind the
  dashboard, and dispatches any new `warning`-severity insight (budget over
  limit, spending spike) as an alert — deduped per insight per day, so
  calling it repeatedly doesn't spam.
- The 5-minute `BankSyncScheduler` cron (§4) also calls this automatically
  for every user who's opted in, after each sync round.

**Try it:** `/settings` (gear icon in the top nav) → check "Enable spending
alerts", enter any value as the Telegram chat ID (e.g. `123456789` — it's
not validated against a real Telegram account in mock mode), save, then hit
"Send test alert" and "Check for alerts now". The seed data includes a
transaction that pushes the Shopping budget over its limit, so "Check for
alerts now" on the demo account should surface real alerts, not just the
test one. Sent alerts appear in the list below and in the API log
(`[SpendingAlert] -> <destination>: <message>`).

**To wire up a real channel:** implement `AlertChannel`
(`api/src/alerts/alert-channel.interface.ts`), register it in
`alerts.module.ts`, set `ALERT_CHANNEL=telegram` and `TELEGRAM_BOT_TOKEN` in
`api/.env`. Telegram's Bot API is free and by far the simplest to implement
for real — WhatsApp's Business API requires Meta business verification.

---

## 10. Monthly budgets

Per-category spending limits for the current month (`api/src/budgets`).
"Spent" is computed live from actual `EXPENSE` transactions in that category
and month — never stored/cached, so it can't drift out of sync.

**Try it:** `/budgets` shows progress bars for the seeded categories
(Groceries, Transport, Entertainment, Shopping). Add a new budget for another
category, then go recategorize a transaction into it on `/transactions` —
the progress bar updates on next load.

---

## 11. Goals

Simple savings goals with a target amount, optional target date, and current
progress (`api/src/goals`).

**Try it:** `/goals` — add one, watch the progress bar. (Progress is
currently set manually via `currentAmount`, not auto-derived from a specific
account — see "Known limitations" below.)

---

## 12. Cash flow & category reports

`/reports` — a 12-month income/expense/net line chart and a pie chart of
current-month spending by category (`api/src/reports`). The dashboard shows
a condensed 6-month version of the cash flow chart.

**Try it:** Recategorize a transaction on `/transactions`, then check
`/reports` — the pie chart reflects it immediately (same live-query
principle as budgets).

---

## 13. Responsive design & theme

The web app is built mobile-first and styled to feel like a native app on a
phone, not just a shrunk desktop site:

- **Bottom tab bar** on screens narrower than 768px (`components/bottom-nav.tsx`)
  replaces the top nav links — Dashboard/Accounts/Transactions/Budgets/Goals/Reports
  as icon tabs fixed to the bottom, the standard native-app pattern. The top
  nav switches back in for wider (desktop/tablet) screens.
- **Light/dark theme toggle** (sun/moon icon in the top nav, next to the
  settings gear) — defaults to dark, persists per-browser via `next-themes`,
  no flash of the wrong theme on reload.
- All grids/forms collapse to a single column on narrow screens; the
  transactions table scrolls horizontally on phones rather than squeezing
  five columns into 375px.

**Try it:** resize your browser below ~768px wide (or open dev tools' device
toolbar), and click through the pages — the top nav links disappear and a
bottom tab bar appears. Click the sun/moon icon to switch themes; reload the
page to confirm it stuck.

---

## Testing checklist (fast end-to-end pass)

1. Log in with the demo account.
2. `/dashboard` — confirm a non-zero net worth, a populated cash flow chart,
   a health score ring, the AI-insight popup rotating in the corner (dismiss
   it, confirm the sparkles bubble brings it back), and the "Can I afford
   this?" widget returns a verdict.
3. `/coach` — confirm the financial checkup shows rated cards with real
   numbers, then build a "Retire early" plan (age 30 → 40) and confirm a
   verdict, allocation bars, and advice render.
4. `/accounts` — connect a new mock bank; confirm it appears with a balance
   and "Synced ..." timestamp.
5. `/transactions` — confirm the new account's transactions appear,
   pre-categorized; recategorize one and confirm it sticks on reload.
6. `/budgets` — add a budget for a category you just recategorized a
   transaction into; confirm "spent" reflects it.
7. `/goals` — add a goal, confirm the progress bar renders.
8. `/reports` — confirm both charts render with real numbers.
9. `/settings` — enable alerts, send a test alert, run "Check for alerts
   now", confirm both show up in the list below.
10. Resize to a phone-width window — confirm the bottom tab bar appears and
   the top nav links disappear; toggle the theme and reload to confirm it
   persists.
11. Log out, confirm `/dashboard` redirects to `/login` rather than flashing
    any data.

---

## What's mocked vs. real (and how to flip each one)

| Piece | Mocked with | Env var to swap | Real options |
|---|---|---|---|
| Bank connection | `MockBankProvider` | `BANK_PROVIDER=mono\|okra` | Mono, Okra, OnePipe, Stitch |
| Transaction categorization | `MockCategorizer` (keyword rules) | `CATEGORIZER=openai` | OpenAI / any LLM |
| Dashboard insights | `RuleBasedAdvisor` (deterministic) | `AI_ADVISOR=openai` | OpenAI / any LLM |
| AI coach (checkup & plans) | `RuleBasedPlanner` (deterministic) | `FINANCIAL_PLANNER=openai` | OpenAI / any LLM, live market-data APIs |
| Spending alerts | `MockAlertChannel` (logs + records) | `ALERT_CHANNEL=telegram` | Telegram Bot API (free), WhatsApp Business API |

In every case, the mock and the real implementation share one TypeScript
interface, so swapping providers is a matter of writing one new class and
flipping an env var — nothing else in the codebase (controllers, frontend,
DB schema) needs to change.

---

## Audit vs. the original MVP brief

Every bullet from the original product brief, checked against what's built:

**Core MVP**

| Requested | Status |
|---|---|
| Dashboard showing current net worth | ✅ `/dashboard`, `GET /reports/net-worth` |
| Automatic income and expense categorization | ✅ §5 |
| Cash flow reports | ✅ §12 |
| Monthly budgets | ✅ §10 |
| Asset tracking (cash, investments, vehicles, property) | ✅ §3 — cash, crypto, stocks, mutual funds, property, vehicles all as distinct account types |
| Goal tracking | ✅ §11 |
| Real-time bank connections (live events *and* scheduled syncing, per the brief's own caveat) | ✅ §4 — webhook + 5-min cron, not just manual sync |
| AI-powered categorization | ✅ §5, swappable to a real LLM |
| Net worth calculation (assets − liabilities, with the specific subtypes listed: bank/cash/crypto/stocks/mutual funds/property/vehicles minus loans/credit facilities/mortgages) | ✅ §2 — every listed subtype is its own `AccountType` |

**"What would make your app stand out" (optional differentiators)**

| Requested | Status |
|---|---|
| AI financial coach | ✅ §7 — free-text advisor chat + financial checkup + retirement/target/growth planning with Nigerian asset allocations, on top of the passive insights (§6) |
| Nigerian spending insights | ✅ categorization rules and seed data are NG-specific (UBER, SHOPRITE, MTN, IKEDC, DSTV, JUMIA...), all amounts in NGN |
| Bill prediction | ✅ §6 — recurring-charge detection |
| Salary prediction | ✅ §6 |
| Subscription detection | ✅ §6 |
| "Can I afford this?" purchase simulator | ✅ §8 |
| Personalized saving recommendations | ✅ §6 + §7 — passive nudges plus full savings/investment plans |
| Daily financial health score | ✅ §6 — computed fresh on every dashboard load (not a cached once-a-day snapshot, but always current) |
| WhatsApp or Telegram spending alerts | ✅ §9 (mocked, swappable to real Telegram Bot API) |

**Not built:** a native mobile app (the brief suggested Flutter; this scaffold is a
responsive web app styled to feel like one — see §13). Revenue model and
tech-stack sections of the brief were business/architecture decisions, not
features to implement.

## Known limitations

Not in this MVP: production auth hardening (refresh tokens, rate limiting),
goal progress tied automatically to a specific account balance (it's a
manually-updated `currentAmount` today), and true LLM conversation for the advisor
chat — it parses intents/amounts deterministically and has no memory of
earlier turns (the `FinancialPlanner.chat` interface is where a real LLM
would plug in via `FINANCIAL_PLANNER=openai`).
