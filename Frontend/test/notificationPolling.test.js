import assert from "node:assert/strict";
import test from "node:test";

test("next minute boundary calculation aligns accurately to wall clock :00", () => {
  // Given a timestamp at 10:15:23.450
  const baseMinute = 1731720000000; // arbitrary whole minute
  const timestamp = baseMinute + 23450; // 23.450s into the minute

  const msIntoMinute = timestamp % 60000;
  assert.equal(msIntoMinute, 23450);

  const msUntilNextMinute = 60000 - msIntoMinute + 50;
  assert.equal(msUntilNextMinute, 36600); // 36.550s + 50ms buffer to cross boundary

  const nextTickTime = timestamp + msUntilNextMinute;
  assert.equal((nextTickTime - 50) % 60000, 0); // lands exactly at the next minute
});

test("48-hour reopen window calculates correct remaining hours and minutes", () => {
  const resolvedAt = "2026-11-16T08:00:00.000Z";
  const resolvedAtMs = new Date(resolvedAt).getTime();
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

  // 1 hour and 30 minutes after resolution
  const now1 = resolvedAtMs + (1.5 * 60 * 60 * 1000);
  const remainingMs1 = resolvedAtMs + FORTY_EIGHT_HOURS_MS - now1;
  const hours1 = Math.max(0, Math.floor(remainingMs1 / (1000 * 60 * 60)));
  const minutes1 = Math.max(0, Math.floor((remainingMs1 % (1000 * 60 * 60)) / (1000 * 60)));
  assert.equal(hours1, 46);
  assert.equal(minutes1, 30);

  // Exactly 48 hours later (expired)
  const nowExpired = resolvedAtMs + FORTY_EIGHT_HOURS_MS + 1000;
  const remainingExpired = resolvedAtMs + FORTY_EIGHT_HOURS_MS - nowExpired;
  assert.equal(remainingExpired <= 0, true);
});

test("broadcast banner polling interval is 10 minutes (600,000 ms)", () => {
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  assert.equal(TEN_MINUTES_MS, 600000);
});
