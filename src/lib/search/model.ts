import { z } from "zod";
import { businessDateSchema } from "../tasks/validation";

export const taskSearchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(100, "Từ khóa tìm kiếm tối đa 100 ký tự.")
      .optional()
      .refine(
        (val) => !val || val.length >= 2,
        "Từ khóa tìm kiếm phải có ít nhất 2 ký tự.",
      ),
    status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    assigneeId: z.string().uuid().optional(),
    fromAssigned: businessDateSchema.optional(),
    toAssigned: businessDateSchema.optional(),
    fromDue: businessDateSchema.optional(),
    toDue: businessDateSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type TaskSearchQueryParams = z.infer<typeof taskSearchQuerySchema>;

export interface SearchTaskResultItem {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedDate: string;
  dueDate: string | null;
  assignedToId: string;
  assignedToName: string;
  isOverdue: boolean;
  updatedAt: string;
}

export interface TaskSearchResultDto {
  items: SearchTaskResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: TaskSearchQueryParams;
}

/**
 * Escapes special SQL LIKE / ILIKE characters (`%`, `_`, and `\`)
 * so the input string is treated as an exact literal substring match.
 */
export function escapeSqlLikePattern(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
