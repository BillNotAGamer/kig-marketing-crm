import { z } from "zod";
import { priorities } from "./types";

// DATE is a local calendar value, never an event instant or a UTC conversion.
export const businessDateSchema = z.iso
  .date()
  .refine(
    (value) => !value.startsWith("0000-"),
    "PostgreSQL DATE has no year zero.",
  );
export const taskIdSchema = z.uuid();
const metadataShape = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).nullable(),
  assignedDate: businessDateSchema,
  dueDate: businessDateSchema.nullable(),
  priority: z.enum(priorities),
};
function orderedDates(value: { assignedDate: string; dueDate: string | null }) {
  return value.dueDate === null || value.dueDate >= value.assignedDate;
}
export const taskMetadataSchema = z
  .object(metadataShape)
  .strict()
  .refine(orderedDates, {
    message: "Due date must be on or after assigned date.",
    path: ["dueDate"],
  });
export const createTaskSchema = z
  .object({
    ...metadataShape,
    description: metadataShape.description.default(null),
    dueDate: metadataShape.dueDate.default(null),
    priority: z.enum(priorities).default("NORMAL"),
    assignedToId: z.uuid(),
  })
  .strict()
  .refine(orderedDates, {
    message: "Due date must be on or after assigned date.",
    path: ["dueDate"],
  });
export const reassignTaskSchema = z.object({ assignedToId: z.uuid() }).strict();
export const emptyTaskCommandSchema = z.object({}).strict();

export function currentBusinessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
