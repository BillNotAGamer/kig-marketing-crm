// @vitest-environment node
import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  canAssignTask,
  canReadTask,
  permitsTask,
  taskPermissions,
} from "./policy";
import {
  createTaskSchema,
  currentBusinessDate,
  emptyTaskCommandSchema,
  reassignTaskSchema,
  taskMetadataSchema,
} from "./validation";
import type { Actor } from "../auth/session-core";
import { appRoleValues } from "../auth/roles";

const id = randomUUID();
const other = randomUUID();
const actor = (role: Actor["role"]): Actor => ({
  id,
  role,
  name: "Actor",
  email: "actor@example.invalid",
});
for (const role of appRoleValues) {
  it.each(taskPermissions)(
    `${role} has the explicit expected grant for %s`,
    (permission) => {
      const permitted =
        role === "HEAD" ||
        ["task:create-self", "task:read-self"].includes(permission) ||
        (role === "DEPUTY" &&
          ["task:read-team", "task:create-for-others"].includes(permission));
      expect(permitsTask(role, permission)).toBe(permitted);
    },
  );
  it(`${role} reads non-deleted self work, never deleted work`, () => {
    expect(
      canReadTask(actor(role), { assignedToId: id, deletedAt: null }),
    ).toBe(true);
    expect(
      canReadTask(actor(role), { assignedToId: id, deletedAt: new Date() }),
    ).toBe(false);
    expect(
      canReadTask(actor(role), { assignedToId: other, deletedAt: null }),
    ).toBe(role !== "EMPLOYEE");
  });
  it(`${role} can assign self only while ACTIVE`, () => {
    expect(canAssignTask(actor(role), { id, role, banned: false })).toBe(true);
    expect(canAssignTask(actor(role), { id, role, banned: true })).toBe(false);
  });
  it.each(appRoleValues)(
    `${role} assignment to another %s follows resource policy`,
    (targetRole) => {
      expect(
        canAssignTask(actor(role), {
          id: other,
          role: targetRole,
          banned: false,
        }),
      ).toBe(
        role === "HEAD" || (role === "DEPUTY" && targetRole === "EMPLOYEE"),
      );
      expect(
        canAssignTask(actor(role), {
          id: other,
          role: targetRole,
          banned: true,
        }),
      ).toBe(false);
    },
  );
}
const brandId = randomUUID();
const metadata = {
  title: "Task",
  description: null,
  priority: "NORMAL",
  assignedDate: "2026-09-18",
  dueDate: null,
  brandId,
};
it.each([
  "0000-09-18",
  "createdById",
  "status",
  "completedAt",
  "cancelledAt",
  "deletedAt",
  "deletedById",
  "actorId",
  "role",
])("rejects privileged extra field %s at create/edit boundaries", (field) => {
  expect(
    createTaskSchema.safeParse({
      ...metadata,
      assignedToId: id,
      [field]: "COMPLETED",
    }).success,
  ).toBe(false);
  expect(
    taskMetadataSchema.safeParse({ ...metadata, [field]: id }).success,
  ).toBe(false);
  expect(
    reassignTaskSchema.safeParse({ assignedToId: id, [field]: id }).success,
  ).toBe(false);
  expect(emptyTaskCommandSchema.safeParse({ [field]: id }).success).toBe(false);
});
it("metadata cannot change the assignee; commands cannot accept lifecycle patches", () => {
  expect(
    taskMetadataSchema.safeParse({ ...metadata, assignedToId: other }).success,
  ).toBe(false);
  expect(
    createTaskSchema.parse({
      ...metadata,
      priority: undefined,
      assignedToId: id,
    }).priority,
  ).toBe("NORMAL");
  expect(
    emptyTaskCommandSchema.safeParse({ status: "COMPLETED" }).success,
  ).toBe(false);
  expect(
    createTaskSchema.parse({
      title: "Minimal task",
      assignedDate: "2026-09-18",
      assignedToId: id,
      brandId,
    }),
  ).toMatchObject({
    description: null,
    dueDate: null,
    priority: "NORMAL",
    brandId,
  });
});
it("requires valid brandId UUID for task creation and metadata update", () => {
  const noBrand = {
    title: metadata.title,
    description: metadata.description,
    priority: metadata.priority,
    assignedDate: metadata.assignedDate,
    dueDate: metadata.dueDate,
  };
  expect(
    createTaskSchema.safeParse({ ...noBrand, assignedToId: id }).success,
  ).toBe(false);
  expect(taskMetadataSchema.safeParse(noBrand).success).toBe(false);
  expect(
    createTaskSchema.safeParse({
      ...metadata,
      assignedToId: id,
      brandId: "invalid-uuid",
    }).success,
  ).toBe(false);
  expect(
    taskMetadataSchema.safeParse({ ...metadata, brandId: "invalid-uuid" })
      .success,
  ).toBe(false);
});
it.each([
  "2026-02-29",
  "2026-13-01",
  "2026-09-31",
  "2026-9-18",
  "2026-09-18T00:00:00Z",
])("rejects invalid business DATE %s", (assignedDate) => {
  expect(
    createTaskSchema.safeParse({ ...metadata, assignedDate, assignedToId: id })
      .success,
  ).toBe(false);
});
it("validates nonblank title, lengths, priority, UUID and date ordering", () => {
  for (const patch of [
    { title: "  " },
    { title: "a".repeat(201) },
    { description: "a".repeat(10001) },
    { priority: "CRITICAL" },
    { assignedToId: "other" },
    { dueDate: "2026-09-17" },
  ])
    expect(
      createTaskSchema.safeParse({ ...metadata, assignedToId: id, ...patch })
        .success,
    ).toBe(false);
  expect(
    createTaskSchema.parse({
      ...metadata,
      assignedToId: id,
      assignedDate: "2024-02-29",
      dueDate: "2024-02-29",
    }).assignedDate,
  ).toBe("2024-02-29");
});
it("derives the date in Asia/Ho_Chi_Minh across the UTC boundary", () => {
  expect(currentBusinessDate(new Date("2026-09-17T16:59:59Z"))).toBe(
    "2026-09-17",
  );
  expect(currentBusinessDate(new Date("2026-09-17T17:00:00Z"))).toBe(
    "2026-09-18",
  );
});
