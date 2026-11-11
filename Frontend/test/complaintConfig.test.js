import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSIGNED_PAGE_SIZE,
  assignedFilterStatuses,
  assignedFilters,
  closedStatuses,
  departments,
  formatDate,
  formatStatus,
  statusStyles,
} from "../src/utils/complaintConfig.js";

test("complaint filters classify current, resolved, and other closed statuses", () => {
  assert.deepEqual(assignedFilterStatuses.current, [
    "Assigned", "Under_Review", "In_Progress", "On_Hold", "Reopened",
  ]);
  assert.deepEqual(assignedFilterStatuses.resolved, ["Resolved"]);
  assert.deepEqual(assignedFilterStatuses.closed, ["Rejected", "Closed", "Withdrawn"]);
  assert.deepEqual(closedStatuses, ["Resolved", "Rejected", "Closed", "Withdrawn"]);
  assert.deepEqual(assignedFilters.map(({ id }) => id), ["current", "resolved", "closed"]);
});

test("shared complaint display configuration covers departments, page size, and status badges", () => {
  assert.equal(ASSIGNED_PAGE_SIZE, 6);
  assert.ok(departments.includes("Electrical Maintenance"));
  assert.equal(statusStyles.Resolved, "bg-emerald-50 text-emerald-700");
  assert.ok(statusStyles.Submitted);
});

test("formats complaint status labels and handles missing or invalid dates", () => {
  assert.equal(formatStatus("In_Progress"), "In Progress");
  assert.equal(formatStatus(undefined), "Submitted");
  assert.equal(formatDate(undefined), "Date unavailable");
  assert.equal(formatDate("not-a-date"), "Date unavailable");
  assert.notEqual(formatDate("2026-01-02T03:04:00.000Z"), "Date unavailable");
});
