import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auditLog, user } from "../../db/schema";
import {
  createAuth,
  type AuthDatabase,
  type Transaction,
} from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import type { ServerEnv } from "../env-schema";
import {
  auditLogQuerySchema,
  sanitizeAuditData,
  type AuditLogItemDto,
  type AuditLogListDto,
} from "./model";

const actorUser = alias(user, "audit_actor_user");

export class ForbiddenAuditError extends Error {
  constructor() {
    super("Chỉ Quản trị viên (HEAD) mới có quyền xem nhật ký hệ thống.");
    this.name = "ForbiddenAuditError";
  }
}

export function auditService(db: AuthDatabase, env: ServerEnv) {
  async function execute<T>(
    headers: Headers,
    work: (tx: Transaction, actor: Actor) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(24091802)`);
      const auth = createAuth(tx, env);
      const actor = await authorizedActor(tx, auth, headers);
      return work(tx, actor);
    });
  }

  async function listAuditLogs(
    headers: Headers,
    rawQuery: unknown,
  ): Promise<AuditLogListDto> {
    const query = auditLogQuerySchema.parse(rawQuery);

    return execute(headers, async (tx, actor) => {
      // HEAD-only security gate
      if (actor.role !== "HEAD") {
        throw new ForbiddenAuditError();
      }

      const conditions = [];

      if (query.action) {
        conditions.push(eq(auditLog.action, query.action));
      }
      if (query.entityType) {
        conditions.push(eq(auditLog.entityType, query.entityType));
      }
      if (query.actorUserId) {
        conditions.push(eq(auditLog.actorUserId, query.actorUserId));
      }
      if (query.from) {
        conditions.push(
          gte(auditLog.createdAt, new Date(`${query.from}T00:00:00.000Z`)),
        );
      }
      if (query.to) {
        conditions.push(
          lte(auditLog.createdAt, new Date(`${query.to}T23:59:59.999Z`)),
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Count
      const [countResult] = await tx
        .select({ count: count() })
        .from(auditLog)
        .where(whereClause);

      const total = Number(countResult?.count || 0);
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const offset = (query.page - 1) * query.pageSize;

      // Query rows
      const rows = await tx
        .select({
          id: auditLog.id,
          actorUserId: auditLog.actorUserId,
          actorName: actorUser.name,
          action: auditLog.action,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          beforeData: auditLog.beforeData,
          afterData: auditLog.afterData,
          metadata: auditLog.metadata,
          createdAt: auditLog.createdAt,
          ipAddress: auditLog.ipAddress,
          userAgent: auditLog.userAgent,
        })
        .from(auditLog)
        .leftJoin(actorUser, eq(auditLog.actorUserId, actorUser.id))
        .where(whereClause)
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(query.pageSize)
        .offset(offset);

      const items: AuditLogItemDto[] = rows.map((r) => ({
        id: r.id,
        actorUserId: r.actorUserId,
        actorName: r.actorName || (r.actorUserId ? "Hệ thống" : "Hệ thống"),
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        beforeData: sanitizeAuditData(r.beforeData),
        afterData: sanitizeAuditData(r.afterData),
        metadata: sanitizeAuditData(r.metadata),
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
      }));

      return {
        items,
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages,
      };
    });
  }

  return {
    listAuditLogs,
  };
}
