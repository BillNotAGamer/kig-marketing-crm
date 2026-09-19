import { describe, expect, it } from "vitest";
import { escapeSqlLikePattern, taskSearchQuerySchema } from "./model";

describe("Search Model & Validation", () => {
  it("validates valid search queries", () => {
    const valid = taskSearchQuerySchema.safeParse({
      q: "báo cáo",
      status: "OPEN",
      priority: "HIGH",
      page: "1",
      pageSize: "20",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.q).toBe("báo cáo");
      expect(valid.data.page).toBe(1);
      expect(valid.data.pageSize).toBe(20);
    }
  });

  it("enforces minimum length of 2 for non-empty search query", () => {
    const tooShort = taskSearchQuerySchema.safeParse({
      q: "a",
    });
    expect(tooShort.success).toBe(false);

    const empty = taskSearchQuerySchema.safeParse({
      q: "",
    });
    expect(empty.success).toBe(true);
  });

  it("enforces maximum length of 100 characters", () => {
    const tooLong = taskSearchQuerySchema.safeParse({
      q: "a".repeat(101),
    });
    expect(tooLong.success).toBe(false);

    const exactMax = taskSearchQuerySchema.safeParse({
      q: "a".repeat(100),
    });
    expect(exactMax.success).toBe(true);
  });

  it("enforces page size limits (default 20, max 50)", () => {
    const defaultCheck = taskSearchQuerySchema.safeParse({});
    expect(defaultCheck.success).toBe(true);
    if (defaultCheck.success) {
      expect(defaultCheck.data.page).toBe(1);
      expect(defaultCheck.data.pageSize).toBe(20);
    }

    const overMax = taskSearchQuerySchema.safeParse({
      pageSize: "51",
    });
    expect(overMax.success).toBe(false);

    const validMax = taskSearchQuerySchema.safeParse({
      pageSize: "50",
    });
    expect(validMax.success).toBe(true);
  });

  it("escapes SQL LIKE pattern wildcards correctly", () => {
    // Literal percentage
    expect(escapeSqlLikePattern("100%")).toBe("100\\%");

    // Literal underscore
    expect(escapeSqlLikePattern("task_id_1")).toBe("task\\_id\\_1");

    // Both
    expect(escapeSqlLikePattern("test%_pattern")).toBe("test\\%\\_pattern");

    // Backslash
    expect(escapeSqlLikePattern("test\\path")).toBe("test\\\\path");
  });
});
