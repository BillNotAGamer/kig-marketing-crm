import { test as base, expect, type Page } from "@playwright/test";
import { authFixtures } from "../src/test/auth-fixtures";
import { taskService } from "../src/lib/tasks/service";
import { createAuth } from "../src/lib/auth/factory";

const test = base.extend<{ data: Awaited<ReturnType<typeof authFixtures>> }>({
  data: async ({}, provide) => {
    const data = await authFixtures("phase3");
    try {
      await provide(data);
    } finally {
      await data.cleanup();
    }
  },
});
test.use({ trace: "off" }); // Never record credential-bearing login requests.
test.setTimeout(120_000);
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
async function create(page: Page, title: string, assignedToId?: string) {
  await page.goto("/tasks/new");
  const form = page.getByRole("form", { name: "Create task", exact: true });
  await form.getByLabel("Title", { exact: true }).fill(title);
  await form
    .getByLabel("Description")
    .fill("A responsive, isolated task fixture.");
  if (assignedToId)
    await form
      .getByLabel("Assignee", { exact: true })
      .selectOption(assignedToId);
  await form.getByLabel("Assigned date", { exact: true }).fill("2026-09-18");
  await form.getByLabel("Due date (optional)").fill("2026-09-20");
  await form.getByLabel("Priority", { exact: true }).selectOption("HIGH");
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === "/api/tasks" &&
      value.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Create task", exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const task = await saved.json();
  await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  return task.id as string;
}
async function command(page: Page, name: string, path: string) {
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === path &&
      value.request().method() === "POST",
  );
  await page.getByRole("button", { name, exact: true }).click();
  expect((await response).status()).toBe(200);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("HEAD creates, edits, reassigns, cancels and soft-deletes with intentional desktop/mobile themes", async ({
  page,
  data,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", () => errors.push("Unexpected browser page error"));
  page.on("console", (value) => {
    if (value.type() === "error")
      errors.push("Unexpected browser console error");
  });
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, data.head.email, data.password);
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.goto("/tasks/new");
  await expect(
    page
      .getByLabel("Assignee", { exact: true })
      .getByRole("option", { name: /INACTIVE/ }),
  ).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("task-create-light.png"),
    fullPage: true,
  });
  const title = `${data.prefix}Campaign brief`;
  const id = await create(page, title, data.employee.id);
  const origin = new URL(data.env.BETTER_AUTH_URL).origin;
  expect(
    (
      await page.request.post(`/api/tasks/${id}/metadata`, {
        headers: { origin },
        data: {
          title,
          description: null,
          assignedDate: "2026-09-18",
          dueDate: null,
          priority: "NORMAL",
          status: "COMPLETED",
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post(`/api/tasks/${id}/complete`, {
        headers: { origin },
        data: { status: "COMPLETED" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.delete(`/api/tasks/${id}`, { headers: { origin } })
    ).status(),
  ).toBe(405);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("task-detail-dark.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Back to tasks", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("task-list-light.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: title, exact: true }).click();
  await page.getByRole("link", { name: "Edit task", exact: true }).click();
  const edited = `${data.prefix}Revised brief`;
  await page.getByLabel("Title", { exact: true }).fill(edited);
  await command(page, "Save task", `/api/tasks/${id}/metadata`);
  await expect(
    page.getByRole("heading", { name: edited, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("New assignee", { exact: true })
    .selectOption(data.employeeB.id);
  await command(page, "Reassign task", `/api/tasks/${id}/reassign`);
  await expect(
    page.getByText("Fixture EMPLOYEE B", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel task", exact: true }).click();
  await command(page, "Confirm cancellation", `/api/tasks/${id}/cancel`);
  await expect(
    page.getByText("CANCELLED · HIGH", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit task", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reassign task", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await command(page, "Confirm deletion", `/api/tasks/${id}/soft-delete`);
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(
    page.getByRole("link", { name: edited, exact: true }),
  ).toHaveCount(0);
  const retained = await data.db.query.task.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  expect(retained?.deletedAt).not.toBeNull();
  expect(retained?.status).toBe("CANCELLED");
  expect(errors).toEqual([]);
});

test("DEPUTY assigns employee work, EMPLOYEE creates personal work and resource bypasses disclose no task", async ({
  page,
  data,
}) => {
  await login(page, data.deputy.email, data.password);
  await page.goto("/tasks/new");
  const selector = page.getByLabel("Assignee", { exact: true });
  await expect(
    selector.getByRole("option", { name: /HEAD|DEPUTY B|INACTIVE/ }),
  ).toHaveCount(0);
  const assignedTitle = `${data.prefix}Team assignment`;
  const assigned = await create(page, assignedTitle, data.employee.id);
  await expect(
    page.getByRole("region", { name: "Task administration" }),
  ).toHaveCount(0);
  for (const name of [
    "Edit task",
    "Reassign task",
    "Cancel task",
    "Delete task",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  const origin = new URL(data.env.BETTER_AUTH_URL).origin;
  expect(
    (
      await page.request.post(`/api/tasks/${assigned}/cancel`, {
        headers: { origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/tasks/${assigned}/edit`);
  await expect(page).toHaveURL(/\/access-denied$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, data.employee.email, data.password);
  await page.goto("/tasks");
  await expect(
    page.getByRole("link", { name: assignedTitle, exact: true }),
  ).toBeVisible();
  await page.goto("/tasks/new");
  await expect(
    page.getByRole("combobox", { name: "Assignee", exact: true }),
  ).toHaveCount(0);
  const personalTitle = `${data.prefix}Personal work`;
  await create(page, personalTitle);
  expect(
    (
      await page.request.post("/api/tasks", {
        headers: { origin },
        data: {
          title: "Denied other assignment",
          assignedDate: "2026-09-18",
          assignedToId: data.employeeB.id,
        },
      })
    ).status(),
  ).toBe(403);
  await expect(
    page.getByText("Self-created task", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  const auth = createAuth(data.db, data.env);
  const response = await auth.api.signInEmail({
    body: { email: data.head.email, password: data.password },
    asResponse: true,
  });
  const headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  });
  const service = taskService(data.db, data.env);
  const foreign = await service.createTask(headers, {
    title: `${data.prefix}Private other employee`,
    description: null,
    assignedDate: "2026-09-18",
    dueDate: null,
    priority: "NORMAL",
    assignedToId: data.employeeB.id,
  });
  await page.goto("/tasks");
  await expect(
    page.getByRole("link", { name: foreign.title, exact: true }),
  ).toHaveCount(0);
  const result = await page.goto(`/tasks/${foreign.id}`);
  expect(result?.status()).toBe(404);
  await expect(page.getByText(foreign.title, { exact: true })).toHaveCount(0);
  expect((await page.request.get(`/api/tasks/${foreign.id}`)).status()).toBe(
    404,
  );
  await page.goto("/tasks");
  await noOverflow(page);
});
