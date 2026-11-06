import { test, expect } from "@playwright/test";

test.describe("Browser Token-Refresh & 401 Auto-Recovery Cycle", () => {
  test("recovers from 401 by calling /api/auth/token-recreate and replaying request", async ({ page }) => {
    let recreateCount = 0;
    let complaintCalls = 0;

    await page.route("**/api/auth/getMe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "student-refresh-1",
            username: "Pooja Patel",
            email: "pooja@campus.edu",
            role: "student",
            campusId: "STU202",
          },
        }),
      });
    });

    await page.route("**/api/auth/token-recreate", async (route) => {
      recreateCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: `fresh-token-${recreateCount}` }),
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
      complaintCalls += 1;
      const authHeader = route.request().headers()["authorization"];

      // First call simulates an expired token and returns 401
      if (complaintCalls === 1) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Access token expired" }),
        });
        return;
      }

      // Replayed call with the fresh access token succeeds
      expect(authHeader).toContain("Bearer fresh-token-");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          complaints: [
            {
              _id: "c-101",
              complaintTitle: "Library Wi-Fi Connectivity Issue",
              complaintDescription: "Internet drops frequently on the 2nd floor study area.",
              category: "Internet",
              status: "Under_Review",
              location: { building: "Library", room: "204" },
              createdAt: new Date().toISOString(),
            },
          ],
          pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
          counts: { current: 1, resolved: 0 },
        }),
      });
    });

    await page.goto("/student/dashboard");

    // The complaint title should be rendered on the page after auto-refresh
    await expect(page.locator("body")).toContainText("Library Wi-Fi Connectivity Issue");
    expect(complaintCalls).toBeGreaterThanOrEqual(2);
    expect(recreateCount).toBeGreaterThanOrEqual(1);
    // User remains on dashboard without being redirected to /login
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });
});
