# Changelog

## 2026-09-18 — Business Baseline V1.1

- V1.0 baseline established and retained.
- Google Drive Task Assets / Deliverables added, with validated provider URLs, graceful preview failure, and CRM-only soft removal; source files are never deleted.
- Database Schema V1.1 approved.
- Authorization Model V1.1 approved.
- Node 24 LTS runtime decision (`>=24 <25`).
- Next.js full-stack monolith architecture decision.
- PostgreSQL / Neon + stable Drizzle decision; transactional Postgres.js driver.
- Railway production target.
- Bilingual business baseline reconciled at Version 1.1; original approved technical detail retained in the English baseline and technical documents.
- Phase 0 scaffolding only. No application migration or production deployment.

Ordinary progress remains immutable; HEAD-only audited administrative correction is a separate operation, not ordinary submission on behalf of another assignee.

## 2026-09-18 - Phase 1 technical foundation (V1.1)

- Transactional PostgreSQL/Postgres.js database foundation implemented.
- Better Auth 1.7.5 schema generated from shared configuration, with reviewed deterministic persistence normalization.
- Five application V1.1 tables, six enums, restrictive FKs, checks and indexes implemented.
- Initial Drizzle migration generated and reviewed; repeat generation reports no changes.
- Initial migration verified against explicitly authorized development Neon PostgreSQL; live catalogs and real PostgreSQL constraint tests passed with fixtures rolled back. Auth regeneration remains deterministic and Drizzle reports no schema drift. No production mutation.
- Closure corrected Drizzle CLI resolution, development environment loading before Vitest, and exact PostgreSQL RESTRICT error assertions; schema and migration SQL remained unchanged.
