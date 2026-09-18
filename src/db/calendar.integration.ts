import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { authFixtures } from "../test/auth-fixtures";
import { createAuth } from "../lib/auth/factory";
import { taskService } from "../lib/tasks/service";
import { calendarService } from "../lib/calendar/service";
import { calendarHttp } from "../lib/calendar/http";
import { deriveDateMarkers } from "../lib/calendar/model";

let fixture: Awaited<ReturnType<typeof authFixtures>>;
let tasks: ReturnType<typeof taskService>;
let calendar: ReturnType<typeof calendarService>;
let head: Headers;
let deputy: Headers;
let employee: Headers;
let employeeB: Headers;

beforeAll(async () => {
  fixture = await authFixtures("phase6");
  tasks = taskService(fixture.db, fixture.env);
  calendar = calendarService(fixture.db, fixture.env);

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

it("proves role-correct calendar query authorization and employee isolation", async () => {
  const taskA = await tasks.createTask(head, {
    title: `Employee A Work ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-10",
    dueDate: "2026-09-15",
  });

  const taskB = await tasks.createTask(head, {
    title: `Employee B Work ${randomUUID()}`,
    assignedToId: fixture.employeeB.id,
    assignedDate: "2026-09-12",
    dueDate: "2026-09-18",
  });

  // 1. HEAD sees all team tasks
  const headResult = await calendar.listCalendarTasks(head, {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  const headIds = headResult.tasks.map((t) => t.id);
  expect(headIds).toContain(taskA.id);
  expect(headIds).toContain(taskB.id);

  // 2. DEPUTY sees all team tasks
  const deputyResult = await calendar.listCalendarTasks(deputy, {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  const deputyIds = deputyResult.tasks.map((t) => t.id);
  expect(deputyIds).toContain(taskA.id);
  expect(deputyIds).toContain(taskB.id);

  // 3. EMPLOYEE A sees only own task, never employee B's task
  const empAResult = await calendar.listCalendarTasks(employee, {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  const empAIds = empAResult.tasks.map((t) => t.id);
  expect(empAIds).toContain(taskA.id);
  expect(empAIds).not.toContain(taskB.id);

  // 4. EMPLOYEE B sees only own task, never employee A's task
  const empBResult = await calendar.listCalendarTasks(employeeB, {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  const empBIds = empBResult.tasks.map((t) => t.id);
  expect(empBIds).toContain(taskB.id);
  expect(empBIds).not.toContain(taskA.id);
});

it("excludes soft-deleted tasks from calendar queries", async () => {
  const taskToDelete = await tasks.createTask(head, {
    title: `To Delete ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-14",
    dueDate: "2026-09-16",
  });

  // Verify it initially appears
  const before = await calendar.listCalendarTasks(head, {
    from: "2026-09-10",
    to: "2026-09-20",
  });
  expect(before.tasks.map((t) => t.id)).toContain(taskToDelete.id);

  // Soft delete the task
  await tasks.softDeleteTask(head, taskToDelete.id, {});

  // Verify it is completely excluded for both HEAD and EMPLOYEE
  const afterHead = await calendar.listCalendarTasks(head, {
    from: "2026-09-10",
    to: "2026-09-20",
  });
  expect(afterHead.tasks.map((t) => t.id)).not.toContain(taskToDelete.id);

  const afterEmp = await calendar.listCalendarTasks(employee, {
    from: "2026-09-10",
    to: "2026-09-20",
  });
  expect(afterEmp.tasks.map((t) => t.id)).not.toContain(taskToDelete.id);
});

it("filters date range boundaries accurately", async () => {
  // Query range: 2026-09-10 to 2026-09-20
  const range = { from: "2026-09-10", to: "2026-09-20" };

  // Task 1: assigned out (earlier), due in
  const task1 = await tasks.createTask(head, {
    title: `Assigned Out Due In ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-05",
    dueDate: "2026-09-12",
  });

  // Task 2: assigned in, due out (later)
  const task2 = await tasks.createTask(head, {
    title: `Assigned In Due Out ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-18",
    dueDate: "2026-09-25",
  });

  // Task 3: both dates outside earlier
  const task3 = await tasks.createTask(head, {
    title: `Both Earlier ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-01",
    dueDate: "2026-09-07",
  });

  // Task 4: both dates outside later
  const task4 = await tasks.createTask(head, {
    title: `Both Later ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-22",
    dueDate: "2026-09-28",
  });

  // Task 5: assigned in, no due date
  const task5 = await tasks.createTask(head, {
    title: `No Due Date In ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-14",
  });

  const result = await calendar.listCalendarTasks(head, range);
  const ids = result.tasks.map((t) => t.id);

  expect(ids).toContain(task1.id);
  expect(ids).toContain(task2.id);
  expect(ids).not.toContain(task3.id);
  expect(ids).not.toContain(task4.id);
  expect(ids).toContain(task5.id);
});

it("returns single record when assignedDate === dueDate and deduplicates markers", async () => {
  const sameDate = "2026-09-15";
  const sameDayTask = await tasks.createTask(head, {
    title: `Same Day Task ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: sameDate,
    dueDate: sameDate,
  });

  const result = await calendar.listCalendarTasks(head, {
    from: "2026-09-10",
    to: "2026-09-20",
  });

  const matchingTasks = result.tasks.filter((t) => t.id === sameDayTask.id);
  expect(matchingTasks).toHaveLength(1);

  // Deriving markers on that date produces 1 BOTH marker
  const markers = deriveDateMarkers(result.tasks, sameDate, "2026-09-19");
  const taskMarker = markers.find((m) => m.task.id === sameDayTask.id);
  expect(taskMarker).toBeDefined();
  expect(taskMarker?.markerType).toBe("BOTH");
});

it("preserves COMPLETED and CANCELLED non-deleted tasks in calendar query", async () => {
  const taskToCancel = await tasks.createTask(head, {
    title: `Cancelled Task ${randomUUID()}`,
    assignedToId: fixture.employee.id,
    assignedDate: "2026-09-11",
  });
  await tasks.cancelTask(head, taskToCancel.id, {});

  const result = await calendar.listCalendarTasks(head, {
    from: "2026-09-10",
    to: "2026-09-20",
  });

  const cancelled = result.tasks.find((t) => t.id === taskToCancel.id);
  expect(cancelled).toBeDefined();
  expect(cancelled?.status).toBe("CANCELLED");
});

it("enforces strict query validation at the HTTP boundary", async () => {
  // 1. Valid request -> 200
  const validReq = new Request(
    "http://127.0.0.1:3000/api/calendar?from=2026-09-01&to=2026-09-30",
    {
      method: "GET",
      headers: head,
    },
  );
  const validRes = await calendarHttp(validReq, calendar);
  expect(validRes.status).toBe(200);
  expect(validRes.headers.get("Cache-Control")).toBe("no-store");

  // 2. Missing/malformed parameters -> 400
  const malformedReq = new Request(
    "http://127.0.0.1:3000/api/calendar?from=not-a-date&to=2026-09-30",
    {
      method: "GET",
      headers: head,
    },
  );
  const malformedRes = await calendarHttp(malformedReq, calendar);
  expect(malformedRes.status).toBe(400);

  // 3. from > to -> 400
  const reversedReq = new Request(
    "http://127.0.0.1:3000/api/calendar?from=2026-09-30&to=2026-09-01",
    {
      method: "GET",
      headers: head,
    },
  );
  const reversedRes = await calendarHttp(reversedReq, calendar);
  expect(reversedRes.status).toBe(400);

  // 4. range > 62 days -> 400
  const oversizedReq = new Request(
    "http://127.0.0.1:3000/api/calendar?from=2026-08-01&to=2026-11-01",
    {
      method: "GET",
      headers: head,
    },
  );
  const oversizedRes = await calendarHttp(oversizedReq, calendar);
  expect(oversizedRes.status).toBe(400);

  // 5. Method not allowed (POST) -> 405
  const postReq = new Request(
    "http://127.0.0.1:3000/api/calendar?from=2026-09-01&to=2026-09-30",
    {
      method: "POST",
      headers: head,
    },
  );
  const postRes = await calendarHttp(postReq, calendar);
  expect(postRes.status).toBe(405);

  // 6. Unauthorized (no session) -> 401
  const unauthReq = new Request(
    "http://127.0.0.1:3000/api/calendar?from=2026-09-01&to=2026-09-30",
    {
      method: "GET",
    },
  );
  const unauthRes = await calendarHttp(unauthReq, calendar);
  expect(unauthRes.status).toBe(401);
});
