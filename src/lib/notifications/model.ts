import { z } from "zod";

export const notificationsPaginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type NotificationsPaginationParams = z.infer<
  typeof notificationsPaginationSchema
>;

export interface NotificationItemDto {
  id: string;
  type: "TASK_ASSIGNED" | "TASK_UPDATED" | "TASK_REASSIGNED" | "TASK_CANCELLED";
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsListDto {
  items: NotificationItemDto[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
