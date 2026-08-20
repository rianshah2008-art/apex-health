# Apex Health

A personal health dashboard that pulls vitals, training and recovery data from Garmin
Connect and layers on manual weight, hydration and nutrition tracking with an AI
photo-based meal scanner.

## Stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router, Turbopack) on Vercel                      |
| Backend/DB | Convex (schema, queries, mutations, actions, crons, file storage) |
| Auth       | Convex Auth (email + password)                                    |
| Styling    | Tailwind CSS v4                                                   |
| Charts     | Recharts                                                          |
| Meal AI    | Ollama Cloud vision model, called from a Convex action            |

## Local development

```bash
npm install
npx convex dev     # terminal 1 — pushes schema/functions, watches for changes
npm run dev        # terminal 2 — http://localhost:3000
```

`.env.local` holds `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` and is written by
`npx convex dev`. It is gitignored.

## Convex deployment environment variables

These live on the Convex deployment (dashboard → Settings → Environment Variables), not in
`.env.local`, because Convex actions run on Convex's servers.

| Variable                       | Set by                             | Purpose                             |
| ------------------------------ | ---------------------------------- | ----------------------------------- |
| `SITE_URL`                     | `npx @convex-dev/auth`             | Auth redirect origin                |
| `JWT_PRIVATE_KEY`              | `npx @convex-dev/auth`             | Signs session JWTs                  |
| `JWKS`                         | `npx @convex-dev/auth`             | Public keys for JWT verification    |
| `GARMIN_EMAIL`                 | you                                | Garmin Connect login                |
| `GARMIN_PASSWORD`              | you                                | Garmin Connect login                |
| `OLLAMA_API_KEY`               | you                                | Ollama Cloud meal scanner           |

Set one with:

```bash
npx convex env set OLLAMA_API_KEY sk-...
```

## Deploying to Vercel

Import the repository in Vercel and override the build command so that Convex functions
deploy alongside the frontend:

- **Build Command:** `npx convex deploy --cmd 'npm run build'`
- **Environment Variables:** `CONVEX_DEPLOY_KEY` (generate a production deploy key from the
  Convex dashboard). `NEXT_PUBLIC_CONVEX_URL` is injected automatically by `convex deploy`.

After the first production deploy, point the production Convex deployment's `SITE_URL` at
the Vercel URL:

```bash
npx convex env set SITE_URL https://your-app.vercel.app --prod
```

## Project layout

```
app/                  Next.js App Router pages
  login/              Convex Auth sign-in / sign-up
  dashboard/          Persistent nav shell
    vitals/           Section 1 — Daily Vitals
    recovery/         Section 2 — Recovery & Readiness
    training/         Section 3 — Training Performance
    nutrition/        Section 4 — Weight, Hydration & Nutrition
components/           Shared UI (MetricCard, ProgressBar, charts, …)
convex/               Schema, queries, mutations, actions, crons
lib/                  Framework-agnostic client helpers
proxy.ts              Route protection (Next.js 16 replacement for middleware.ts)
```
