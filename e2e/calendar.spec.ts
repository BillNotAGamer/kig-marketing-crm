import { test as base, expect, type Page } from "@playwright/test";
import { authFixtures } from "../src/test/auth-fixtures";
import { createAuth } from "../src/lib/auth/factory";
import { taskService } from "../src/lib/tasks/service";
import { setTimeout as cooldown } from "node:timers/promises";

const test = base.extend<{ data: Awaited<ReturnType<typeof authFixtures>> }>({
  data: async ({}, provide) => {
    const data = await authFixtures("phase6");
    try {
      await provide(data);
    } finally {
      await data.cleanup();
    }
  },
});

test.use({ trace: "off" });
test.setTimeout(120_000);

test.afterEach(async () => {
  await cooldown(11_000);
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const response = page.waitForResponse(
    (value) => new URL(value.url()).pathname === "/api/auth/sign-in/email",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);
}

const fixtureHeads = new WeakMap<
  Awaited<ReturnType<typeof authFixtures>>,
  Headers
>();

async function getHeadHeaders(data: Awaited<ReturnType<typeof authFixtures>>) {
  let headers = fixtureHeads.get(data);
  if (!headers) {
    const response = await createAuth(data.db, data.env).api.signInEmail({
      body: { email: data.head.email, password: data.password },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    headers = new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    });
    fixtureHeads.set(data, headers);
  }
  return headers;
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("HEAD interacts with desktop Month and Week views, verifies Monday-first grid, markers, date agenda, and task navigation", async ({
  page,
  data,
}, testInfo) => {
  const headers = await getHeadHeaders(data);
  const service = taskService(data.db, data.env);
  const isDesktop = testInfo.project.name === "desktop-chromium";

  // Seed tasks in September 2026
  const taskSpan = await service.createTask(headers, {
    title: `${data.prefix}Span Task`,
    assignedToId: data.employee.id,
    assignedDate: "2026-09-14", // Monday
    dueDate: "2026-09-18", // Friday
  });

  const taskSameDay = await service.createTask(headers, {
    title: `${data.prefix}Same Day Task`,
    assignedToId: data.employeeB.id,
    assignedDate: "2026-09-15", // Tuesday
    dueDate: "2026-09-15",
  });

  await login(page, data.head.email, data.password);

  // 1. Open /calendar
  await page.goto("/calendar?view=month&date=2026-09-19");
  await expect(
    page.getByRole("heading", { name: "Lịch làm việc" }),
  ).toBeVisible();

  if (isDesktop) {
    const desktop = page.locator(".sm\\:block");

    // 2. Desktop: Verify Monday-first weekday headers
    await expect(desktop.getByText("Thứ 2", { exact: true })).toBeVisible();
    await expect(desktop.getByText("Chủ nhật", { exact: true })).toBeVisible();

    // 3. Verify task markers in month view (on desktop)
    // Check that Span Task appears on 14th and 18th
    await expect(
      desktop.getByTitle(new RegExp(`ASSIGNED: ${taskSpan.title}`)),
    ).toBeVisible();
    await expect(
      desktop.getByTitle(new RegExp(`DUE: ${taskSpan.title}`)),
    ).toBeVisible();

    // Check that intermediate date (e.g. 16th) does NOT show Span Task
    await expect(
      desktop.locator(
        `div[aria-label*="Ngày 16 tháng 9"] [title*="${taskSpan.title}"]`,
      ),
    ).toHaveCount(0);

    // Check that same-day task appears once with BOTH marker
    await expect(
      desktop.getByTitle(new RegExp(`BOTH: ${taskSameDay.title}`)),
    ).toBeVisible();

    // 4. Click a date cell (e.g. 14th) to inspect selected-date agenda
    await desktop.locator('div[aria-label*="Ngày 14 tháng 9"]').click();
    await expect(
      desktop.getByRole("heading", { name: /Agenda:/ }),
    ).toBeVisible();
    await expect(
      desktop.getByRole("link", { name: taskSpan.title }),
    ).toBeVisible();
    await expect(desktop.getByText("Giao", { exact: true })).toBeVisible();
    await expect(
      desktop.getByText("Người phụ trách: Fixture EMPLOYEE"),
    ).toBeVisible();

    // 5. Switch to Week View
    await desktop.getByRole("button", { name: "Tuần" }).click();
    await expect(desktop.getByText("Thứ 2", { exact: true })).toBeVisible();
    await expect(desktop.getByText("Thứ 6", { exact: true })).toBeVisible();

    // Click task link to navigate to Task Detail
    await desktop.getByRole("link", { name: taskSpan.title }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${taskSpan.id}$`));
    await expect(
      page.getByRole("heading", { name: taskSpan.title }),
    ).toBeVisible();
  } else {
    const mobile = page.locator(".sm\\:hidden");

    // Mobile: verify agenda-first presentation
    // Navigate date strip to 14th
    await mobile.locator('button[aria-label*="ngày 14"]').first().click();
    await expect(
      mobile.getByRole("heading", { name: /Agenda:/ }),
    ).toBeVisible();
    await expect(
      mobile.getByRole("link", { name: taskSpan.title }),
    ).toBeVisible();
    await expect(mobile.getByText("Giao", { exact: true })).toBeVisible();

    // Click task link to navigate to Task Detail
    await mobile.getByRole("link", { name: taskSpan.title }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${taskSpan.id}$`));
    await expect(
      page.getByRole("heading", { name: taskSpan.title }),
    ).toBeVisible();
  }

  // 6. Appearance theme verification
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);

  await noOverflow(page);
});

test("Employee Calendar scopes to own tasks only; Mobile agenda-first and Today experience with bottom navigation", async ({
  page,
  data,
}, testInfo) => {
  const headers = await getHeadHeaders(data);
  const service = taskService(data.db, data.env);
  const isDesktop = testInfo.project.name === "desktop-chromium";

  // 1. Seed tasks
  // Task assigned and due today for Employee
  const ownTodayTask = await service.createTask(headers, {
    title: `${data.prefix}Employee Own Today`,
    assignedToId: data.employee.id,
    assignedDate: "2026-09-19",
    dueDate: "2026-09-19",
  });

  // Overdue task for Employee (dueDate in the past)
  const ownOverdueTask = await service.createTask(headers, {
    title: `${data.prefix}Employee Overdue Task`,
    assignedToId: data.employee.id,
    assignedDate: "2026-09-01",
    dueDate: "2026-09-10",
  });

  // Task for Employee B (foreign task)
  const foreignTask = await service.createTask(headers, {
    title: `${data.prefix}Foreign Employee Task`,
    assignedToId: data.employeeB.id,
    assignedDate: "2026-09-19",
    dueDate: "2026-09-19",
  });

  await login(page, data.employee.email, data.password);

  // 2. On /app: Employee Today experience
  await expect(page.getByRole("heading", { name: "Hôm nay" })).toBeVisible();

  // Verify own tasks are present with badges
  await expect(
    page.getByRole("link", { name: ownTodayTask.title }),
  ).toBeVisible();
  await expect(page.getByText("Giao & Hạn hôm nay")).toBeVisible();

  await expect(
    page.getByRole("link", { name: ownOverdueTask.title }),
  ).toBeVisible();
  await expect(page.getByText("Quá hạn", { exact: true })).toBeVisible();

  // Verify foreign task is STRICTLY ABSENT
  await expect(page.getByText(foreignTask.title)).toHaveCount(0);

  // Verify no horizontal overflow
  await noOverflow(page);

  // 3. Navigate to /calendar
  await page.goto("/calendar?date=2026-09-19");
  await expect(
    page.getByRole("heading", { name: "Lịch làm việc" }),
  ).toBeVisible();

  // Verify foreign task is NEVER visible in Employee's calendar
  await expect(page.getByText(foreignTask.title)).toHaveCount(0);

  // 4. Test date navigation on 19th
  if (isDesktop) {
    const desktop = page.locator(".sm\\:block");
    await desktop.locator('div[aria-label*="Ngày 19 tháng 9"]').click();
    await expect(
      desktop.getByRole("link", { name: ownTodayTask.title }),
    ).toBeVisible();
  } else {
    const mobile = page.locator(".sm\\:hidden");
    await mobile.locator('button[aria-label*="ngày 19"]').first().click();
    await expect(
      mobile.getByRole("link", { name: ownTodayTask.title }),
    ).toBeVisible();
  }

  // Click Tasks link in navigation
  await page
    .getByRole("link", { name: /Tasks|Công việc/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/tasks$/);

  // Direct access to foreign task still forbidden
  const foreignResponse = await page.goto(`/tasks/${foreignTask.id}`);
  expect([403, 404]).toContain(foreignResponse?.status());

  await noOverflow(page);
});
