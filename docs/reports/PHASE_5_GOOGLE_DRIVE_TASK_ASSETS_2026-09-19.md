# Phase 5 — Google Drive Task Assets

Date: 2026-09-19. Business baseline Version 1.1.

## 1. Verdict

PASS

All CRM application services, security boundaries, canonical Google Drive URL parsing, deterministic MIME classification, transactional database boundaries (`task_asset` and `ADD_TASK_ASSET`/`REMOVE_TASK_ASSET` audits), real PostgreSQL integration tests (all 28 tests passing), desktop/mobile Chromium E2E acceptance suites (all 20 tests passing), visual verifications (light/dark, desktop/mobile), schema stability (no migrations/drift), catalog verifications, and documentation synchronization gates passed. Furthermore, Live Google Drive Verification has PASSED using the real `GoogleDriveApiClient` with Service Account JWT authentication and minimum `drive.metadata.readonly` scope against an authorized test file inside the shared My Drive folder. Phase 5 is ready for final clean closure.

---

## 2. Workspace

- Authoritative workspace/Git root: `F:\Coding\Web development\KIG Marketing CRM`.
- Branch `main`.
- Starting SHA: `3ddbf76f197ed4057370ee0d53029c991e31d1a3` (Phase 4 closure commit), resolved directly via `git rev-parse HEAD`.
- Ending SHA: Phase 5 closure commit recorded upon completion.
- Node version: `v24.19.0` (Node 24 LTS, `>=24 <25`).
- npm version: `11.17.0`.
- Working tree: clean at inception, no files reset, restored, cleaned, or stashed.

---

## 3. Google Integration Architecture

- Server-side authentication: Uses Google Service Account JWT credentials via `google-auth-library@11.1.0`. No per-user Google OAuth, user refresh tokens, Google login, or Google Picker.
- Approved minimum scope: `https://www.googleapis.com/auth/drive.metadata.readonly`. No write or full read scopes (`drive`, `drive.readonly`) are requested or used.
- API boundary: Encapsulated in `src/lib/drive/types.ts` (`DriveClient` interface) and `src/lib/drive/client.ts` (`GoogleDriveApiClient` and test/development `MockDriveClient`).
- Read-only constraint: CRM never executes `files.create`, `files.update`, `files.delete`, `permissions.create`, `permissions.update`, or `permissions.delete`.
- Shared Drive compatibility: All Drive metadata queries pass `supportsAllDrives=true`. When `GOOGLE_DRIVE_SHARED_DRIVE_ID` is set, attached files must belong to the specified Shared Drive; files outside it are rejected.

---

## 4. URL Validation

Implemented canonically in `src/lib/drive/url.ts`:

- Exact host allowlisting: Accepts only `drive.google.com` and `docs.google.com`. Subdomain tricks, attacker domains, data URLs, and javascript schemes are rejected.
- Supported URL patterns:
  - `https://drive.google.com/file/d/{FILE_ID}/view`
  - `https://drive.google.com/open?id={FILE_ID}`
  - `https://docs.google.com/document/d/{FILE_ID}/...`
  - `https://docs.google.com/spreadsheets/d/{FILE_ID}/...`
  - `https://docs.google.com/presentation/d/{FILE_ID}/...`
- Resource keys: Supported via `resourcekey` query parameter and preserved for secure preview/open links.
- Rejections: Folder URLs (`/drive/folders/...`, `/embeddedfolderview`), non-Google hosts, malformed URLs, empty file IDs, and trashed files are rejected with controlled 400 Bad Request.

---

## 5. Metadata & MIME Classification

- Field mask: Requests only required fields from Google Drive: `id, name, mimeType, webViewLink, resourceKey, driveId, trashed`.
- Canonical source URL: The trusted `webViewLink` returned by Google Drive is persisted as `sourceUrl`. If absent, a canonical URL is constructed from the validated file ID (`https://drive.google.com/file/d/{id}/view`). Arbitrary client URLs are never stored.
- Deterministic MIME classification in `src/lib/drive/types.ts`:
  - `image/*` → `IMAGE`
  - `video/*` → `VIDEO`
  - `application/pdf` → `PDF`
  - `application/vnd.google-apps.document`, DOC/DOCX, RTF, text/plain → `DOCUMENT`
  - `application/vnd.google-apps.spreadsheet`, XLS/XLSX, CSV → `SPREADSHEET`
  - `application/vnd.google-apps.presentation`, PPT/PPTX → `PRESENTATION`
  - All other MIME types → `OTHER`

---

## 6. Task Asset Authorization

Enforced server-side in `src/lib/assets/model.ts` and `src/lib/assets/service.ts`:

- HEAD:
  - Attach: May attach supported Drive assets to any non-deleted task (`OPEN`, `COMPLETED`, `CANCELLED`).
  - Remove: May soft-remove any active asset on any non-deleted task.
  - Read: Reads active assets on all non-deleted team tasks.
- DEPUTY:
  - Attach: May attach supported Drive assets only to own assigned, `OPEN`, non-deleted tasks (`task.assignedToId === actor.id && task.status === "OPEN"`).
  - Remove: May soft-remove only own created assets (`asset.createdById === actor.id`) on own assigned, `OPEN`, non-deleted tasks.
  - Read: Reads active assets on all non-deleted team tasks.
- EMPLOYEE:
  - Attach: May attach supported Drive assets only to own assigned, `OPEN`, non-deleted tasks (`task.assignedToId === actor.id && task.status === "OPEN"`). Cannot attach to foreign tasks or COMPLETED/CANCELLED tasks.
  - Remove: May soft-remove only own created assets (`asset.createdById === actor.id`) on own assigned, `OPEN`, non-deleted tasks. Cannot remove assets attached by HEAD.
  - Read: Reads active assets only for tasks currently assigned to the employee. Foreign task queries return 404 (or 403).

---

## 7. Asset Creation: External Read & DB Transaction Boundary

- Flow:
  1. Derive authenticated canonical actor from server session.
  2. Validate Google Drive URL and extract file ID.
  3. Query Google Drive API for file metadata outside any database transaction (no locks or DB connections held during network requests).
  4. Classify MIME type to `TaskAssetType`.
  5. Begin PostgreSQL transaction.
  6. Acquire exclusive account-coordination advisory transaction lock `24091802`.
  7. Re-read canonical actor and lock Task row `FOR UPDATE`.
  8. Revalidate actor authorization and task lifecycle state.
  9. Verify absence of active duplicate file on this task (`(taskId, provider, providerFileId) WHERE deletedAt IS NULL`).
  10. Insert record into `task_asset`.
  11. Insert `ADD_TASK_ASSET` audit row.
  12. Commit transaction.
- If external API fails, database is untouched. If DB insertion or audit fails, transaction rolls back cleanly.

---

## 8. Asset Removal: Soft Deletion & Zero Drive Mutations

- Explicit command: `removeTaskAsset(taskId, assetId)`.
- Transactionally sets:
  - `task_asset.deleted_at = now()`
  - `task_asset.deleted_by_id = actor.id`
- Appends `REMOVE_TASK_ASSET` audit row in the same transaction.
- Invariant: No `DELETE FROM task_asset` SQL is ever executed during normal operations.
- Invariant: CRM never calls Google Drive deletion or trash APIs. The Google Drive file remains untouched.
- Soft-deleted assets are hidden from operational reads.
- Re-attaching a previously soft-deleted asset is permitted.

---

## 9. Preview Model & Security Boundary

- Safe URL construction: Preview URLs are built exclusively using trusted Google origins based on validated `providerFileId` and `assetType`:
  - `DOCUMENT` → `https://docs.google.com/document/d/{id}/preview`
  - `SPREADSHEET` → `https://docs.google.com/spreadsheets/d/{id}/preview`
  - `PRESENTATION` → `https://docs.google.com/presentation/d/{id}/preview`
  - `IMAGE`, `VIDEO`, `PDF`, `OTHER` → `https://drive.google.com/file/d/{id}/preview`
- CSP headers updated in `next.config.ts`:
  `frame-src 'self' https://drive.google.com https://docs.google.com;`
- Independence: CRM task access does not grant Google Drive file access. If a user's Google session lacks access to the Drive file, the preview iframe displays Google's native access state; the CRM UI always provides a fallback link: `Mở trên Google Drive ↗`. Preview failures never crash Task Detail.

---

## 10. Audit Logging

- `ADD_TASK_ASSET`: Atomic with `task_asset` insertion. Payload contains `taskId`, `assetId`, `provider`, `providerFileId`, `fileName`, `assetType`, and `createdById`.
- `REMOVE_TASK_ASSET`: Atomic with soft-removal update. Payload contains `taskId`, `assetId`, `provider`, `providerFileId`, `fileName`, `assetType`, `createdById`, and `deletedById`.
- Payloads are strictly sanitized: No Google API keys, private keys, service account emails, or OAuth tokens are ever logged.

---

## 11. Security Boundary Verification

- Arbitrary iframe injection: Blocked. Only trusted Google domains can be framed; user input is strictly parsed.
- Metadata spoofing: Blocked. Client cannot provide `providerFileId`, `fileName`, `mimeType`, or `assetType`. All metadata is derived server-side.
- Cross-origin mutations: Blocked by exact configured Origin verification.
- Credentials: Service account credentials remain strictly server-side and are never exposed to browser clients or API DTOs.
- Safe DTOs: `TaskAssetDTO` exposes only clean business fields and safe URLs.

---

## 12. Google Live Verification

- State: **PASS**
- Deployment Model: Dedicated "KIG Marketing CRM" folder inside a human user's My Drive, shared directly to the configured Google Service Account as Viewer.
- Configuration:
  - `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`: Configured and active.
  - `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY`: Configured and normalized via `normalizePrivateKey()`.
  - `GOOGLE_DRIVE_SHARED_DRIVE_ID`: Intentionally absent (optional; used when deploying to Google Shared Drives).
- Verification Execution & Sanitized Evidence:
  - Real `GoogleDriveApiClient` instantiated (not `MockDriveClient`).
  - Service Account JWT authentication succeeded against Google OAuth2 token endpoint using approved minimum scope `https://www.googleapis.com/auth/drive.metadata.readonly`.
  - Canonical URL parsing on test document inside the shared folder succeeded (`kind: document`).
  - Google Drive API v3 `files.get` succeeded with `supportsAllDrives=true`:
    - `id`: Returned and matches parsed file ID.
    - `name`: Non-empty document title string returned.
    - `mimeType`: `application/vnd.google-apps.document`.
    - `webViewLink`: Valid canonical Google Docs web view link returned.
    - `trashed`: `false`.
    - `driveId`: Absent (confirmed expected and valid behavior for My Drive files).
  - Deterministic MIME classification mapped document to `DOCUMENT`.
  - Safe preview and open URLs generated strictly targeting trusted Google origins (`https://docs.google.com/document/d/...`).
  - Read-only constraint verified: `GoogleDriveApiClient` contains only `getFileMetadata`; zero create, update, delete, or permission mutation methods exist. Scope `drive.metadata.readonly` independently prevents write mutations at Google's server boundary.
  - Production fail-closed behavior verified: In non-development environments with missing or invalid credentials, `createGoogleDriveClient` returns `GoogleDriveApiClient` and throws controlled 503 (`Google Drive integration is not configured with service account credentials`), never silently falling back to `MockDriveClient`.

---

## 13. PostgreSQL Integration Tests

All 7 Phase 5 tests in `src/db/assets.integration.ts` passed:

1. HEAD attaches asset to team task; duplicate active attachment rejected with 409 Conflict.
2. Employee attaches asset to own OPEN task; Employee cannot attach to another employee's task.
3. Employee cannot attach asset to CANCELLED task; HEAD administrative attach succeeds.
4. Active duplicate attachment rejected; soft-deleted asset can be reattached.
5. Soft removal by authorized creator/assignee; assignee cannot remove asset created by HEAD.
6. External Drive failure / trashed file / folder rejected cleanly without touching database.
7. Audit failure rolls back asset insertion; database remains clean.

Total database suite: 28 tests across 6 files (`assets`, `progress`, `tasks`, `auth`, `users`, `constraints`) all passed in 334s. Lingering fixture rows across all 9 tables: 0.

---

## 14. E2E & Visual Verification

- Playwright tests in `e2e/assets.spec.ts`: 4 passed (desktop-chromium and mobile-chromium).
- Tested flows:
  - HEAD attaches Drive asset, views Deliverables card, opens preview dialog, verifies "Mở trên Google Drive ↗" fallback link, switches light/dark theme, and confirms soft removal.
  - Employee attaches deliverable to own OPEN task, duplicate rejected with 409 alert, foreign task access denied (404), CANCELLED task blocks attachment.
- Visual inspection:
  - Deliverable card layout: responsive, crisp typography, badge for asset type (`DOCUMENT`, `IMAGE`, etc.).
  - Mobile viewport (~390px Pixel 7): zero horizontal overflow, clean button wrapping, properly centered preview dialog with close button.
  - Themes: verified in both Light and Dark modes.

---

## 15. Schema Stability

- Initial applied migration `drizzle/0000_initial_v1_1.sql` unchanged.
- `drizzle-kit generate` reports: `No schema changes, nothing to migrate`.
- No database drift. Existing `task_asset` table was used exactly as designed in V1.1.

---

## 16. Documentation Synchronization

- English: Updated `docs/04-DATABASE-DESIGN.md`, `docs/05-AUTHORIZATION-MODEL.md`, `docs/CHANGELOG.md`, `README.md`.
- Vietnamese: Updated `docs/04-DATABASE-DESIGN-VN.md`, `docs/05-AUTHORIZATION-MODEL-VN.md`.
- Business rules: Baseline remains V1.1; no business rule discrepancies introduced.

---

## 17. Quality Gates Summary

| Gate                     |  Result  | Command / Details                                                |
| :----------------------- | :------: | :--------------------------------------------------------------- |
| Format Check             | **PASS** | `npm run format:check`                                           |
| ESLint                   | **PASS** | `npm run lint` (`--max-warnings=0`)                              |
| TypeScript Typecheck     | **PASS** | `npm run typecheck` (`next typegen && tsc --noEmit`)             |
| Vitest Unit & Security   | **PASS** | `npm run test` (32 tests in `url.test.ts` & `security.test.ts`)  |
| PostgreSQL Integration   | **PASS** | `src/db/assets.integration.ts` + 5 other suites (28 tests total) |
| Next.js Production Build | **PASS** | `npm run build` (Turbopack, static & dynamic routes compiled)    |
| Playwright E2E           | **PASS** | `npm run test:e2e` (desktop & mobile Chromium)                   |
| Visual Verification      | **PASS** | Light/dark themes, desktop/mobile viewport screenshots inspected |
| Better Auth Schema Check | **PASS** | `npm run auth:schema:check`                                      |
| Drizzle Schema Check     | **PASS** | `drizzle-kit check`                                              |
| Database Migration Check | **PASS** | `drizzle-kit generate` (no schema changes)                       |
| Fixture Cleanup          | **PASS** | 0 lingering rows across all 9 tables                             |
| Live Google Verification | **PASS** | Service Account JWT auth, files.get, My Drive folder test file   |
| Git Diff Check           | **PASS** | `git diff --check`                                               |

---

## 18. Known Issues & Operational Considerations

1. Google Drive ACL Independence: Inline preview requires the end-user's browser to be logged into a Google account with access to the file. The CRM cannot grant Google permissions; the "Mở trên Google Drive ↗" fallback link is always provided.
2. Production Service Account: To activate live Google Drive API metadata retrieval in production, set `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY` in deployment environment variables.

---

## 19. Git State

- Starting SHA: `3ddbf76f197ed4057370ee0d53029c991e31d1a3`
- Ending SHA: Recorded at commit.
- Working tree: clean.

---

## 20. Phase 6 Readiness

PASS — Phase 5 Google Drive Task Assets integration is fully implemented, verified live against Google Drive API v3, tested across all quality gates, and closed cleanly. The codebase is ready to proceed to:
`Phase 6 — Calendar & Mobile Task Experience`
(Phase 6 has NOT been started).
