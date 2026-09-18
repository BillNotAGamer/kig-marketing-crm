import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { authFixtures } from "../test/auth-fixtures";
import { createAuth } from "../lib/auth/factory";
import { taskService } from "../lib/tasks/service";
import { tasksHttp } from "../lib/tasks/http";
import { userService } from "../lib/users/service";
import {
  task,
  auditLog,
  notification,
  taskDailyUpdate,
  taskAsset,
} from "./schema";

let fixture: Awaited<ReturnType<typeof authFixtures>>;
let service: ReturnType<typeof taskService>;
let head: Headers;
let deputy: Headers;
let employee: Headers;
let employeeB: Headers;
async function login(email: string) {
  const response = await createAuth(fixture.db, fixture.env).api.signInEmail({
    body: { email, password: fixture.password },
    asResponse: true,
  });
  expect(response.status).toBe(200);
  return new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  });
}
const metadata = {
  title: "Task integration fixture",
  description: "Business metadata",
  assignedDate: "2026-09-18",
  dueDate: "2026-09-19",
  priority: "NORMAL",
};
function input(id: string, title = `Task ${randomUUID()}`) {
  return { ...metadata, title, assignedToId: id };
}
async function row(id: string) {
  return (await fixture.db.select().from(task).where(eq(task.id, id)))[0];
}
async function notices(id: string) {
  return fixture.db
    .select()
    .from(notification)
    .where(eq(notification.entityId, id));
}
async function audits(id: string) {
  return fixture.db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, "task"), eq(auditLog.entityId, id)));
}
function request(
  path: string,
  body?: unknown,
  actor = new Headers(),
  origin = new URL(fixture.env.BETTER_AUTH_URL).origin,
) {
  return new Request(new URL(path, fixture.env.BETTER_AUTH_URL), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie: actor.get("cookie") ?? "",
      origin,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  fixture = await authFixtures("phase3");
  service = taskService(fixture.db, fixture.env);
  head = await login(fixture.head.email);
  deputy = await login(fixture.deputy.email);
  employee = await login(fixture.employee.email);
  employeeB = await login(fixture.employeeB.email);
});
afterAll(async () => {
  if (fixture) await fixture.cleanup();
});

it("creates OPEN work for all allowed role targets with immutable creator, audit, notifications and DATE values", async () => {
  for (const [headers, creatorId, target] of [
    [head, fixture.head.id, fixture.head.id],
    [head, fixture.head.id, fixture.deputy.id],
    [head, fixture.head.id, fixture.employee.id],
    [deputy, fixture.deputy.id, fixture.deputy.id],
    [deputy, fixture.deputy.id, fixture.employee.id],
    [employee, fixture.employee.id, fixture.employee.id],
  ] as const) {
    const created = await service.createTask(headers, input(target));
    expect(created).toMatchObject({
      status: "OPEN",
      createdById: creatorId,
      assignedToId: target,
      assignedDate: "2026-09-18",
      dueDate: "2026-09-19",
      completedAt: null,
      cancelledAt: null,
    });
    expect(await row(created.id)).toMatchObject({
      deletedAt: null,
      deletedById: null,
    });
    expect(await audits(created.id)).toEqual([
      expect.objectContaining({
        action: "CREATE_TASK",
        actorUserId: creatorId,
      }),
    ]);
    const notifications = await notices(created.id);
    if (creatorId === target) expect(notifications).toHaveLength(0);
    else
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "TASK_ASSIGNED",
          userId: target,
          entityType: "task",
        }),
      ]);
    const types = await fixture.db.execute(
      sql`SELECT pg_typeof(assigned_date)::text AS assigned, pg_typeof(due_date)::text AS due FROM task WHERE id=${created.id}`,
    );
    expect(types[0]).toMatchObject({ assigned: "date", due: "date" });
  }
});

it("rejects unauthorized/inactive assignments and returns only canonical role-scoped active selector data", async () => {
  for (const [headers, target] of [
    [employee, fixture.employeeB.id],
    [employee, fixture.head.id],
    [deputy, fixture.head.id],
    [deputy, fixture.deputyB.id],
    [deputy, fixture.inactive.id],
    [head, fixture.inactive.id],
    [head, randomUUID()],
  ] as const)
    expect(
      (
        await tasksHttp(
          request("/api/tasks", input(target), headers),
          service,
          fixture.env.BETTER_AUTH_URL,
        )
      ).status,
    ).toBe(403);
  const headOptions = await service.listAssignees(head);
  expect(headOptions.some((value) => value.id === fixture.inactive.id)).toBe(
    false,
  );
  expect(headOptions.some((value) => value.id === fixture.deputyB.id)).toBe(
    true,
  );
  expect(
    (await service.listAssignees(employee)).map((value) => value.id),
  ).toEqual([fixture.employee.id]);
  const deputyOptions = await service.listAssignees(deputy);
  expect(
    deputyOptions.every(
      (value) => value.id === fixture.deputy.id || value.role === "EMPLOYEE",
    ),
  ).toBe(true);
  expect(Object.keys(headOptions[0]).sort()).toEqual(["id", "name", "role"]);
});

it("scopes reads to current assignee and preserves creator through metadata edit and reassignment", async () => {
  const created = await service.createTask(
    employee,
    input(fixture.employee.id),
  );
  expect((await service.getTask(head, created.id)).id).toBe(created.id);
  expect((await service.getTask(deputy, created.id)).id).toBe(created.id);
  await expect(service.getTask(employeeB, created.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (await service.listTasks(employeeB)).some(
      (value) => value.id === created.id,
    ),
  ).toBe(false);
  await service.updateTaskMetadata(head, created.id, {
    ...metadata,
    title: "Edited by HEAD",
    priority: "HIGH",
  });
  expect(await row(created.id)).toMatchObject({
    createdById: fixture.employee.id,
    assignedToId: fixture.employee.id,
    status: "OPEN",
    title: "Edited by HEAD",
  });
  expect((await notices(created.id)).map((value) => value.type)).toEqual([
    "TASK_UPDATED",
  ]);
  await service.reassignTask(head, created.id, {
    assignedToId: fixture.employeeB.id,
  });
  expect(await row(created.id)).toMatchObject({
    createdById: fixture.employee.id,
    assignedToId: fixture.employeeB.id,
  });
  await expect(service.getTask(employee, created.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (await service.listTasks(employee)).some(
      (value) => value.id === created.id,
    ),
  ).toBe(false);
  const visible = await service.getTask(employeeB, created.id);
  expect(visible.creator.id).toBe(fixture.employee.id);
  expect(visible.assignee.id).toBe(fixture.employeeB.id);
  expect(Object.keys(visible.creator).sort()).toEqual(["id", "name"]);
  expect(Object.keys(visible.assignee).sort()).toEqual(["id", "name"]);
  expect(
    Object.keys(visible).some((key) =>
      /password|email|account|session|token|banned/i.test(key),
    ),
  ).toBe(false);
  expect((await service.getTask(head, created.id)).id).toBe(created.id);
  expect((await service.getTask(deputy, created.id)).id).toBe(created.id);
  expect(await notices(created.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "TASK_REASSIGNED",
        userId: fixture.employeeB.id,
      }),
    ]),
  );
  const events = await audits(created.id);
  expect(events.map((value) => value.action)).toEqual(
    expect.arrayContaining(["CREATE_TASK", "UPDATE_TASK", "REASSIGN_TASK"]),
  );
  const reassigned = events.find((value) => value.action === "REASSIGN_TASK")!;
  expect(reassigned.beforeData?.assignedToId).toBe(fixture.employee.id);
  expect(reassigned.afterData?.assignedToId).toBe(fixture.employeeB.id);
  expect(JSON.stringify(events).includes(fixture.password)).toBe(false);
});

it("enforces direct HTTP mutation authorization, strict lifecycle fields, session and origin checks", async () => {
  const created = await service.createTask(head, input(fixture.employee.id));
  const commands = [
    ["metadata", metadata],
    ["reassign", { assignedToId: fixture.employeeB.id }],
    ["cancel", {}],
    ["soft-delete", {}],
  ] as const;
  for (const headers of [deputy, employee])
    for (const [command, body] of commands)
      expect(
        (
          await tasksHttp(
            request(`/api/tasks/${created.id}/${command}`, body, headers),
            service,
            fixture.env.BETTER_AUTH_URL,
            created.id,
            command,
          )
        ).status,
      ).toBe(403);
  for (const field of [
    "createdById",
    "status",
    "completedAt",
    "cancelledAt",
    "deletedAt",
    "deletedById",
    "actorId",
    "role",
  ]) {
    expect(
      (
        await tasksHttp(
          request(
            "/api/tasks",
            { ...input(fixture.employee.id), [field]: "COMPLETED" },
            head,
          ),
          service,
          fixture.env.BETTER_AUTH_URL,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await tasksHttp(
          request(
            `/api/tasks/${created.id}/metadata`,
            { ...metadata, [field]: "COMPLETED" },
            head,
          ),
          service,
          fixture.env.BETTER_AUTH_URL,
          created.id,
          "metadata",
        )
      ).status,
    ).toBe(400);
  }
  for (const command of ["complete", "status", "update", "restore"])
    expect(
      (
        await tasksHttp(
          request(
            `/api/tasks/${created.id}/${command}`,
            { status: "COMPLETED" },
            head,
          ),
          service,
          fixture.env.BETTER_AUTH_URL,
          created.id,
          command,
        )
      ).status,
    ).toBe(404);
  expect(
    (
      await tasksHttp(
        request(
          `/api/tasks/${created.id}/metadata`,
          { ...metadata, assignedToId: fixture.employeeB.id },
          head,
        ),
        service,
        fixture.env.BETTER_AUTH_URL,
        created.id,
        "metadata",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await tasksHttp(
        request("/api/tasks"),
        service,
        fixture.env.BETTER_AUTH_URL,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await tasksHttp(
        request(
          "/api/tasks",
          input(fixture.employee.id),
          head,
          "https://example.invalid",
        ),
        service,
        fixture.env.BETTER_AUTH_URL,
      )
    ).status,
  ).toBe(403);
  expect((await row(created.id)).status).toBe("OPEN");
  expect(
    (
      await tasksHttp(
        request(
          "/api/tasks",
          { ...input(fixture.employee.id), assignedDate: "0000-09-18" },
          head,
        ),
        service,
        fixture.env.BETTER_AUTH_URL,
      )
    ).status,
  ).toBe(400);
  const banned = await userService(fixture.db, fixture.env).create(head, {
    name: "Ban actor fixture",
    email: fixture.email("ban-actor"),
    role: "EMPLOYEE",
    password: fixture.password,
  });
  const bannedHeaders = await login(banned.email);
  await userService(fixture.db, fixture.env).command(head, banned.id, {
    operation: "disable",
  });
  await expect(service.listTasks(bannedHeaders)).rejects.toMatchObject({
    status: 401,
  });
  await expect(
    service.createTask(bannedHeaders, input(banned.id)),
  ).rejects.toMatchObject({ status: 401 });
});

it("cancels only OPEN tasks, preserves history and rejects later metadata/reassignment/completion", async () => {
  const created = await service.createTask(head, input(fixture.employee.id));
  await expect(
    service.reassignTask(head, created.id, {
      assignedToId: fixture.inactive.id,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await service.cancelTask(head, created.id, {});
  const cancelled = await service.getTask(employee, created.id);
  expect(cancelled.status).toBe("CANCELLED");
  expect(cancelled.cancelledAt).not.toBeNull();
  expect(cancelled.completedAt).toBeNull();
  expect((await row(created.id)).deletedAt).toBeNull();
  await expect(service.cancelTask(head, created.id, {})).rejects.toMatchObject({
    status: 409,
  });
  await expect(
    service.updateTaskMetadata(head, created.id, metadata),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    service.reassignTask(head, created.id, {
      assignedToId: fixture.employeeB.id,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await audits(created.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: "CANCEL_TASK" }),
    ]),
  );
  expect(await notices(created.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "TASK_CANCELLED",
        userId: fixture.employee.id,
      }),
    ]),
  );
});

it("omits redundant create/update/cancel self notices and notifies a new assignee even on reassignment to the HEAD actor", async () => {
  const created = await service.createTask(head, input(fixture.head.id));
  await service.updateTaskMetadata(head, created.id, metadata);
  await service.cancelTask(head, created.id, {});
  expect(await notices(created.id)).toHaveLength(0);
  const other = await service.createTask(head, input(fixture.employee.id));
  await service.reassignTask(head, other.id, { assignedToId: fixture.head.id });
  expect(await notices(other.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "TASK_REASSIGNED",
        userId: fixture.head.id,
      }),
    ]),
  );
});

it("soft deletes independently of OPEN/CANCELLED/COMPLETED status, retaining rows, dependent history and audit", async () => {
  for (const lifecycle of ["OPEN", "CANCELLED", "COMPLETED"] as const) {
    const created = await service.createTask(head, input(fixture.employee.id));
    if (lifecycle === "CANCELLED")
      await service.cancelTask(head, created.id, {});
    if (lifecycle === "COMPLETED") {
      // Test-only historical fixture, never a Phase 3 completion command.
      await fixture.db
        .update(task)
        .set({ status: "COMPLETED", completedAt: new Date() })
        .where(eq(task.id, created.id));
      await expect(
        service.updateTaskMetadata(head, created.id, metadata),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.reassignTask(head, created.id, {
          assignedToId: fixture.employeeB.id,
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.cancelTask(head, created.id, {}),
      ).rejects.toMatchObject({ status: 409 });
    }
    // Existing schema fixtures prove parent removal does not remove dependent records.
    await fixture.db.insert(taskDailyUpdate).values({
      taskId: created.id,
      userId: fixture.employee.id,
      reportDate: "2026-09-18",
      status: "NOT_COMPLETED",
      reason: "Historical fixture only",
    });
    await fixture.db.insert(taskAsset).values({
      taskId: created.id,
      createdById: fixture.employee.id,
      provider: "GOOGLE_DRIVE",
      providerFileId: randomUUID(),
      sourceUrl: "https://drive.google.com/file/d/test-fixture/view",
      assetType: "OTHER",
    });
    const count = (await audits(created.id)).length;
    await service.softDeleteTask(head, created.id, {});
    const retained = await row(created.id);
    expect(retained.status).toBe(lifecycle);
    expect(retained.deletedAt).not.toBeNull();
    expect(retained.deletedById).toBe(fixture.head.id);
    expect(
      await fixture.db
        .select()
        .from(taskDailyUpdate)
        .where(eq(taskDailyUpdate.taskId, created.id)),
    ).toHaveLength(1);
    expect(
      await fixture.db
        .select()
        .from(taskAsset)
        .where(eq(taskAsset.taskId, created.id)),
    ).toHaveLength(1);
    expect(await audits(created.id)).toHaveLength(count + 1);
    for (const headers of [head, deputy, employee]) {
      await expect(service.getTask(headers, created.id)).rejects.toMatchObject({
        status: 404,
      });
      expect(
        (await service.listTasks(headers)).some(
          (value) => value.id === created.id,
        ),
      ).toBe(false);
    }
    await expect(
      service.updateTaskMetadata(head, created.id, metadata),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.reassignTask(head, created.id, {
        assignedToId: fixture.employeeB.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.cancelTask(head, created.id, {}),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.softDeleteTask(head, created.id, {}),
    ).rejects.toMatchObject({ status: 404 });
  }
});

it("rolls back task/reassignment/audit/notifications when a real PostgreSQL audit or notification insert fails", async () => {
  const rollback = new Error("rollback failure injection fixtures and DDL");
  await expect(
    fixture.db.transaction(async (tx) => {
      const local = taskService(tx, fixture.env);
      const created = await local.createTask(head, input(fixture.employee.id));
      await tx.execute(sql`CREATE FUNCTION pg_temp.kig_phase3_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.entity_type='task' AND current_setting('kig.phase3_fail_audit',true)=NEW.action
      THEN RAISE EXCEPTION 'Injected task audit rejection' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`);
      await tx.execute(
        sql`CREATE TRIGGER kig_phase3_fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.kig_phase3_fail_audit()`,
      );
      await tx.execute(sql`CREATE FUNCTION pg_temp.kig_phase3_fail_notice() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF current_setting('kig.phase3_fail_notice',true)='on'
      THEN RAISE EXCEPTION 'Injected task notification rejection' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`);
      await tx.execute(
        sql`CREATE TRIGGER kig_phase3_fail_notice BEFORE INSERT ON notification FOR EACH ROW EXECUTE FUNCTION pg_temp.kig_phase3_fail_notice()`,
      );
      const count = async () =>
        Number(
          (await tx.execute(sql`SELECT count(*) AS count FROM task`))[0].count,
        );
      const before = await count();
      const failedTitle = `Failed create ${randomUUID()}`;
      await tx.execute(
        sql`SELECT set_config('kig.phase3_fail_audit','CREATE_TASK',true)`,
      );
      await expect(
        local.createTask(head, input(fixture.employee.id, failedTitle)),
      ).rejects.toBeDefined();
      expect(await count()).toBe(before);
      expect(
        await tx
          .select()
          .from(notification)
          .where(eq(notification.message, failedTitle)),
      ).toHaveLength(0);
      await tx.execute(
        sql`SELECT set_config('kig.phase3_fail_audit','REASSIGN_TASK',true)`,
      );
      await expect(
        local.reassignTask(head, created.id, {
          assignedToId: fixture.employeeB.id,
        }),
      ).rejects.toBeDefined();
      expect(
        (await tx.select().from(task).where(eq(task.id, created.id)))[0]
          .assignedToId,
      ).toBe(fixture.employee.id);
      expect(
        (
          await tx
            .select()
            .from(auditLog)
            .where(eq(auditLog.entityId, created.id))
        ).map((value) => value.action),
      ).toEqual(["CREATE_TASK"]);
      expect(
        (
          await tx
            .select()
            .from(notification)
            .where(eq(notification.entityId, created.id))
        ).map((value) => value.type),
      ).toEqual(["TASK_ASSIGNED"]);
      await tx.execute(
        sql`SELECT set_config('kig.phase3_fail_audit','',true), set_config('kig.phase3_fail_notice','on',true)`,
      );
      await expect(
        local.createTask(head, input(fixture.employee.id, failedTitle)),
      ).rejects.toBeDefined();
      expect(await count()).toBe(before);
      await expect(
        local.reassignTask(head, created.id, {
          assignedToId: fixture.employeeB.id,
        }),
      ).rejects.toBeDefined();
      expect(
        (await tx.select().from(task).where(eq(task.id, created.id)))[0]
          .assignedToId,
      ).toBe(fixture.employee.id);
      expect(
        (
          await tx
            .select()
            .from(auditLog)
            .where(eq(auditLog.entityId, created.id))
        ).map((value) => value.action),
      ).toEqual(["CREATE_TASK"]);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
  const triggers = await fixture.db.execute(
    sql`SELECT count(*) AS count FROM pg_trigger WHERE tgname IN ('kig_phase3_fail_notice','kig_phase3_fail_audit')`,
  );
  expect(Number(triggers[0].count)).toBe(0);
});

it("rechecks committed lifecycle under competing cancel/reassign and delete/edit transactions", async () => {
  for (const kind of ["cancel", "delete"] as const) {
    const created = await service.createTask(head, input(fixture.employee.id));
    let signal!: () => void;
    let release!: () => void;
    const locked = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const winner = fixture.db.transaction(async (tx) => {
      const local = taskService(tx, fixture.env);
      if (kind === "cancel") await local.cancelTask(head, created.id, {});
      else await local.softDeleteTask(head, created.id, {});
      signal();
      await held;
    });
    let loser: Promise<number> | undefined;
    try {
      await locked;
      loser = (
        kind === "cancel"
          ? service.reassignTask(head, created.id, {
              assignedToId: fixture.employeeB.id,
            })
          : service.updateTaskMetadata(head, created.id, metadata)
      ).then(
        () => 200,
        (error: unknown) =>
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 500,
      );
      let waiting = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const locks = await fixture.db.execute(
          sql`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=24091802 AND NOT granted) AS waiting`,
        );
        if (locks[0].waiting) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(
        waiting,
        "The competing transaction must wait for the writer lock.",
      ).toBe(true);
      release();
      await winner;
      expect(await loser).toBe(kind === "cancel" ? 409 : 404);
      expect((await row(created.id)).assignedToId).toBe(fixture.employee.id);
      expect(
        (await audits(created.id)).some(
          (value) =>
            value.action === "REASSIGN_TASK" || value.action === "UPDATE_TASK",
        ),
      ).toBe(false);
    } finally {
      release();
      await winner;
      if (loser) await loser;
    }
  }
});
