import { test, expect } from "@playwright/test";

test.describe("Role-Based Routing & Route Guards", () => {
  test("unauthenticated access to protected dashboard redirects to /login", async ({ page }) => {
    await page.route("**/api/auth/getMe", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
    });

    await page.goto("/student/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("h1")).toContainText(/Good to have you back/i);
  });

  test("student session routes to student dashboard", async ({ page }) => {
    await page.route("**/api/auth/getMe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "student-1",
            username: "Aarav Sharma",
            email: "aarav@campus.edu",
            role: "student",
            campusId: "STU101",
          },
        }),
      });
    });

    await page.route("**/api/auth/token-recreate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "mock-student-token" }),
      });
    });

    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 }),
      });
    });

    await page.route("**/api/student/get-complaint**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          complaints: [],
          pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
          counts: { current: 0, resolved: 0 },
        }),
      });
    });

    await page.goto("/student/dashboard");
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.locator("body")).toContainText(/Aarav Sharma/);
  });

  test("staff session routes to staff dashboard and blocks student dashboard access", async ({ page }) => {
    await page.route("**/api/auth/getMe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "staff-1",
            username: "Vikram Mehta",
            email: "vikram@campus.edu",
            role: "staff",
            campusId: "STAFF501",
          },
        }),
      });
    });

    await page.route("**/api/auth/token-recreate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "mock-staff-token" }),
      });
    });

    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 }),
      });
    });

    await page.route("**/api/staff/assigned-complaints**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          complaints: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
          counts: { current: 0, resolved: 0 },
        }),
      });
    });

    await page.goto("/staff/dashboard");
    await expect(page).toHaveURL(/\/staff\/dashboard/);
    await expect(page.locator("body")).toContainText(/Vikram Mehta/);

    // Visiting student dashboard redirects back to assigned staff dashboard
    await page.goto("/student/dashboard");
    await expect(page).toHaveURL(/\/staff\/dashboard/);
  });

  test("logged-in user visiting /login is redirected to their dashboard", async ({ page }) => {
    await page.route("**/api/auth/getMe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "admin-1",
            username: "Dr. Ananya Roy",
            email: "admin@campus.edu",
            role: "admin",
            campusId: "ADM01",
          },
        }),
      });
    });

    await page.route("**/api/auth/token-recreate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "mock-admin-token" }),
      });
    });

    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 }),
      });
    });

    await page.route("**/api/admin/complaints/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          complaints: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        }),
      });
    });

    await page.goto("/login");
    // PublicOnlyRoute redirects authenticated admin to /admin/dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});
