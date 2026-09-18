import { test as base, expect, type Page } from "@playwright/test";
import { authFixtures } from "../src/test/auth-fixtures";
import { createAuth } from "../src/lib/auth/factory";
import { taskService } from "../src/lib/tasks/service";
import { setTimeout as cooldown } from "node:timers/promises";

const test = base.extend<{ data: Awaited<ReturnType<typeof authFixtures>> }>({
  data: async ({}, provide) => {
    const data = await authFixtures("phase5");
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
      assignedDate: "2026-09-19",
    }),
    headers,
    service,
  };
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("HEAD attaches Drive Asset, previews in modal, verifies fallback, and removes asset", async ({
  page,
  data,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const taskSeed = await seed(
    data,
    data.employee.id,
    `${data.prefix}Campaign deliverables`,
  );

  await login(page, data.head.email, data.password);
  await page.goto(`/tasks/${taskSeed.task.id}`);

  await expect(
    page.getByText("Sản phẩm / Deliverables", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Chưa có sản phẩm nào được đính kèm.", { exact: true }),
  ).toBeVisible();

  // Click + Thêm sản phẩm
  await page
    .getByRole("button", { name: "+ Thêm sản phẩm", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thêm sản phẩm từ Google Drive" }),
  ).toBeVisible();

  // Fill Drive URL
  await page
    .getByLabel("Google Drive URL", { exact: true })
    .fill("https://drive.google.com/file/d/file-doc-1/view");

  const addResponse = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname ===
        `/api/tasks/${taskSeed.task.id}/assets` &&
      value.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Lưu sản phẩm", exact: true }).click();
  expect((await addResponse).status()).toBe(201);

  // Deliverable card appears
  await expect(page.getByText("Q3 Campaign Brief.docx")).toBeVisible();
  await expect(page.getByText("DOCUMENT")).toBeVisible();
  await expect(page.getByText("Google Drive", { exact: true })).toBeVisible();

  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("assets-detail-light.png"),
  });

  // Test preview modal
  await page.getByRole("button", { name: "Xem trước", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Q3 Campaign Brief.docx" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mở trên Google Drive ↗" }),
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("asset-preview-dialog-light.png"),
  });

  // Close preview dialog via Đóng button
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Q3 Campaign Brief.docx" }),
  ).toHaveCount(0);

  // Switch to Dark theme and verify visual appearance
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("assets-detail-dark.png"),
    fullPage: true,
  });

  // Switch back to Light
  await page.getByRole("button", { name: "Light", exact: true }).click();

  // Remove asset
  await page.getByRole("button", { name: "Gỡ bỏ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Xác nhận gỡ bỏ sản phẩm" }),
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("asset-remove-dialog.png"),
  });

  const removeResponse = page.waitForResponse(
    (value) =>
      value.url().includes(`/api/tasks/${taskSeed.task.id}/assets/`) &&
      value.url().endsWith("/remove") &&
      value.request().method() === "POST",
  );

  await page
    .getByRole("button", { name: "Xác nhận gỡ bỏ", exact: true })
    .click();
  expect((await removeResponse).status()).toBe(200);

  await expect(
    page.getByText("Chưa có sản phẩm nào được đính kèm.", { exact: true }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("Employee attaches deliverable to own OPEN task, duplicate rejected, foreign attachment denied", async ({
  page,
  data,
}) => {
  const ownTask = await seed(
    data,
    data.employee.id,
    `${data.prefix}Employee Own Task`,
  );
  const otherTask = await seed(
    data,
    data.employeeB.id,
    `${data.prefix}Employee B Task`,
  );
  const cancelledTask = await seed(
    data,
    data.employee.id,
    `${data.prefix}Cancelled Task`,
  );
  await cancelledTask.service.cancelTask(
    cancelledTask.headers,
    cancelledTask.task.id,
    {},
  );

  await login(page, data.employee.email, data.password);

  // 1. Employee opens own OPEN task and attaches asset
  await page.goto(`/tasks/${ownTask.task.id}`);
  await page
    .getByRole("button", { name: "+ Thêm sản phẩm", exact: true })
    .click();
  await page
    .getByLabel("Google Drive URL", { exact: true })
    .fill("https://drive.google.com/file/d/file-image-1/view");

  const postResponse = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname ===
        `/api/tasks/${ownTask.task.id}/assets` &&
      value.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu sản phẩm", exact: true }).click();
  expect((await postResponse).status()).toBe(201);

  await expect(page.getByText("Hero Banner.png")).toBeVisible();
  await expect(page.getByText("IMAGE")).toBeVisible();

  // 2. Attempt duplicate attach on same task -> rejected with 409
  await page
    .getByRole("button", { name: "+ Thêm sản phẩm", exact: true })
    .click();
  await page
    .getByLabel("Google Drive URL", { exact: true })
    .fill("https://drive.google.com/file/d/file-image-1/view");

  const dupResponse = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname ===
        `/api/tasks/${ownTask.task.id}/assets` &&
      value.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu sản phẩm", exact: true }).click();
  expect((await dupResponse).status()).toBe(409);
  await expect(page.getByRole("alert")).toContainText("already attached");

  // Close modal
  await page.keyboard.press("Escape");

  // 3. Foreign task read denial: Employee cannot access Employee B's task
  const foreignResult = await page.goto(`/tasks/${otherTask.task.id}`);
  expect(foreignResult?.status()).toBe(404);

  // Direct API request to attach to foreign task fails with 403 or 404
  const foreignAttach = await page.request.post(
    `/api/tasks/${otherTask.task.id}/assets`,
    {
      headers: { origin: data.env.BETTER_AUTH_URL },
      data: { sourceUrl: "https://drive.google.com/file/d/file-pdf-1/view" },
    },
  );
  expect([403, 404]).toContain(foreignAttach.status());

  // 4. CANCELLED task: Employee does not see + Thêm sản phẩm
  await page.goto(`/tasks/${cancelledTask.task.id}`);
  await expect(
    page.getByRole("button", { name: "+ Thêm sản phẩm", exact: true }),
  ).toHaveCount(0);

  // Direct API request to attach to CANCELLED task returns 403
  const cancelledAttach = await page.request.post(
    `/api/tasks/${cancelledTask.task.id}/assets`,
    {
      headers: { origin: data.env.BETTER_AUTH_URL },
      data: { sourceUrl: "https://drive.google.com/file/d/file-pdf-1/view" },
    },
  );
  expect(cancelledAttach.status()).toBe(403);
});
