# KIG Marketing CRM

Internal Marketing task-management CRM for KIG Holding. This repository currently contains only the Phase 0 technical foundation.

Use Node.js **24 LTS** (`>=24 <25`); `.nvmrc` and `.node-version` pin 24.19.0. npm 11.17.0 is the recorded installation tool; npm 10 and 11 are permitted. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and provide private development values when later phases require them. Keep secrets out of Git. Phase 0 requires no database or authentication credentials and does not connect to a database. Google Drive credentials are deferred until its integration phase.

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

Railway is the production target. Neon PostgreSQL uses the transactional Postgres.js driver with Drizzle. Database schema, migrations, Better Auth routes, and business workflows start in subsequent phases.
