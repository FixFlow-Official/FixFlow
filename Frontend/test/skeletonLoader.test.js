import test from "node:test";
import assert from "node:assert/strict";
import { SKELETON_DEFAULTS, getSkeletonAriaAttributes } from "../src/utils/skeletonConfig.js";

test("skeletonConfig exports valid defaults and ARIA attributes", () => {
  assert.equal(SKELETON_DEFAULTS.cardCount, 3);
  assert.equal(SKELETON_DEFAULTS.tableRows, 4);
  assert.equal(SKELETON_DEFAULTS.tableCols, 5);

  const defaultAttrs = getSkeletonAriaAttributes();
  assert.equal(defaultAttrs.role, "status");
  assert.equal(defaultAttrs["aria-busy"], "true");
  assert.equal(defaultAttrs["aria-label"], "Loading content");

  const customAttrs = getSkeletonAriaAttributes("Loading table rows");
  assert.equal(customAttrs["aria-label"], "Loading table rows");
});
