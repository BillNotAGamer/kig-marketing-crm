import { pgEnum } from "drizzle-orm/pg-core";

export const taskStatus = pgEnum("task_status", [
  "OPEN",
  "COMPLETED",
  "CANCELLED",
]);
export const taskPriority = pgEnum("task_priority", [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);
export const taskProgressStatus = pgEnum("task_progress_status", [
  "COMPLETED",
  "NOT_COMPLETED",
]);
export const taskAssetProvider = pgEnum("task_asset_provider", [
  "GOOGLE_DRIVE",
]);
export const taskAssetType = pgEnum("task_asset_type", [
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "SPREADSHEET",
  "PRESENTATION",
  "PDF",
  "OTHER",
]);
export const notificationType = pgEnum("notification_type", [
  "TASK_ASSIGNED",
  "TASK_UPDATED",
  "TASK_REASSIGNED",
  "TASK_CANCELLED",
]);
