# PromptArena

A prompt-experiment workbench built on the **Respan** gateway.

Define a test set and 2–5 prompt variants, run the full matrix through Respan,
and rank the variants — either by an LLM judge's 1–10 score or by a **pairwise
tournament with Bradley-Terry ratings and bootstrap confidence intervals** (the
methodology LMSYS Chatbot Arena uses for models, applied to prompts). Every model
call is a real span in your Respan workspace, grouped by `experiment_id`.

> Comparing prompts by eyeballing one output is unreliable. A scored matrix —
> better yet, a tournament with confidence intervals — is how you actually tell
> variants apart, instead of trusting a 7.3-vs-6.9 that's inside the noise.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in the two required values
npm run dev                     # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `RESPAN_API_KEY` | ✅ | Respan API key (OpenAI-compatible gateway + management API). |
| `RESPAN_MODEL` | ✅ | A model id enabled on your account, e.g. `gpt-4o-mini`. |
| `RESPAN_CUSTOMER_ID` | — | Shared `customer_identifier` on every call. Default `promptarena`. |
| `RESPAN_PRICE_PER_1K_TOKENS` | — | Blended price for cost figures. Default `0.005`. |
| `RESPAN_BASE_URL` | — | Gateway base. Default `https://api.respan.ai/api`. |
| `RESPAN_API_BASE_URL` | — | Management API base. Defaults to the SDK's own. |
| `PROMPTARENA_DB` | — | Run-history SQLite path. Default `./.data/promptarena.db`. |

---

## Evaluation modes

### Absolute
Each output is scored 1–10 by an LLM judge. With a **judge ensemble** (N samples),
the per-cell score is the mean and the spread (σ) surfaces judge disagreement.
Variants are ranked by a **bootstrapped mean** with a 95% confidence interval.

### Arena (the headline)
Instead of absolute scores, variants fight **pairwise battles** per test case:

- Every unordered pair, every case, **both orderings** (A,B and B,A) to cancel the
  judge's position bias. Ties allowed.
- Outcomes are fit with the **Bradley-Terry** model (maximum likelihood via the
  minorization-maximization algorithm — order-independent, unlike sequential Elo)
  and mapped to a familiar **Elo scale** (1500-centered, 400 ≈ 10:1 odds).
- A **bootstrap over battles** (resample → refit) yields a **95% CI** per variant
  and **P(rank 1)** — the probability that variant is truly the best. That's what
  tells you whether the winner is real or you got lucky on one example.
- A head-to-head **win-rate matrix** shows who beats whom.

The rating math lives in [`app/lib/ratings.ts`](app/lib/ratings.ts) and is covered
by [unit tests](app/lib/__tests__/ratings.test.ts) (`npm test`).

---

## Systems & observability

- **Streaming** — the run route returns NDJSON; the client fills the matrix,
  leaderboard, and live telemetry incrementally. ([`app/api/run/route.ts`](app/api/run/route.ts))
- **Bounded concurrency** — a worker pool ([`app/lib/pool.ts`](app/lib/pool.ts))
  balances speed against rate limits.
- **Retries + backoff** — transient gateway failures (429/5xx/network) are retried
  with exponential backoff + jitter, honoring `Retry-After`. ([`app/lib/retry.ts`](app/lib/retry.ts))
- **Content-addressed cache** — deterministic calls are cached by a hash of
  (model, temperature, messages), so re-running an unchanged variant+input is free.
  ([`app/lib/cache.ts`](app/lib/cache.ts))
- **Live telemetry** — throughput, p50/p95 latency, tokens, cost, retries, and
  cache hits stream as the run executes. ([`app/lib/metrics.ts`](app/lib/metrics.ts))
- **Observability tagging** — every request carries Respan `metadata`
  (`experiment_id`, `variant`, `case_index`, `role`) and a shared
  `customer_identifier`, forwarded verbatim by the SDK and ignored by plain OpenAI
  servers (degrades gracefully). The `experiment_id` is shown in the header (click
  to copy) to find the run in Respan. ([`app/lib/respan.ts`](app/lib/respan.ts))

> **Latency note.** The gateway adds ~50–150 ms per call. Acceptable here because
> this is about comparison and observability, not raw latency.

---

## Persistence & the self-driving loop

- **Run history** — every completed run (config + leaderboard) is saved via Node
  24's built-in **`node:sqlite`** — a real typed SQL layer with zero native-module
  dependency. The history panel charts each variant's metric across runs
  (score-over-time). ([`app/lib/db.ts`](app/lib/db.ts))
- **Promote to Respan** — promote the winning variant to a **managed Respan prompt
  version** and deploy it live, in one click. This uses the official
  **`@respan/respan-api`** SDK (`createPrompt → createPromptVersion → commit →
  deploy`), so the request shapes are exactly what Respan expects — **no guessed
  endpoints**. ([`app/lib/promote.ts`](app/lib/promote.ts))
- **Reference by id** — a deployed prompt can be referenced in a completion via the
  verified `prompt: { prompt_id, variables, version }` field, so the prompt lives
  outside the code.

> Production note: `node:sqlite` needs a writable disk (fine locally, not on
> serverless). The repository layer in `db.ts` is the only thing that changes to
> point at Postgres/Turso for a serverless deploy.

---

## Known limitations (named, not hidden)

- A single LLM judge is noisy and biased toward longer/more confident outputs.
  Arena's order-swapping and the judge ensemble reduce this; they don't eliminate
  it. Read CIs as the honest uncertainty.
- Cost grows as variants × cases × (2 for absolute / pairs×2 for arena) × ensemble.
  Capped at 800 calls/run; the UI estimates cost before you run.
- Runs fail if the account lacks credits, a provider key, or an enabled
  `RESPAN_MODEL`. That's account setup — the gateway error is surfaced per cell, the
  run doesn't crash.
- Run history is local (not cross-machine shareable in this build).

---

## Scripts

```bash
npm run dev         # local dev server
npm run build       # production build
npm run start       # serve the build
npm run typecheck   # tsc --noEmit
npm test            # vitest (rating engine + stats)
```

---

## Verify it produces spans

1. Put a real `RESPAN_API_KEY` and an enabled `RESPAN_MODEL` in `.env.local`.
2. `npm run dev`, pick **Arena**, run a small matrix (2–3 variants × 3 cases).
3. Watch telemetry stream; the leaderboard shows ratings with CIs; the matrix
   colors by per-case win rate.
4. Open your Respan dashboard and find the calls grouped by the `experiment_id`
   in the header. Optionally click **Promote to Respan** and confirm a new
   deployed prompt version appears in your workspace.

---

## Deploy (Vercel)

Standard Next.js, zero config. Fastest path from this directory:

```bash
npx vercel login          # one-time, your account
npx vercel                # preview deploy
npx vercel --prod         # production
```

Set `RESPAN_API_KEY` and `RESPAN_MODEL` (plus any optional vars: `RESPAN_CUSTOMER_ID`,
`RESPAN_DASHBOARD_URL`, `RESPAN_PRICE_PER_1K_TOKENS`) in the Vercel project's
Environment Variables, then redeploy. `/api/run` streams NDJSON on the Node.js
runtime.

**Function duration.** The arena route declares `export const maxDuration = 300`.
Vercel respects this up to the plan ceiling (Hobby = 60s, Pro = 300s default and
up to 800s configurable). Shrink the run size if you're on Hobby; bump
`maxDuration` if you're on Enterprise.

**Node version.** `node:sqlite` requires Node 22.5+. The package's
`engines.node` is set accordingly; Vercel picks Node 22 by default.

**Run history on serverless.** Persistence uses `node:sqlite`. On Vercel it falls
back to `/tmp` (ephemeral, per warm instance), and if `node:sqlite` isn't
available on the runtime it degrades to a no-op — the app runs fine, history just
won't persist across cold starts. For durable cross-instance history, point
`app/lib/db.ts` at Postgres/Turso (that module is the only thing that changes).

---

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · the `openai` SDK
(gateway) and `@respan/respan-api` (prompt management) · `node:sqlite` (history) ·
Vitest. Hand-rolled SVG for the sparklines and win-rate heatmap — no chart deps.
