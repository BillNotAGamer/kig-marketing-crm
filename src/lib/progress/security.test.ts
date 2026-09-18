// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  canSubmitProgress,
  correctionSchema,
  progressDTO,
  progressGrants,
  requireCorrection,
  submitProgressSchema,
  todayProgress,
} from "./model";
import { currentBusinessDate } from "../tasks/validation";
import type { Actor } from "../auth/session-core";
import type { TaskDailyUpdate } from "../../db/schema/task-daily-updates";
import { progressHttp } from "./http";
import { AccessError } from "../auth/permissions";

describe("Progress policy", () => {
  for (const role of ["HEAD", "DEPUTY", "EMPLOYEE"] as const) {
    const actor: Actor = {
      id: "actor",
      role,
      name: "Actor",
      email: "actor@example.invalid",
    };
    it(`${role} only reports own OPEN non-deleted work`, () => {
      expect(
        canSubmitProgress(actor, {
          assignedToId: actor.id,
          status: "OPEN",
          deletedAt: null,
        }),
      ).toBe(true);
      for (const task of [
        { assignedToId: "other", status: "OPEN", deletedAt: null },
        { assignedToId: actor.id, status: "CANCELLED", deletedAt: null },
        { assignedToId: actor.id, status: "COMPLETED", deletedAt: null },
        { assignedToId: actor.id, status: "OPEN", deletedAt: new Date() },
      ])
        expect(canSubmitProgress(actor, task)).toBe(false);
      expect(progressGrants[role]).toEqual(
        role === "HEAD"
          ? ["progress:create-own", "progress:correct"]
          : ["progress:create-own"],
      );
    });
  }
});
it.each([
  "userId",
  "taskId",
  "reportDate",
  "createdAt",
  "correctedAt",
  "correctedById",
  "correctionReason",
  "completedAt",
  "taskStatus",
  "actorId",
  "role",
])("submission rejects privileged %s", (field) => {
  expect(
    submitProgressSchema.safeParse({ status: "COMPLETED", [field]: "injected" })
      .success,
  ).toBe(false);
});
it.each([null, "", "text", " "])("COMPLETED rejects reason %s", (reason) => {
  expect(
    submitProgressSchema.safeParse({ status: "COMPLETED", reason }).success,
  ).toBe(false);
});
it.each([undefined, null, "", " \n\t ", "x".repeat(5001)])(
  "NOT_COMPLETED rejects invalid reason",
  (reason) => {
    expect(
      submitProgressSchema.safeParse({ status: "NOT_COMPLETED", reason })
        .success,
    ).toBe(false);
  },
);
it("accepts exact statuses and trims valid business reason", () => {
  expect(
    submitProgressSchema.parse({
      status: "NOT_COMPLETED",
      reason: " Waiting for footage ",
    }),
  ).toEqual({ status: "NOT_COMPLETED", reason: "Waiting for footage" });
  expect(submitProgressSchema.parse({ status: "COMPLETED" })).toEqual({
    status: "COMPLETED",
  });
  expect(
    submitProgressSchema.safeParse({ status: "NOT_REPORTED" }).success,
  ).toBe(false);
});
it("correction requires strict reason and rejects lifecycle/ownership metadata", () => {
  expect(correctionSchema.safeParse({ status: "COMPLETED" }).success).toBe(
    false,
  );
  expect(
    correctionSchema.safeParse({ status: "COMPLETED", correctionReason: " " })
      .success,
  ).toBe(false);
  expect(
    correctionSchema.safeParse({
      status: "COMPLETED",
      correctionReason: "fix",
      reason: null,
    }).success,
  ).toBe(false);
  expect(
    correctionSchema.safeParse({
      status: "NOT_COMPLETED",
      correctionReason: "fix",
    }).success,
  ).toBe(false);
  for (const field of [
    "reportDate",
    "userId",
    "taskId",
    "correctedAt",
    "correctedById",
    "completedAt",
    "statusPatch",
  ])
    expect(
      correctionSchema.safeParse({
        status: "COMPLETED",
        correctionReason: "fix",
        [field]: "value",
      }).success,
    ).toBe(false);
});
it("chronology requires latest and meaningful status transition", () => {
  expect(() =>
    requireCorrection(
      { id: "latest", status: "COMPLETED" },
      "older",
      "NOT_COMPLETED",
    ),
  ).toThrow("latest");
  for (const status of ["COMPLETED", "NOT_COMPLETED"])
    expect(() =>
      requireCorrection({ id: "latest", status }, "latest", status),
    ).toThrow("change");
  expect(() =>
    requireCorrection(
      { id: "latest", status: "COMPLETED" },
      "latest",
      "NOT_COMPLETED",
    ),
  ).not.toThrow();
});
it("DTO whitelists business fields and NOT_REPORTED is derived by relevant DATE", () => {
  const row: TaskDailyUpdate = {
    id: "report",
    taskId: "task",
    userId: "user",
    reportDate: "2026-09-19",
    status: "NOT_COMPLETED",
    reason: "Waiting",
    createdAt: new Date("2026-09-18T17:00:00Z"),
    correctedAt: null,
    correctedById: null,
    correctionReason: null,
  };
  const dto = progressDTO(row);
  expect(Object.keys(dto).sort()).toEqual(
    [
      "id",
      "reportDate",
      "status",
      "reason",
      "createdAt",
      "isCorrected",
      "correctedAt",
      "correctionReason",
    ].sort(),
  );
  expect(todayProgress([dto], "2026-09-18")).toEqual({
    reportDate: "2026-09-18",
    status: "NOT_REPORTED",
    report: null,
  });
  expect(todayProgress([dto], "2026-09-19").status).toBe("NOT_COMPLETED");
  expect(currentBusinessDate(new Date("2026-09-18T16:59:59Z"))).toBe(
    "2026-09-18",
  );
  expect(currentBusinessDate(new Date("2026-09-18T17:00:00Z"))).toBe(
    "2026-09-19",
  );
});
it("HTTP maps controlled errors, hides library details and checks origin before dispatch", async () => {
  const failure = vi.fn();
  const service = {
    getTaskProgress: failure,
    getTaskProgressHistory: failure,
    getTodayTaskProgress: failure,
    submitTaskProgress: failure,
    correctTaskProgress: failure,
  };
  for (const status of [401, 403, 404, 409] as const) {
    failure.mockRejectedValueOnce(new AccessError(status, "Controlled denial"));
    const response = await progressHttp(
      new Request("http://localhost:3000/progress"),
      service,
      "http://localhost:3000",
      "task",
    );
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  failure.mockRejectedValueOnce(new Error("PRIVATE DRIVER DETAILS"));
  const response = await progressHttp(
    new Request("http://localhost:3000/progress"),
    service,
    "http://localhost:3000",
    "task",
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE");
  const before = failure.mock.calls.length;
  expect(
    (
      await progressHttp(
        new Request("http://localhost:3000/progress", {
          method: "POST",
          headers: { origin: "https://foreign.invalid" },
        }),
        service,
        "http://localhost:3000",
        "task",
      )
    ).status,
  ).toBe(403);
  expect(failure.mock.calls.length).toBe(before);
});
