import { relations } from "drizzle-orm";
import { user } from "./auth";
import { task } from "./tasks";
import { taskDailyUpdate } from "./task-daily-updates";
import { taskAsset } from "./task-assets";
import { notification } from "./notifications";
import { auditLog } from "./audit-logs";

// Adds distinct application relations; generated auth session/account relations remain intact.
export const userApplicationRelations = relations(user, ({ many }) => ({
  createdTasks: many(task, { relationName: "taskCreator" }),
  assignedTasks: many(task, { relationName: "taskAssignee" }),
  deletedTasks: many(task, { relationName: "taskDeleter" }),
  dailyUpdates: many(taskDailyUpdate, { relationName: "progressReporter" }),
  correctedUpdates: many(taskDailyUpdate, {
    relationName: "progressCorrector",
  }),
  createdAssets: many(taskAsset, { relationName: "assetCreator" }),
  deletedAssets: many(taskAsset, { relationName: "assetDeleter" }),
  notifications: many(notification, { relationName: "notificationRecipient" }),
  auditLogs: many(auditLog, { relationName: "auditActor" }),
}));
export const taskRelations = relations(task, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [task.createdById],
    references: [user.id],
    relationName: "taskCreator",
  }),
  assignedTo: one(user, {
    fields: [task.assignedToId],
    references: [user.id],
    relationName: "taskAssignee",
  }),
  deletedBy: one(user, {
    fields: [task.deletedById],
    references: [user.id],
    relationName: "taskDeleter",
  }),
  dailyUpdates: many(taskDailyUpdate),
  assets: many(taskAsset),
}));
export const taskDailyUpdateRelations = relations(
  taskDailyUpdate,
  ({ one }) => ({
    task: one(task, {
      fields: [taskDailyUpdate.taskId],
      references: [task.id],
    }),
    user: one(user, {
      fields: [taskDailyUpdate.userId],
      references: [user.id],
      relationName: "progressReporter",
    }),
    correctedBy: one(user, {
      fields: [taskDailyUpdate.correctedById],
      references: [user.id],
      relationName: "progressCorrector",
    }),
  }),
);
export const taskAssetRelations = relations(taskAsset, ({ one }) => ({
  task: one(task, { fields: [taskAsset.taskId], references: [task.id] }),
  createdBy: one(user, {
    fields: [taskAsset.createdById],
    references: [user.id],
    relationName: "assetCreator",
  }),
  deletedBy: one(user, {
    fields: [taskAsset.deletedById],
    references: [user.id],
    relationName: "assetDeleter",
  }),
}));
export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
    relationName: "notificationRecipient",
  }),
}));
export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, {
    fields: [auditLog.actorUserId],
    references: [user.id],
    relationName: "auditActor",
  }),
}));
