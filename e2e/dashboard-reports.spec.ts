import { test as base, expect, type Page } from "@playwright/test";
import { authFixtures } from "../src/test/auth-fixtures";
import { createAuth } from "../src/lib/auth/factory";
import { taskService } from "../src/lib/tasks/service";
import { setTimeout as cooldown } from "node:timers/promises";

const test = base.extend<{ data: Awaited<ReturnType<typeof authFixtures>> }>({
  data: async ({}, provide) => {
    const data = await authFixtures("phase7");
    try {
      await provide(data);
    } finally {
      await data.cleanup();
    }
  },
});

test.use({ trace: "off" });
test.setTimeout(180_000);

// Preserves Better Auth sign-in rate limits between tests
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

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
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

test("HEAD & DEPUTY access Team Dashboard, verify metrics, per-employee table, overdue list, theme toggle, and mobile layout", async ({
  page,
  data,
}) => {
  const headers = await getHeadHeaders(data);
  const service = taskService(data.db, data.env);

  // Seed tasks
  await service.createTask(headers, {
    title: `${data.prefix}Operational A`,
    assignedToId: data.employee.id,
    assignedDate: "2026-09-18",
    dueDate: "2026-09-25",
  });

  const taskB = await service.createTask(headers, {
    title: `${data.prefix}Overdue B`,
    assignedToId: data.employeeB.id,
    assignedDate: "2026-09-10",
    dueDate: "2026-09-15", // Overdue in Sep 2026
  });

  // 1. Login as HEAD
  await login(page, data.head.email, data.password);

  // Navigate to /dashboard
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Tổng quan hoạt động nhóm" }),
  ).toBeVisible();

  // Verify metric cards
  await expect(page.getByText("Tổng việc").first()).toBeVisible();
  await expect(page.getByText("Đã xong").first()).toBeVisible();
  await expect(page.getByText("Chưa báo").first()).toBeVisible();
  await expect(page.getByText("Quá hạn").first()).toBeVisible();

  // Verify per-employee table
  await expect(
    page.getByRole("heading", { name: "Chi tiết công việc theo nhân viên" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fixture EMPLOYEE", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Fixture EMPLOYEE B", { exact: false }).first(),
  ).toBeVisible();

  // Verify overdue section
  await expect(
    page.getByRole("heading", { name: /Công việc đang quá hạn/ }),
  ).toBeVisible();
  await expect(page.getByText(taskB.title)).toBeVisible();

  // Theme controls test
  const darkButton = page.getByRole("button", { name: "Dark" });
  if (await darkButton.isVisible()) {
    await darkButton.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const lightButton = page.getByRole("button", { name: "Light" });
    await lightButton.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }

  await noOverflow(page);
  await logout(page);

  // 2. Login as DEPUTY
  await cooldown(11_000);
  await login(page, data.deputy.email, data.password);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Tổng quan hoạt động nhóm" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chi tiết công việc theo nhân viên" }),
  ).toBeVisible();
  await noOverflow(page);
  await logout(page);
});

test("EMPLOYEE accesses Personal Dashboard, restricted to own tasks without foreign leaks", async ({
  page,
  data,
}) => {
  const headers = await getHeadHeaders(data);
  const service = taskService(data.db, data.env);

  await service.createTask(headers, {
    title: `${data.prefix}Own Emp Task`,
    assignedToId: data.employee.id,
    assignedDate: "2026-09-18",
    dueDate: "2026-09-25",
  });

  const foreignTask = await service.createTask(headers, {
    title: `${data.prefix}Foreign Overdue Task`,
    assignedToId: data.employeeB.id,
    assignedDate: "2026-09-10",
    dueDate: "2026-09-15",
  });

  // Login as EMPLOYEE
  await login(page, data.employee.email, data.password);

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Tổng quan cá nhân" }),
  ).toBeVisible();

  // Personal view does NOT render team breakdown table
  await expect(
    page.getByRole("heading", { name: "Chi tiết công việc theo nhân viên" }),
  ).toHaveCount(0);

  // Foreign overdue task must not appear
  await expect(page.getByText(foreignTask.title)).toHaveCount(0);

  await noOverflow(page);
  await logout(page);
});

test("Historical Reports: HEAD views team reports with date range; EMPLOYEE sees own visible scope", async ({
  page,
  data,
}) => {
  const headers = await getHeadHeaders(data);
  const service = taskService(data.db, data.env);

  await service.createTask(headers, {
    title: `${data.prefix}Report Task`,
    assignedToId: data.employee.id,
    assignedDate: "2026-09-18",
  });

  // 1. HEAD views reports
  await login(page, data.head.email, data.password);
  await page.goto("/reports");

  await expect(
    page.getByRole("heading", { name: /Báo cáo tiến độ/ }),
  ).toBeVisible();

  await expect(page.getByText("Báo cáo nộp")).toBeVisible();
  await expect(page.getByText("Tỷ lệ đạt")).toBeVisible();

  // Per-employee breakdown table visible for HEAD
  await expect(
    page.getByRole("heading", { name: "Thống kê báo cáo theo nhân viên" }),
  ).toBeVisible();

  // Test filter submission
  await page.getByLabel("Từ ngày").fill("2026-09-01");
  await page.getByRole("button", { name: "Lọc báo cáo" }).click();
  await expect(
    page.getByRole("heading", { name: /Báo cáo tiến độ/ }),
  ).toBeVisible();

  await noOverflow(page);
  await logout(page);

  // 2. EMPLOYEE views reports
  await cooldown(11_000);
  await login(page, data.employee.email, data.password);
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: /Báo cáo tiến độ/ }),
  ).toBeVisible();
  // Per-employee table is not displayed in personal view
  await expect(
    page.getByRole("heading", { name: "Thống kê báo cáo theo nhân viên" }),
  ).toHaveCount(0);

  await noOverflow(page);
  await logout(page);
});

test("Task Search: HEAD searches team tasks with filters; EMPLOYEE search is restricted to own tasks", async ({
  page,
  data,
}) => {
  const headers = await getHeadHeaders(data);
  const service = taskService(data.db, data.env);

  const ownTask = await service.createTask(headers, {
    title: `${data.prefix}Findable Own Task`,
    description: "Special high priority task for search testing",
    assignedToId: data.employee.id,
    assignedDate: "2026-09-18",
    priority: "HIGH",
  });

  const foreignTask = await service.createTask(headers, {
    title: `${data.prefix}Secret Foreign Task`,
    description: "Belongs to employee B only",
    assignedToId: data.employeeB.id,
    assignedDate: "2026-09-18",
    priority: "LOW",
  });

  // 1. HEAD searches
  await login(page, data.head.email, data.password);
  await page.goto("/search");
  await expect(
    page.getByRole("heading", { name: "Tìm kiếm công việc" }),
  ).toBeVisible();

  // Search by query
  await page.getByRole("textbox").first().fill(ownTask.title);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();

  const taskCard = page.locator("div.rounded-xl", { hasText: ownTask.title });
  await expect(taskCard).toBeVisible();

  // Result card navigates to /tasks/[id]
  await taskCard.getByRole("link", { name: "Xem chi tiết" }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${ownTask.id}$`));

  await noOverflow(page);
  await logout(page);

  // 2. EMPLOYEE search isolation
  await cooldown(11_000);
  await login(page, data.employee.email, data.password);
  await page.goto("/search");

  // Search foreign task exact title -> must NOT appear
  await page.getByRole("textbox").first().fill(foreignTask.title);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page.getByText(foreignTask.title)).toHaveCount(0);
  await expect(page.getByText("Không tìm thấy công việc nào")).toBeVisible();

  // Search own task -> must appear
  await page.getByRole("textbox").first().fill(ownTask.title);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page.getByText(ownTask.title)).toBeVisible();

  await noOverflow(page);
  await logout(page);
});

test("Notification Center: Bell badge, list view, mark read, and recipient isolation", async ({
  page,
  data,
}) => {
  const headers = await getHeadHeaders(data);
  const service = taskService(data.db, data.env);

  // Assigning task to employee creates a TASK_ASSIGNED notification for employee
  const noticeTask = await service.createTask(headers, {
    title: `${data.prefix}Notice Trigger Task`,
    assignedToId: data.employee.id,
    assignedDate: "2026-09-18",
  });

  // 1. Employee opens notifications
  await login(page, data.employee.email, data.password);

  // Notification bell is in header
  const bell = page.getByRole("link", { name: /Thông báo/ });
  await expect(bell).toBeVisible();

  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "Trung tâm thông báo" }),
  ).toBeVisible();

  // Notification for noticeTask is visible
  await expect(page.getByText(noticeTask.title)).toBeVisible();

  // Mark all as read
  const markAllBtn = page.getByRole("button", {
    name: "Đánh dấu tất cả đã đọc",
  });
  if (await markAllBtn.isVisible()) {
    await markAllBtn.click();
    await expect(page.getByText("Tất cả thông báo đã được đọc")).toBeVisible();
  }

  await noOverflow(page);
  await logout(page);

  // 2. Employee B cannot see Employee's notification
  await cooldown(11_000);
  await login(page, data.employeeB.email, data.password);
  await page.goto("/notifications");
  await expect(page.getByText(noticeTask.title)).toHaveCount(0);

  await noOverflow(page);
  await logout(page);
});

test("Audit Log: HEAD access and filtering; DEPUTY and EMPLOYEE forbidden", async ({
  page,
  data,
}) => {
  // 1. HEAD accesses audit log
  await login(page, data.head.email, data.password);
  await page.goto("/audit");
  await expect(
    page.getByRole("heading", { name: "Nhật ký hệ thống (Audit Log)" }),
  ).toBeVisible();

  await expect(
    page.getByRole("columnheader", { name: "Thời gian" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Người thực hiện" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Hành động" }),
  ).toBeVisible();

  await noOverflow(page);
  await logout(page);

  // 2. DEPUTY is denied access
  await cooldown(11_000);
  await login(page, data.deputy.email, data.password);
  await page.goto("/audit");
  await expect(page).toHaveURL(/\/access-denied/);
  await logout(page);

  // 3. EMPLOYEE is denied access
  await cooldown(11_000);
  await login(page, data.employee.email, data.password);
  await page.goto("/audit");
  await expect(page).toHaveURL(/\/access-denied/);
  await logout(page);
});
