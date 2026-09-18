# Phase 0 — Project Bootstrap & Documentation Baseline

Date: 2026-09-18

## 1. Verdict

PASS

## 2. Workspace Verification

- Exact workspace: `F:\Coding\Web development\KIG Marketing CRM`.
- Git root: `F:/Coding/Web development/KIG Marketing CRM` after initialization.
- Initial Git root/branch/HEAD: absent; the directory was not a Git repository.
- Authoritative branch: `main`, initialized with `git init -b main`.
- Initial HEAD: unborn. Final HEAD is the Phase 0 baseline commit containing this report (see section 10).
- Pre-existing files: `docs/README.md` and `docs/README-VN.md` only. Both were inspected before initialization and preserved in place.
- Original English approved technical V1.1 content is retained in full as an explicitly labeled appendix. Original Vietnamese business sections remain, with version updates and additive V1.1 safeguards. No approved detail was deleted.
- Scaffold generated in verified child `kig-marketing-crm`, merged into the authoritative root without collisions, and the empty child removed. `--disable-git` prevented a nested Git repository. No other project/clone was used.

## 3. Runtime

- Node: `v24.19.0` throughout setup and validation.
- Initial sandbox npm: `10.8.1` (`C:\Program Files\nodejs\npm.cmd`).
- Download/install/full quality-gate npm: `11.17.0` (existing fnm Node 24 environment).
- Package manager: npm; `packageManager: npm@11.17.0`; committed npm lockfile.
- Engine constraints: Node `>=24 <25`, npm `>=10 <12`; `.npmrc` enables engine-strict.
- `.nvmrc` and `.node-version`: `24.19.0`.
- PowerShell blocks unsigned `npm.ps1`; `npm.cmd` works without changing execution policy.

## 4. Framework Versions

Exact resolved direct dependency versions follow. No canary/beta/RC framework or Drizzle v1 prerelease was selected.

| Package                      | Resolved version |
| ---------------------------- | ---------------- |
| @better-auth/drizzle-adapter | 1.7.5            |
| @date-fns/tz                 | 1.5.0            |
| @hookform/resolvers          | 5.2.2            |
| better-auth                  | 1.7.5            |
| class-variance-authority     | 0.7.1            |
| cn                           | 0.3.0            |
| date-fns                     | 4.4.0            |
| drizzle-orm                  | 0.45.2           |
| lucide-react                 | 1.47.0           |
| next                         | 16.3.5           |
| next-themes                  | 0.4.6            |
| postgres                     | 3.4.9            |
| radix-ui                     | 1.6.7            |
| react                        | 19.2.8           |
| react-dom                    | 19.2.8           |
| react-hook-form              | 7.88.0           |
| shadcn                       | 4.21.0           |
| tw-animate-css               | 1.4.0            |
| zod                          | 4.6.5            |
| @playwright/test             | 1.63.0           |
| @tailwindcss/postcss         | 4.3.3            |
| @testing-library/jest-dom    | 7.0.1            |
| @testing-library/react       | 16.3.3           |
| @testing-library/user-event  | 14.6.7           |
| @types/node                  | 24.13.5          |
| @types/react                 | 19.3.0           |
| @types/react-dom             | 19.3.0           |
| @vitejs/plugin-react         | 6.1.1            |
| drizzle-kit                  | 0.31.10          |
| eslint                       | 9.39.5           |
| eslint-config-next           | 16.3.5           |
| jsdom                        | 30.1.0           |
| prettier                     | 3.9.8            |
| tailwindcss                  | 4.3.3            |
| typescript                   | 5.9.3            |
| vitest                       | 5.0.1            |

Better Auth 1.7.5 requires its standalone stable `@better-auth/drizzle-adapter` package. Postgres.js (`postgres`) is the connection-based transactional driver selected for Railway + Neon. `@date-fns/tz` provides timezone support alongside date-fns 4. Stable Drizzle ORM 0.45.2 and Kit 0.31.10 were resolved from npm's stable tags.

## 5. Files Added / Changed

- Root Next.js scaffold: package manifest/lockfile, TypeScript, ESLint, PostCSS, minimal Next config, App Router under `src/`, starter static assets.
- Runtime/environment: `.gitattributes` (reproducible LF text checkouts), `.nvmrc`, `.node-version`, `.npmrc`, `.env.example`, secret/artifact exclusions in `.gitignore`.
- UI: Quicksand via next/font, CSS-variable Tailwind/shadcn integration (`components.json`), Button, ThemeProvider, responsive identity placeholder, light/dark/system controls with mobile touch targets.
- Tests: `vitest.config.mts`, Testing Library setup with typed matchMedia jsdom shim, one foundation smoke test; Playwright config and four placeholder E2E cases.
- Formatting: `.prettierrc.json`, `.prettierignore`, scripts.
- Governance/quick-start: `AGENTS.md`, generated `CLAUDE.md` pointing to AGENTS, developer root `README.md`.
- Documentation: both business READMEs updated; bilingual database/authorization designs, CHANGELOG, and this report added.

## 6. Documentation State

All required documents exist:

- `docs/README-VN.md`: Version 1.1, primary stakeholder-readable baseline.
- `docs/README.md`: Version 1.1, equivalent business rules for engineering agents, plus preserved original approved technical appendix.
- `docs/04-DATABASE-DESIGN-VN.md` and `docs/04-DATABASE-DESIGN.md`: approved V1.1 design.
- `docs/05-AUTHORIZATION-MODEL-VN.md` and `docs/05-AUTHORIZATION-MODEL.md`: approved V1.1 authorization.
- `docs/CHANGELOG.md`: dated 2026-09-18 V1.1 entry with all requested decisions.

Both languages cover roles, HEAD-only administration/passwords, no public registration, ownership/lifecycle, daily reporting/reasons/immutability/uniqueness, soft deletion, banned-based account state, concurrent final-ACTIVE-HEAD protection, audits, mobile-first, Drive assets/preview/validated providers/source-file preservation, UUIDs, and Asia/Ho_Chi_Minh. The ordinary-progress prohibition and separately authorized HEAD correction are explicitly distinguished. Technical SQL identifiers/types/nullability remain canonical across languages. Business DATE and event TIMESTAMPTZ are distinct.

AGENTS mandates bilingual documentation/tests on behavior changes, server-side permissions, approved invariants, creator preservation, source-file preservation, business timezone, and reporting implementation/documentation discrepancies.

## 7. Commands Executed

Relevant setup/verification commands (Windows command variants recorded):

```text
Get-Location
Get-ChildItem -Force
rg --files --hidden docs
Get-Content docs/README.md / docs/README-VN.md
 git rev-parse --show-toplevel
 git branch --show-current
 git rev-parse HEAD
 git status --short
node --version
npm.cmd --version
npm.cmd view next@16.3 version --json
npm.cmd view drizzle-orm dist-tags --json
npm.cmd view drizzle-kit dist-tags --json
npm.cmd view better-auth version
npm.cmd view @better-auth/drizzle-adapter version
npm.cmd view @hookform/resolvers peerDependencies --json
 git init -b main
npx.cmd create-next-app@16.3.5 kig-marketing-crm --typescript --tailwind --eslint --app --src-dir --import-alias @/* --use-npm --yes --disable-git
npm.cmd install --save-exact [runtime foundation; exact versions in section 4]
npm.cmd install --save-dev --save-exact [development foundation; exact versions in section 4]
npx.cmd shadcn@latest init -d --base radix
npx.cmd shadcn@latest add button --yes
npm.cmd ci
npm.cmd ls --depth=0
npm.cmd ls --all
npm.cmd audit --json
npm.cmd exec drizzle-kit -- --version
node [in-memory transformSync check of patched Drizzle Kit TypeScript transformer]
npm.cmd run format
npm.cmd run check
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run start
npx.cmd agent-browser --session kig-phase0 open http://127.0.0.1:3000
npx.cmd agent-browser --session kig-phase0 snapshot -i
npx.cmd agent-browser --session kig-phase0 screenshot [OS temporary screenshots]
npx.cmd agent-browser --session kig-phase0 find role button click --name Light
npx.cmd agent-browser --session kig-phase0 set viewport 390 844
npx.cmd agent-browser --session kig-phase0 eval --stdin
npx.cmd agent-browser --session kig-phase0 errors
npx.cmd agent-browser --session kig-phase0 console
npx.cmd agent-browser --session kig-phase0 close
 git check-ignore .env .env.local .next
 git check-ignore test-results/.last-run.json
 git diff --check
 git add [Phase 0 foundation, docs, report, package-lock.json]
 git commit -m "chore: establish Phase 0 project and documentation baseline"
 git status --short
 git rev-parse HEAD
```

Stable package/current API checks also consulted the official [Next.js security release](https://nextjs.org/blog/august-2026-security-release), [Better Auth adapter documentation](https://better-auth.com/docs/adapters/drizzle), [Better Auth database documentation](https://better-auth.com/docs/concepts/database), and [Drizzle PostgreSQL documentation](https://orm.drizzle.team/docs/get-started-postgresql). No real database was contacted.

## 8. Quality Gate Results

| Check                  | Result | Evidence                                                                                                                                     |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                | PASS   | Node v24.19.0; restricted to major 24                                                                                                        |
| Installation integrity | PASS   | Sequential npm ci succeeded; full npm ls --all exited 0                                                                                      |
| Dependency audit       | PASS   | 0 vulnerabilities after targeted nested esbuild override                                                                                     |
| Formatting             | PASS   | prettier --check .                                                                                                                           |
| Lint                   | PASS   | eslint . --max-warnings=0                                                                                                                    |
| Typecheck              | PASS   | next typegen and tsc --noEmit                                                                                                                |
| Unit tests             | PASS   | Vitest: 1 file, 1 test passed                                                                                                                |
| Production build       | PASS   | Next 16.3.5 Turbopack; static / and /_not-found generated                                                                                    |
| E2E configuration      | PASS   | Playwright discovered 4 tests in 1 file across 2 projects                                                                                    |
| E2E browser execution  | PASS   | 4/4 Chromium tests passed; desktop/mobile × light/dark, no horizontal overflow                                                               |
| Visual browser check   | PASS   | Desktop and 390×844 mobile screenshots inspected; computed font Quicksand; light theme applied; no overflow, page errors or console messages |

`npm run check` exited 0 after final source corrections. Browser execution was performed separately and passed; it was not merely configuration validation. Browser/session and local production verification server were stopped. Screenshots are in OS temporary storage, outside the repository.

## 9. Known Issues

No unresolved quality-gate failures or business implementation.

Warnings and constraints retained transparently:

- ESLint 9.39.5 is deprecated upstream but is the stable peer-compatible version for Next 16.3.5's bundled import/JSX accessibility/React plugins. Attempting ESLint 10.10.0 produced invalid peer constraints; it was reverted and the full tree revalidated. Upgrade when the Next lint stack supports it.
- Stable Drizzle Kit includes deprecated @esbuild-kit/core-utils and esm-loader (merged upstream into tsx). Its vulnerable nested esbuild was narrowly overridden to stable 0.25.12. Audit, Kit version command, and an actual in-memory TypeScript transform all pass. Future Phase 1 must still validate actual schema generation/migration workflows; none were run here.
- npm 11 emits allow-scripts notices for esbuild and unrs-resolver install scripts not covered by its allowScripts policy. Actual CLI, lint, Vitest and build execution passed. No blanket script approval was added.
- Initial staging warned that the host Git autocrlf setting would convert LF to CRLF. A repository .gitattributes rule now keeps text checkouts LF, matching Prettier.
- Playwright's inherited FORCE_COLOR/NO_COLOR environment produced harmless color-precedence warnings; all tests passed.
- next/font/google downloads Quicksand at build time; reproducible builds require access to Google font endpoints. Browser runtime serves the generated font locally.
- Initial npm resolver optional-peer conflict was resolved with stable @hookform/resolvers 5.2.2 and Zod 4.6.5, without force/legacy-peer-deps.
- A first npm ci overlapped a running test and hit a Windows native-file lock. That incomplete installation/test failed; after the process exited, sequential npm ci and all final checks passed.
- jsdom lacks matchMedia; a typed test-only shim supplies the API used by next-themes. A CommonJS config warning was fixed by using vitest.config.mts.
- A first production build failed on a UTF-8 BOM introduced by Windows writes. BOMs were removed; subsequent build and complete check passed.
- Initial browser CLI argument quoting errors were corrected with semantic locators and eval --stdin; final browser checks passed and the incidental shell artifact was removed.

No credentials, auth routes, database schemas/migrations, task/user workflows, Drive API/credentials, dashboard/calendar, audit persistence, or Railway deployment were introduced.

## 10. Git State

- Branch: `main`.
- Final HEAD: `refs/heads/main`, the Phase 0 baseline commit containing this report. Resolve the exact SHA with `git rev-parse HEAD`; the exact SHA is printed in the delivery summary. A commit cannot embed its own SHA in its report without changing that SHA.
- Initial HEAD: absent/unborn.
- Final `git status --short`: empty (clean), verified after the baseline commit.
- package-lock.json is committed along with the foundation and documentation.
- No remote created, no push, no unnecessary feature branch, no nested Git repository.
- Secrets, node_modules, .next, test-results, reports from Playwright, and temporary browser/scaffold artifacts are excluded from the commit.

## 11. Phase 1 Readiness

Safe to proceed to **Phase 1 — Database Foundation & Better Auth Schema**, subject to the documented future CLI-generation validation and supplying private development environment values then. The required approved designs/governance, stable dependencies, transactional driver and working local checks are available.

Phase 1 has not started. No database schema/migration/connection exists in Phase 0.
