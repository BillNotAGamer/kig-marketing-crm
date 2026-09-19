import { z } from "zod";
import { businessDateSchema } from "../tasks/validation";

export const auditLogQuerySchema = z
  .object({
    action: z.string().trim().max(100).optional(),
    entityType: z.string().trim().max(50).optional(),
    actorUserId: z.string().uuid().optional(),
    from: businessDateSchema.optional(),
    to: businessDateSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export type AuditLogQueryParams = z.infer<typeof auditLogQuerySchema>;

export interface AuditLogItemDto {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditLogListDto {
  items: AuditLogItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SENSITIVE_KEY_PATTERN =
  /password|hash|token|secret|key|credential|cookie/i;

/**
 * Sanitizes arbitrary JSON payload from audit records, stripping any
 * sensitive or credential fields before exposure to the client.
 */
export function sanitizeAuditData(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = "[REDACTED]";
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeAuditData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}
