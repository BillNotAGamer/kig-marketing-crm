# Production Readiness — Version 1.1

## Runtime and target

Use Node 24, npm with the committed lockfile, Railway's Node service runtime, and Neon PostgreSQL. Build with `npm ci && npm run build`, start with `npm start`; Railway supplies `PORT`. Configure `/api/health` as the readiness path. Production requires HTTPS.

## Environment contract

Required server-only values: `DATABASE_URL`, a unique random `BETTER_AUTH_SECRET` of at least 32 characters, HTTPS `BETTER_AUTH_URL`, and explicit `KIG_DATABASE_ENV=production`. Never use placeholders. Drive uses `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY`, and, for the KIG My Drive model, `GOOGLE_DRIVE_ALLOWED_FOLDER_ID`. `GOOGLE_DRIVE_SHARED_DRIVE_ID` is optional and represents a Shared Drive only. Never prefix these with `NEXT_PUBLIC_`.

The human owner creates a dedicated **KIG Marketing CRM** folder in My Drive and grants the service account Viewer access. The application retains `drive.metadata.readonly`; it performs no Drive writes. Allowed-folder ancestry is checked with bounded, cycle-safe metadata traversal. Phase 9 must verify the production folder ID.

## Database and migrations

`npm run db:bootstrap` is development-only and refuses a nonempty database. `npm run db:migrate` applies only committed unapplied migrations and is also development-guarded in Phase 8. Production migration execution in Phase 9 requires an authorized operator, verified target, Neon backup/PITR confirmation, migration review, and a forward-fix/rollback decision. Never run integration tests, fixtures, bootstrap, Studio, or destructive commands against production.

## Deployment checklist

Before deploy: review all environment values privately; confirm Neon backup/PITR and recovery owner; rotate exposed credentials; run every quality gate; confirm zero drift and clean Git; verify service account Viewer access and allowed folder. After deploy: check `/api/health`, root/login/protected redirects, auth, role isolation, Drive metadata access, CSP/headers, logs, and mobile layout. Roll back the application release on failure; do not erase or restore the database without an approved recovery plan.

Credential rotation: replace Better Auth secret only with a planned session invalidation; rotate the service-account key in Google Cloud, update the secret store, restart, verify, then revoke the old key. If a key is exposed, revoke it immediately, inspect access logs, rotate dependent secrets, and document the incident. Never commit credentials.

An isolated restore drill may be completed in Phase 9; it must never target the shared development or production database.
