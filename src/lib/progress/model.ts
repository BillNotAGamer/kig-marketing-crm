import { z } from "zod";
import type { Actor } from "../auth/session-core";
import { AccessError } from "../auth/permissions";
import type { TaskDailyUpdate } from "../../db/schema/task-daily-updates";

const reason = z.string().trim().min(1).max(5000);
export const submitProgressSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("COMPLETED") }).strict(),
  z.object({ status: z.literal("NOT_COMPLETED"), reason }).strict(),
]);
export const correctionSchema = z.discriminatedUnion("status", [
  z
    .object({ status: z.literal("COMPLETED"), correctionReason: reason })
    .strict(),
  z
    .object({
      status: z.literal("NOT_COMPLETED"),
      reason,
      correctionReason: reason,
    })
    .strict(),
]);
export const progressGrants = {
  HEAD: ["progress:create-own", "progress:correct"],
  DEPUTY: ["progress:create-own"],
  EMPLOYEE: ["progress:create-own"],
} as const;
export function canSubmitProgress(
  actor: Actor,
  task: { assignedToId: string; status: string; deletedAt: Date | null },
) {
  return (
    task.deletedAt === null &&
    task.status === "OPEN" &&
    task.assignedToId === actor.id
  );
}
export function requireCorrection(
  latest: { id: string; status: string },
  id: string,
  status: string,
) {
  if (latest.id !== id)
    throw new AccessError(409, "Only the latest report can be corrected.");
  if (latest.status === status)
    throw new AccessError(409, "Correction must change the report status.");
}
export type ProgressDTO = {
  id: string;
  reportDate: string;
  status: "COMPLETED" | "NOT_COMPLETED";
  reason: string | null;
  createdAt: string;
  isCorrected: boolean;
  correctedAt: string | null;
  correctionReason: string | null;
};
export function progressDTO(row: TaskDailyUpdate): ProgressDTO {
  return {
    id: row.id,
    reportDate: row.reportDate,
    status: row.status,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    isCorrected: row.correctedAt !== null,
    correctedAt: row.correctedAt?.toISOString() ?? null,
    correctionReason: row.correctionReason,
  };
}
export function todayProgress(history: ProgressDTO[], reportDate: string) {
  const report = history.find((row) => row.reportDate === reportDate) ?? null;
  return {
    reportDate,
    status: report?.status ?? ("NOT_REPORTED" as const),
    report,
  };
}
export type ProgressView = {
  history: ProgressDTO[];
  today: ReturnType<typeof todayProgress>;
  canSubmit: boolean;
  canCorrect: boolean;
};
