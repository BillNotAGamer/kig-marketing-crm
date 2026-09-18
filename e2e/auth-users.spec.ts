import { test as base, expect, type Page } from "@playwright/test";
import { authFixtures } from "../src/test/auth-fixtures";

const test = base.extend<{
  authData: Awaited<ReturnType<typeof authFixtures>>;
}>({
  authData: async ({}, provide) => {
    const data = await authFixtures();
    try {
      await provide(data);
    } finally {
      await data.cleanup();
    }
  },
});
test.use({ trace: "off" }); // Credential-bearing auth requests must not be captured in traces.
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
test("HEAD manages users through isolated responsive UI and logs out", async ({
  page,
  authData,
}) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, authData.head.email, authData.password);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("link", { name: "User Management" }).click();
  await expect(
    page.getByRole("heading", { name: "User Management" }),
  ).toBeVisible();
  const form = page.getByRole("form", { name: "Create user", exact: true });
  await expect(
    form.getByRole("option", { name: "HEAD", exact: true }),
  ).toHaveCount(0);
  const email = authData.email("ui-created");
  await form.getByLabel("Name", { exact: true }).fill("Browser fixture");
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Initial password").fill(authData.password);
  await form.getByRole("button", { name: "Create user", exact: true }).click();
  const card = page.getByLabel(`User ${email}`, { exact: true });
  await expect(card).toBeVisible();
  const disabled = page.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname.startsWith("/api/users/"),
  );
  await card.getByRole("button", { name: "Disable user", exact: true }).click();
  expect((await disabled).status()).toBe(200);
  await expect(
    card.getByText("EMPLOYEE · INACTIVE", { exact: true }),
  ).toBeVisible();
  const enabled = page.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname.startsWith("/api/users/"),
  );
  await card.getByRole("button", { name: "Enable user", exact: true }).click();
  expect((await enabled).status()).toBe(200);
  await expect(
    card.getByText("EMPLOYEE · ACTIVE", { exact: true }),
  ).toBeVisible();
  await card.getByLabel("Role", { exact: true }).selectOption("DEPUTY");
  const changed = page.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname.startsWith("/api/users/"),
  );
  await card.getByRole("button", { name: "Change role", exact: true }).click();
  expect((await changed).status()).toBe(200);
  await expect(
    card.getByText("DEPUTY · ACTIVE", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login$/);
});
test("EMPLOYEE and DEPUTY cannot open user management", async ({
  page,
  authData,
}) => {
  for (const value of [authData.employee, authData.deputy]) {
    await login(page, value.email, authData.password);
    await expect(
      page.getByRole("link", { name: "User Management" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Change own password" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/users");
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(
      page.getByText("403 · Access denied", { exact: true }),
    ).toBeVisible();
    expect((await page.request.get("/api/users")).status()).toBe(403);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
});
