import { test, expect, type Page } from "@playwright/test";

/**
 * E2E: login → role-based landing redirect.
 *
 * Verifies the contract in src/lib/roleRouting.ts:
 *   agency_admin → /dashboard
 *   school_admin → /leads
 *
 * Also verifies that school_admin cannot reach /dashboard directly
 * (RoleRoute should redirect them back to /leads).
 */

const AGENCY_EMAIL = process.env.E2E_AGENCY_EMAIL;
const AGENCY_PASSWORD = process.env.E2E_AGENCY_PASSWORD;
const SCHOOL_EMAIL = process.env.E2E_SCHOOL_EMAIL;
const SCHOOL_PASSWORD = process.env.E2E_SCHOOL_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Parola").fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

test.describe("Role-based post-login routing", () => {
  test.skip(
    !AGENCY_EMAIL || !AGENCY_PASSWORD || !SCHOOL_EMAIL || !SCHOOL_PASSWORD,
    "E2E credentials not provided. Set E2E_AGENCY_EMAIL / E2E_AGENCY_PASSWORD / E2E_SCHOOL_EMAIL / E2E_SCHOOL_PASSWORD.",
  );

  test("agency_admin → /dashboard", async ({ page }) => {
    await login(page, AGENCY_EMAIL!, AGENCY_PASSWORD!);
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/dashboard");
  });

  test("school_admin → /leads", async ({ page }) => {
    await login(page, SCHOOL_EMAIL!, SCHOOL_PASSWORD!);
    await page.waitForURL("**/leads", { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/leads");
  });

  test("school_admin /dashboard erişimi engellenir → /leads", async ({ page }) => {
    await login(page, SCHOOL_EMAIL!, SCHOOL_PASSWORD!);
    await page.waitForURL("**/leads", { timeout: 15_000 });

    await page.goto("/dashboard");
    await page.waitForURL("**/leads", { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/leads");
  });

  test("oturum açmadan korunan rotaya gitmek /login'e yönlendirir", async ({ page }) => {
    // Fresh context: no session.
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
