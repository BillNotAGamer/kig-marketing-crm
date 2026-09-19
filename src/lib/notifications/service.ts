import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { notification } from "../../db/schema";
import {
  createAuth,
  type AuthDatabase,
  type Transaction,
} from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import type { ServerEnv } from "../env-schema";
import {
  notificationsPaginationSchema,
  type NotificationItemDto,
  type NotificationsListDto,
} from "./model";

export function notificationsService(db: AuthDatabase, env: ServerEnv) {
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

  async function getUnreadCount(headers: Headers): Promise<number> {
    return execute(headers, async (tx, actor) => {
      const [res] = await tx
        .select({ count: count() })
        .from(notification)
        .where(
          and(eq(notification.userId, actor.id), isNull(notification.readAt)),
        );
      return Number(res?.count || 0);
    });
  }

  async function listNotifications(
    headers: Headers,
    rawPagination: unknown,
  ): Promise<NotificationsListDto> {
    const pagination = notificationsPaginationSchema.parse(rawPagination);

    return execute(headers, async (tx, actor) => {
      // 1. Unread count
      const [unreadRes] = await tx
        .select({ count: count() })
        .from(notification)
        .where(
          and(eq(notification.userId, actor.id), isNull(notification.readAt)),
        );
      const unreadCount = Number(unreadRes?.count || 0);

      // 2. Total count
      const [totalRes] = await tx
        .select({ count: count() })
        .from(notification)
        .where(eq(notification.userId, actor.id));
      const total = Number(totalRes?.count || 0);
      const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
      const offset = (pagination.page - 1) * pagination.pageSize;

      // 3. Paginated items
      const rows = await tx
        .select({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          entityType: notification.entityType,
          entityId: notification.entityId,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
        })
        .from(notification)
        .where(eq(notification.userId, actor.id))
        .orderBy(desc(notification.createdAt), desc(notification.id))
        .limit(pagination.pageSize)
        .offset(offset);

      const items: NotificationItemDto[] = rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        entityType: r.entityType,
        entityId: r.entityId,
        readAt:
          r.readAt instanceof Date
            ? r.readAt.toISOString()
            : r.readAt
              ? String(r.readAt)
              : null,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      }));

      return {
        items,
        unreadCount,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages,
      };
    });
  }

  async function markNotificationRead(
    headers: Headers,
    notificationId: string,
  ): Promise<boolean> {
    return execute(headers, async (tx, actor) => {
      const updated = await tx
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notification.id, notificationId),
            eq(notification.userId, actor.id),
            isNull(notification.readAt),
          ),
        )
        .returning({ id: notification.id });
      return updated.length > 0;
    });
  }

  async function markAllNotificationsRead(headers: Headers): Promise<number> {
    return execute(headers, async (tx, actor) => {
      const updated = await tx
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(eq(notification.userId, actor.id), isNull(notification.readAt)),
        )
        .returning({ id: notification.id });
      return updated.length;
    });
  }

  return {
    getUnreadCount,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  };
}
