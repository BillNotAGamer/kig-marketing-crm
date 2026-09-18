import { test as base, expect, type Page } from "@playwright/test";
import { authFixtures } from "../src/test/auth-fixtures";
import { createAuth } from "../src/lib/auth/factory";
import { taskService } from "../src/lib/tasks/service";
import { eq } from "drizzle-orm";
import { setTimeout as cooldown } from "node:timers/promises";
import { taskDailyUpdate } from "../src/db/schema";
const test = base.extend<{ data: Awaited<ReturnType<typeof authFixtures>> }>({
  data: async ({}, provide) => {
    const data = await authFixtures("phase4");
    try {
      await provide(data);
    } finally {
      await data.cleanup();
    }
  },
});
test.use({ trace: "off" });
test.setTimeout(120_000);
// These scenarios authenticate three roles from one loopback IP. Preserve the
// production Better Auth 3-sign-ins/10-second rule before the next retained case.
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
async function seed(
  data: Awaited<ReturnType<typeof authFixtures>>,
  assignee: string,
  title: string,
) {
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
  const service = taskService(data.db, data.env);
  return {
    task: await service.createTask(headers, {
      title,
      assignedToId: assignee,
      assignedDate: "2026-09-18",
    }),
    headers,
    service,
  };
}
async function save(page: Page, path: string, button: string, status: number) {
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === path &&
      value.request().method() === "POST",
  );
  await page.getByRole("button", { name: button, exact: true }).click();
  expect((await response).status()).toBe(status);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("Employee official reports, immutable today/history, completion and HEAD correction are responsive and auditable", async ({
  page,
  data,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const first = await seed(
    data,
    data.employee.id,
    `${data.prefix}Awaiting footage`,
  );
  const second = await seed(
    data,
    data.employee.id,
    `${data.prefix}Finish campaign`,
  );
  const cancelled = await seed(
    data,
    data.employee.id,
    `${data.prefix}Cancelled campaign`,
  );
  await cancelled.service.cancelTask(cancelled.headers, cancelled.task.id, {});
  await login(page, data.employee.email, data.password);
  await page.goto(`/tasks/${first.task.id}`);
  await expect(page.getByText(/Today: .*NOT_REPORTED/)).toBeVisible();
  await page
    .getByRole("button", { name: "Báo cáo tiến độ", exact: true })
    .click();
  await page
    .getByLabel("Report status", { exact: true })
    .selectOption("NOT_COMPLETED");
  await page
    .getByLabel("Incomplete reason", { exact: true })
    .fill("Waiting for Media footage");
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("incomplete-dialog-light.png"),
  });
  await save(page, `/api/tasks/${first.task.id}/progress`, "Gửi báo cáo", 201);
  await expect(
    page.getByText("Đã cập nhật hôm nay", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Waiting for Media footage", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Báo cáo tiến độ", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.post(`/api/tasks/${first.task.id}/progress`, {
        headers: { origin: data.env.BETTER_AUTH_URL },
        data: { status: "COMPLETED" },
      })
    ).status(),
  ).toBe(409);
  await page.goto(`/tasks/${second.task.id}`);
  await page
    .getByRole("button", { name: "Báo cáo tiến độ", exact: true })
    .click();
  await save(page, `/api/tasks/${second.task.id}/progress`, "Gửi báo cáo", 201);
  await expect(
    page.getByText("COMPLETED · NORMAL", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Báo cáo tiến độ", exact: true }),
  ).toHaveCount(0);
  const report = (
    await data.db
      .select()
      .from(taskDailyUpdate)
      .where(eq(taskDailyUpdate.taskId, second.task.id))
  )[0];
  expect(
    (
      await page.request.post(
        `/api/tasks/${second.task.id}/progress/${report.id}/correct`,
        {
          headers: { origin: data.env.BETTER_AUTH_URL },
          data: {
            status: "NOT_COMPLETED",
            reason: "Wrong",
            correctionReason: "Unauthorized",
          },
        },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(`/api/tasks/${second.task.id}/progress`, {
        headers: { origin: data.env.BETTER_AUTH_URL },
        data: { reason: "Edit" },
      })
    ).status(),
  ).toBe(405);
  expect(
    (
      await page.request.delete(`/api/tasks/${second.task.id}/progress`, {
        headers: { origin: data.env.BETTER_AUTH_URL },
      })
    ).status(),
  ).toBe(405);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("completed-detail-dark.png"),
    fullPage: true,
  });
  await page.goto(`/tasks/${cancelled.task.id}`);
  await expect(
    page.getByRole("button", { name: "Báo cáo tiến độ", exact: true }),
  ).toHaveCount(0);
  await logout(page);
  await login(page, data.head.email, data.password);
  await page.goto(`/tasks/${first.task.id}`);
  await expect(
    page.getByText("Waiting for Media footage", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Báo cáo tiến độ", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("detail-history-light.png"),
    fullPage: true,
  });
  await page.goto(`/tasks/${second.task.id}`);
  await page
    .getByRole("button", { name: "Sửa báo cáo hành chính", exact: true })
    .click();
  await page
    .getByLabel("Incomplete reason", { exact: true })
    .fill("Marked complete by mistake");
  await page
    .getByLabel("Correction reason", { exact: true })
    .fill("HEAD verified the missing output");
  await save(
    page,
    `/api/tasks/${second.task.id}/progress/${report.id}/correct`,
    "Save correction",
    200,
  );
  await expect(page.getByText("OPEN · NORMAL", { exact: true })).toBeVisible();
  await expect(page.getByText(/Administratively corrected/)).toBeVisible();
  await expect(
    page.getByText("HEAD verified the missing output", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("corrected-detail-light.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Sửa báo cáo hành chính", exact: true })
    .click();
  await page
    .getByLabel("Correction reason", { exact: true })
    .fill("Delivery now verified");
  await save(
    page,
    `/api/tasks/${second.task.id}/progress/${report.id}/correct`,
    "Save correction",
    200,
  );
  await expect(
    page.getByText("COMPLETED · NORMAL", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("DEPUTY and HEAD self reporting, correction denial and foreign/deleted progress read isolation", async ({
  page,
  data,
}) => {
  const ownDeputy = await seed(
    data,
    data.deputy.id,
    `${data.prefix}Deputy personal`,
  );
  const ownHead = await seed(data, data.head.id, `${data.prefix}HEAD personal`);
  const other = await seed(
    data,
    data.employeeB.id,
    `${data.prefix}Private work`,
  );
  const removed = await seed(
    data,
    data.employee.id,
    `${data.prefix}Removed work`,
  );
  await removed.service.softDeleteTask(removed.headers, removed.task.id, {});
  await login(page, data.deputy.email, data.password);
  await page.goto(`/tasks/${ownDeputy.task.id}`);
  await page
    .getByRole("button", { name: "Báo cáo tiến độ", exact: true })
    .click();
  await save(
    page,
    `/api/tasks/${ownDeputy.task.id}/progress`,
    "Gửi báo cáo",
    201,
  );
  await expect(
    page.getByRole("button", { name: "Sửa báo cáo hành chính", exact: true }),
  ).toHaveCount(0);
  const report = (
    await data.db
      .select()
      .from(taskDailyUpdate)
      .where(eq(taskDailyUpdate.taskId, ownDeputy.task.id))
  )[0];
  expect(
    (
      await page.request.post(
        `/api/tasks/${ownDeputy.task.id}/progress/${report.id}/correct`,
        {
          headers: { origin: data.env.BETTER_AUTH_URL },
          data: {
            status: "NOT_COMPLETED",
            reason: "Wrong",
            correctionReason: "Denied",
          },
        },
      )
    ).status(),
  ).toBe(403);
  await logout(page);
  await login(page, data.head.email, data.password);
  await page.goto(`/tasks/${ownHead.task.id}`);
  await page
    .getByRole("button", { name: "Báo cáo tiến độ", exact: true })
    .click();
  await save(
    page,
    `/api/tasks/${ownHead.task.id}/progress`,
    "Gửi báo cáo",
    201,
  );
  await expect(
    page.getByText("COMPLETED · NORMAL", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await logout(page);
  await login(page, data.employee.email, data.password);
  for (const id of [other.task.id, removed.task.id]) {
    const response = await page.request.get(`/api/tasks/${id}/progress`);
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("Private work");
  }
});
