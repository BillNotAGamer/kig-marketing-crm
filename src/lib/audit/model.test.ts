import { describe, expect, it } from "vitest";
import { auditLogQuerySchema, sanitizeAuditData } from "./model";

describe("Audit Model & Sanitization", () => {
  it("sanitizes sensitive keys recursively", () => {
    const raw = {
      title: "Task 1",
      userPassword: "supersecretpassword",
      password_hash: "argon2id$...",
      sessionToken: "abc123token",
      nested: {
        safeField: 123,
        apiKey: "private_api_key",
        credentialInfo: "private_info",
      },
    };

    const sanitized = sanitizeAuditData(raw);
    expect(sanitized).toEqual({
      title: "Task 1",
      userPassword: "[REDACTED]",
      password_hash: "[REDACTED]",
      sessionToken: "[REDACTED]",
      nested: {
        safeField: 123,
        apiKey: "[REDACTED]",
        credentialInfo: "[REDACTED]",
      },
    });
  });

  it("validates audit query parameters", () => {
    const valid = auditLogQuerySchema.safeParse({
      action: "CREATE_TASK",
      entityType: "task",
      page: "1",
      pageSize: "25",
    });
    expect(valid.success).toBe(true);

    const overMaxPageSize = auditLogQuerySchema.safeParse({
      pageSize: "51",
    });
    expect(overMaxPageSize.success).toBe(false);
  });
});
