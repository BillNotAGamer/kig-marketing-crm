# KIG Marketing CRM

Internal Marketing task-management CRM for KIG Holding. This repository currently contains the Phase 0 foundation and Phase 1 persistence schema.

Use Node.js **24 LTS** (`>=24 <25`); `.nvmrc` and `.node-version` pin 24.19.0. npm 11.17.0 is the recorded installation tool; npm 10 and 11 are permitted. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and provide private development values when later phases require them. Keep secrets out of Git. Offline checks and the placeholder require no database credentials. Phase 1 server DB/auth access validates all three required variables; BETTER_AUTH_SECRET must contain at least 32 characters. Google Drive credentials are deferred until its integration phase.

```sh
npm run dev
```

Open http://localhost:3000. The placeholder proves Quicksand, shadcn Button, responsive layout, and light/dark/system themes.

Validate the foundation:

```sh
npm run check
```

This runs formatting, ESLint, generated route types/TypeScript, Vitest, the production build, and Playwright test discovery. Build-time Google Font downloads need network access. Browser execution is separate:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production server, so run a build first. `npm run format` formats source and documentation; `npm run test:watch` runs Vitest interactively.

Business documentation under `docs/` is authoritative: read `docs/README.md` before implementation and `docs/README-VN.md` for stakeholder semantics. Database and authorization designs have bilingual `04-` and `05-` documents. Agent governance is in `AGENTS.md`; phase evidence is in `docs/reports/`.

Railway is the production target. Neon PostgreSQL uses the transactional Postgres.js driver with Drizzle. Phase 1 implements schema and migrations; auth HTTP routes and business workflows remain deferred.

Database setup for an explicitly authorized empty development PostgreSQL database:

```sh
npm run auth:schema:check
npm run db:generate
# Review drizzle/0000_initial_v1_1.sql before applying.
# Set private DATABASE_URL and KIG_DATABASE_ENV=development in .env.local.
npm run db:migrate
npm run db:verify
npm run test:db
```

Migration preflight refuses pre-existing public tables/enums or migration history. Stop and review an existing database rather than removing anything. Never use push as the authoritative migration workflow. The extra environment marker is an operator assertion: verify the target is development before setting it. No initial HEAD is provisioned. `npm run db:studio` opens development-only database tooling; `npm run db:check` requires no database. The initial migration and live PostgreSQL integration checks passed on the authorized development database.
