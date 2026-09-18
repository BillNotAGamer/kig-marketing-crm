import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, afterAll, expect, it } from "vitest";
import { authFixtures } from "../test/auth-fixtures";
import { createAuth } from "../lib/auth/factory";
import { taskService } from "../lib/tasks/service";
import { progressService } from "../lib/progress/service";
import { progressHttp } from "../lib/progress/http";
import { task, taskDailyUpdate, auditLog, user } from "./schema";

let fixture: Awaited<ReturnType<typeof authFixtures>>;
let tasks: ReturnType<typeof taskService>;
let progress: ReturnType<typeof progressService>;
let head: Headers, deputy: Headers, employee: Headers, employeeB: Headers;
let instant = new Date("2026-09-18T08:00:00Z");
beforeAll(async () => {
  fixture = await authFixtures("phase4");
  tasks = taskService(fixture.db, fixture.env);
  progress = progressService(fixture.db, fixture.env, () => instant);
  const login = async (email: string) => {
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
  };
  head = await login(fixture.head.email);
  deputy = await login(fixture.deputy.email);
  employee = await login(fixture.employee.email);
  employeeB = await login(fixture.employeeB.email);
});
afterAll(async () => {
  if (fixture) await fixture.cleanup();
});
const completed = { status: "COMPLETED" };
const incomplete = { status: "NOT_COMPLETED", reason: " Waiting for footage " };
async function create(assignee = fixture.employee.id) {
  return tasks.createTask(head, {
    title: `Progress ${randomUUID()}`,
    assignedToId: assignee,
    assignedDate: "2026-09-18",
  });
}
async function row(id: string) {
  return (await fixture.db.select().from(task).where(eq(task.id, id)))[0];
}
async function reports(id: string) {
  return fixture.db
    .select()
    .from(taskDailyUpdate)
    .where(eq(taskDailyUpdate.taskId, id));
}
async function events(id: string) {
  return fixture.db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityId, id),
        sql`${auditLog.action} IN ('MARK_TASK_COMPLETED','MARK_TASK_NOT_COMPLETED','CORRECT_TASK_PROGRESS')`,
      ),
    );
}
async function boundary(
  id: string,
  body: unknown,
  headers = employee,
  progressId?: string,
  origin = fixture.env.BETTER_AUTH_URL,
) {
  return progressHttp(
    new Request(`${fixture.env.BETTER_AUTH_URL}/api/tasks/${id}/progress`, {
      method: "POST",
      headers: {
        cookie: headers.get("cookie") ?? "",
        origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    progress,
    fixture.env.BETTER_AUTH_URL,
    id,
    progressId,
  );
}

it("only current assignees of all three roles complete with one report, lifecycle timestamp, safe DTO and audit", async () => {
  instant = new Date("2026-09-18T08:00:00Z");
  for (const [actor, assignee] of [
    [head, fixture.head.id],
    [deputy, fixture.deputy.id],
    [employee, fixture.employee.id],
  ] as const) {
    const created = await create(assignee);
    expect(
      (await progress.getTodayTaskProgress(actor, created.id)).status,
    ).toBe("NOT_REPORTED");
    const report = await progress.submitTaskProgress(
      actor,
      created.id,
      completed,
    );
    expect(report).toMatchObject({
      status: "COMPLETED",
      reason: null,
      reportDate: "2026-09-18",
      isCorrected: false,
    });
    expect(Object.keys(report).sort()).toEqual(
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
    const parent = await row(created.id);
    expect(parent.status).toBe("COMPLETED");
    expect(parent.completedAt?.toISOString()).toBe(instant.toISOString());
    expect(parent.cancelledAt).toBeNull();
    expect(parent.createdById).toBe(fixture.head.id);
    expect(await reports(created.id)).toHaveLength(1);
    const audit = await events(created.id);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("MARK_TASK_COMPLETED");
    expect(audit[0].actorUserId).toBe(assignee);
    expect(JSON.stringify(audit)).not.toContain(fixture.password);
    await expect(
      progress.submitTaskProgress(actor, created.id, completed),
    ).rejects.toMatchObject({ status: 409 });
    expect((await progress.getTaskProgress(actor, created.id)).canSubmit).toBe(
      false,
    );
  }
});
it("NOT_COMPLETED requires bounded nonblank reason, preserves OPEN/timestamps, audits and blocks second official report", async () => {
  const created = await create();
  for (const reason of [undefined, null, "", " \t\n ", "x".repeat(5001)])
    expect(
      (await boundary(created.id, { status: "NOT_COMPLETED", reason })).status,
    ).toBe(400);
  const response = await boundary(created.id, incomplete);
  expect(response.status).toBe(201);
  const report = await response.json();
  expect(report.reason).toBe("Waiting for footage");
  expect(await row(created.id)).toMatchObject({
    status: "OPEN",
    completedAt: null,
    cancelledAt: null,
  });
  expect((await events(created.id))[0].action).toBe("MARK_TASK_NOT_COMPLETED");
  expect((await boundary(created.id, completed)).status).toBe(409);
  expect(await reports(created.id)).toHaveLength(1);
  expect((await progress.getTaskProgress(employee, created.id)).canSubmit).toBe(
    false,
  );
});
it("actual authenticated HTTP boundary rejects non-assignee, privileged fields, arbitrary dates, generic mutation and unsafe origin", async () => {
  const created = await create();
  for (const actor of [head, deputy])
    expect((await boundary(created.id, completed, actor)).status).toBe(403);
  expect((await boundary(created.id, completed, employeeB)).status).toBe(404);
  expect((await boundary(created.id, completed, new Headers())).status).toBe(
    401,
  );
  expect(
    (
      await boundary(
        created.id,
        completed,
        employee,
        undefined,
        "https://foreign.invalid",
      )
    ).status,
  ).toBe(403);
  for (const field of [
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
    "reason",
  ])
    expect(
      (await boundary(created.id, { ...completed, [field]: "injected" }))
        .status,
    ).toBe(400);
  expect((await boundary(created.id, { status: "NOT_REPORTED" })).status).toBe(
    400,
  );
  for (const method of ["PATCH", "DELETE"])
    expect(
      (
        await progressHttp(
          new Request(`${fixture.env.BETTER_AUTH_URL}/progress`, {
            method,
            headers: { origin: fixture.env.BETTER_AUTH_URL },
          }),
          progress,
          fixture.env.BETTER_AUTH_URL,
          created.id,
        )
      ).status,
    ).toBe(405);
  expect(await reports(created.id)).toHaveLength(0);
});
it("same-day reassignment retains report ownership and uniqueness; later business DATE completes the same task with two rows", async () => {
  instant = new Date("2026-09-18T16:59:59Z");
  const created = await create();
  const first = await progress.submitTaskProgress(
    employee,
    created.id,
    incomplete,
  );
  await tasks.reassignTask(head, created.id, {
    assignedToId: fixture.employeeB.id,
  });
  await expect(
    progress.getTaskProgressHistory(employee, created.id),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    progress.submitTaskProgress(employee, created.id, completed),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    progress.submitTaskProgress(employeeB, created.id, completed),
  ).rejects.toMatchObject({ status: 409 });
  expect((await reports(created.id))[0].userId).toBe(fixture.employee.id);
  instant = new Date("2026-09-18T17:00:00Z");
  const second = await progress.submitTaskProgress(
    employeeB,
    created.id,
    completed,
  );
  expect(first.reportDate).toBe("2026-09-18");
  expect(second.reportDate).toBe("2026-09-19");
  expect(
    (await progress.getTaskProgressHistory(head, created.id)).map(
      (value) => value.reportDate,
    ),
  ).toEqual(["2026-09-19", "2026-09-18"]);
  expect(
    await progress.getTaskProgressHistory(deputy, created.id),
  ).toHaveLength(2);
  expect(await reports(created.id)).toHaveLength(2);
  expect((await row(created.id)).status).toBe("COMPLETED");
  const dates = await fixture.db.execute(
    sql`SELECT report_date::text AS value, pg_typeof(report_date)::text AS type FROM task_daily_update WHERE task_id=${created.id} ORDER BY report_date`,
  );
  expect(dates.map((value) => [value.value, value.type])).toEqual([
    ["2026-09-18", "date"],
    ["2026-09-19", "date"],
  ]);
});
it("HEAD correction toggles latest report/lifecycle atomically, preserves original date/reporter, rejects same status and older history", async () => {
  instant = new Date("2026-09-18T08:00:00Z");
  const created = await create();
  const first = await progress.submitTaskProgress(
    employee,
    created.id,
    completed,
  );
  for (const actor of [employee, deputy])
    expect(
      (
        await boundary(
          created.id,
          { ...incomplete, correctionReason: "Mistake" },
          actor,
          first.id,
        )
      ).status,
    ).toBe(403);
  for (const body of [
    { ...incomplete },
    { ...incomplete, correctionReason: " " },
    { ...incomplete, correctionReason: "Fix", correctedById: fixture.head.id },
  ])
    expect((await boundary(created.id, body, head, first.id)).status).toBe(400);
  const original = (await reports(created.id))[0];
  instant = new Date("2026-09-18T09:00:00Z");
  const corrected = await progress.correctTaskProgress(
    head,
    created.id,
    first.id,
    { ...incomplete, correctionReason: "Marked complete by mistake" },
  );
  expect(corrected).toMatchObject({
    status: "NOT_COMPLETED",
    isCorrected: true,
    reportDate: first.reportDate,
    createdAt: first.createdAt,
  });
  expect(await row(created.id)).toMatchObject({
    status: "OPEN",
    completedAt: null,
    cancelledAt: null,
  });
  const persisted = (await reports(created.id))[0];
  expect(persisted.userId).toBe(original.userId);
  expect(persisted.correctedById).toBe(fixture.head.id);
  expect(persisted.correctedAt?.toISOString()).toBe(instant.toISOString());
  expect(persisted.correctionReason).toBe("Marked complete by mistake");
  await expect(
    progress.submitTaskProgress(employee, created.id, completed),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    progress.correctTaskProgress(head, created.id, first.id, {
      ...incomplete,
      correctionReason: "Same status",
    }),
  ).rejects.toMatchObject({ status: 409 });
  instant = new Date("2026-09-19T08:00:00Z");
  const second = await progress.submitTaskProgress(
    employee,
    created.id,
    completed,
  );
  await expect(
    progress.correctTaskProgress(head, created.id, first.id, {
      status: "COMPLETED",
      correctionReason: "Older",
    }),
  ).rejects.toMatchObject({ status: 409 });
  await progress.correctTaskProgress(head, created.id, second.id, {
    ...incomplete,
    correctionReason: "Latest mistake",
  });
  instant = new Date("2026-09-19T09:00:00Z");
  await progress.correctTaskProgress(head, created.id, second.id, {
    status: "COMPLETED",
    correctionReason: "Verified complete",
  });
  expect((await row(created.id)).completedAt?.toISOString()).toBe(
    instant.toISOString(),
  );
  await expect(
    progress.correctTaskProgress(head, created.id, second.id, {
      status: "COMPLETED",
      correctionReason: "No-op",
    }),
  ).rejects.toMatchObject({ status: 409 });
  const audits = await events(created.id);
  expect(
    audits.filter((value) => value.action === "CORRECT_TASK_PROGRESS"),
  ).toHaveLength(3);
  expect(JSON.stringify(audits)).toContain("Marked complete by mistake");
  expect(JSON.stringify(audits)).not.toContain(fixture.password);
});
it("CANCELLED/deleted/banned actors are blocked, progress reads inherit Task visibility and no correction undoes cancellation", async () => {
  const cancelled = await create();
  const report = await progress.submitTaskProgress(
    employee,
    cancelled.id,
    incomplete,
  );
  await tasks.cancelTask(head, cancelled.id, {});
  await expect(
    progress.submitTaskProgress(employee, cancelled.id, completed),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    progress.correctTaskProgress(head, cancelled.id, report.id, {
      status: "COMPLETED",
      correctionReason: "Cannot undo cancel",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect((await progress.getTaskProgress(head, cancelled.id)).canCorrect).toBe(
    false,
  );
  await tasks.softDeleteTask(head, cancelled.id, {});
  for (const actor of [head, deputy, employee])
    await expect(
      progress.getTaskProgressHistory(actor, cancelled.id),
    ).rejects.toMatchObject({ status: 404 });
  expect((await boundary(cancelled.id, completed)).status).toBe(404);
  expect(
    (
      await boundary(
        cancelled.id,
        { status: "COMPLETED", correctionReason: "Deleted" },
        head,
        report.id,
      )
    ).status,
  ).toBe(404);
  expect(await reports(cancelled.id)).toHaveLength(1);
  const rollback = new Error("rollback banned actor fixture");
  await expect(
    fixture.db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, fixture.employee.id));
      await expect(
        progressService(tx, fixture.env).getTaskProgress(
          employee,
          cancelled.id,
        ),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        progressService(tx, fixture.env).submitTaskProgress(
          employee,
          cancelled.id,
          completed,
        ),
      ).rejects.toMatchObject({ status: 401 });
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});
it("real audit/task failures roll back completion, non-completion and correction without orphan history or changed lifecycle", async () => {
  const rollback = new Error("rollback progress trigger instrumentation");
  await expect(
    fixture.db.transaction(async (tx) => {
      const localTasks = taskService(tx, fixture.env),
        local = progressService(tx, fixture.env, () => instant);
      const created = await localTasks.createTask(head, {
        title: `Rollback ${randomUUID()}`,
        assignedToId: fixture.employee.id,
        assignedDate: "2026-09-18",
      });
      await tx.execute(
        sql`CREATE FUNCTION pg_temp.kig_phase4_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action=current_setting('kig.phase4_fail_audit',true) THEN RAISE EXCEPTION 'Injected progress audit rejection' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`,
      );
      await tx.execute(
        sql`CREATE TRIGGER kig_phase4_fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.kig_phase4_fail_audit()`,
      );
      await tx.execute(
        sql`CREATE FUNCTION pg_temp.kig_phase4_fail_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_setting('kig.phase4_fail_task',true)='on' THEN RAISE EXCEPTION 'Injected progress task rejection' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`,
      );
      await tx.execute(
        sql`CREATE TRIGGER kig_phase4_fail_task BEFORE UPDATE ON task FOR EACH ROW EXECUTE FUNCTION pg_temp.kig_phase4_fail_task()`,
      );
      const state = async () => ({
        task: (await tx.select().from(task).where(eq(task.id, created.id)))[0],
        reports: await tx
          .select()
          .from(taskDailyUpdate)
          .where(eq(taskDailyUpdate.taskId, created.id)),
        audits: await tx
          .select()
          .from(auditLog)
          .where(eq(auditLog.entityId, created.id)),
      });
      const initial = await state();
      for (const action of ["MARK_TASK_COMPLETED", "MARK_TASK_NOT_COMPLETED"]) {
        await tx.execute(
          sql`SELECT set_config('kig.phase4_fail_audit',${action},true)`,
        );
        await expect(
          local.submitTaskProgress(
            employee,
            created.id,
            action === "MARK_TASK_COMPLETED" ? completed : incomplete,
          ),
        ).rejects.toBeDefined();
        expect(await state()).toEqual(initial);
      }
      await tx.execute(
        sql`SELECT set_config('kig.phase4_fail_audit','',true),set_config('kig.phase4_fail_task','on',true)`,
      );
      await expect(
        local.submitTaskProgress(employee, created.id, completed),
      ).rejects.toBeDefined();
      expect(await state()).toEqual(initial);
      await tx.execute(sql`SELECT set_config('kig.phase4_fail_task','',true)`);
      const report = await local.submitTaskProgress(
        employee,
        created.id,
        completed,
      );
      const original = await state();
      await tx.execute(
        sql`SELECT set_config('kig.phase4_fail_audit','CORRECT_TASK_PROGRESS',true)`,
      );
      await expect(
        local.correctTaskProgress(head, created.id, report.id, {
          ...incomplete,
          correctionReason: "Mistake",
        }),
      ).rejects.toBeDefined();
      expect(await state()).toEqual(original);
      await tx.execute(
        sql`SELECT set_config('kig.phase4_fail_audit','',true),set_config('kig.phase4_fail_task','on',true)`,
      );
      await expect(
        local.correctTaskProgress(head, created.id, report.id, {
          ...incomplete,
          correctionReason: "Mistake",
        }),
      ).rejects.toBeDefined();
      expect(await state()).toEqual(original);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});
it("simultaneous same-date submissions have one success, one controlled conflict, one official row and matching audit/lifecycle", async () => {
  for (const body of [completed, incomplete]) {
    const created = await create();
    const results = await Promise.allSettled([
      progress.submitTaskProgress(employee, created.id, body),
      progress.submitTaskProgress(employee, created.id, body),
    ]);
    expect(
      results.filter((value) => value.status === "fulfilled"),
    ).toHaveLength(1);
    const failure = results.find((value) => value.status === "rejected");
    expect(
      failure?.status === "rejected" ? failure.reason : null,
    ).toMatchObject({ status: 409 });
    expect(await reports(created.id)).toHaveLength(1);
    expect(await events(created.id)).toHaveLength(1);
    expect((await row(created.id)).status).toBe(
      body.status === "COMPLETED" ? "COMPLETED" : "OPEN",
    );
  }
});
it("competing completion/cancellation and completion/reassignment serialize in both commit orders and reject stale actor/lifecycle", async () => {
  for (const competing of ["cancel", "reassign"] as const)
    for (const completionFirst of [true, false]) {
      const created = await create();
      let signal!: () => void, release!: () => void;
      const locked = new Promise<void>((resolve) => {
        signal = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const winner = fixture.db.transaction(async (tx) => {
        if (completionFirst)
          await progressService(
            tx,
            fixture.env,
            () => instant,
          ).submitTaskProgress(employee, created.id, completed);
        else if (competing === "cancel")
          await taskService(tx, fixture.env).cancelTask(head, created.id, {});
        else
          await taskService(tx, fixture.env).reassignTask(head, created.id, {
            assignedToId: fixture.employeeB.id,
          });
        signal();
        await held;
      });
      let loser: Promise<number> | undefined;
      try {
        await locked;
        loser = (
          completionFirst
            ? competing === "cancel"
              ? tasks.cancelTask(head, created.id, {})
              : tasks.reassignTask(head, created.id, {
                  assignedToId: fixture.employeeB.id,
                })
            : progress.submitTaskProgress(employee, created.id, completed)
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
        expect(waiting).toBe(true);
        release();
        await winner;
        expect(await loser).toBe(
          !completionFirst && competing === "reassign" ? 404 : 409,
        );
        const parent = await row(created.id);
        expect(parent.status).toBe(
          completionFirst
            ? "COMPLETED"
            : competing === "cancel"
              ? "CANCELLED"
              : "OPEN",
        );
        expect(await reports(created.id)).toHaveLength(completionFirst ? 1 : 0);
        expect(await events(created.id)).toHaveLength(completionFirst ? 1 : 0);
        if (completionFirst) expect(parent.cancelledAt).toBeNull();
        else expect(parent.completedAt).toBeNull();
      } finally {
        release();
        await winner;
        if (loser) await loser;
      }
    }
});
