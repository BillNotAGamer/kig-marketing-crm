import { sql } from "drizzle-orm";

export const ADMINISTRATION_ADVISORY_LOCK_ID = 24091802;
export const administrationLock = sql`SELECT pg_advisory_xact_lock(24091802)`;
