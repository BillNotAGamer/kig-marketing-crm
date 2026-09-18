import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`foundation renders in ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "KIG Marketing CRM" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
