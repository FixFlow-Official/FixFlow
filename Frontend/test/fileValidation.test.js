import test from "node:test";
import assert from "node:assert/strict";
import { validateImageFile, MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from "../src/utils/fileValidation.js";

test("validateImageFile accepts valid JPEG, PNG, and WebP files", () => {
  const validJpg = { name: "proof.jpg", type: "image/jpeg", size: 1024 * 500 };
  assert.deepEqual(validateImageFile(validJpg), { valid: true, error: null });

  const validPng = { name: "repair.png", type: "image/png", size: 1024 * 1024 * 2 };
  assert.deepEqual(validateImageFile(validPng), { valid: true, error: null });

  const validWebp = { name: "leak.webp", type: "image/webp", size: 1024 * 100 };
  assert.deepEqual(validateImageFile(validWebp), { valid: true, error: null });
});

test("validateImageFile rejects missing or malformed file objects", () => {
  assert.equal(validateImageFile(null).valid, false);
  assert.equal(validateImageFile(undefined).valid, false);
  assert.equal(validateImageFile({}).valid, false);
});

test("validateImageFile rejects files exceeding the 5 MB limit", () => {
  const oversized = {
    name: "huge.jpg",
    type: "image/jpeg",
    size: 5 * 1024 * 1024 + 1,
  };
  const result = validateImageFile(oversized);
  assert.equal(result.valid, false);
  assert.match(result.error, /exceeds the 5 MB size limit/i);
});

test("validateImageFile rejects unsupported file types", () => {
  const pdfFile = { name: "doc.pdf", type: "application/pdf", size: 1024 * 100 };
  assert.equal(validateImageFile(pdfFile).valid, false);

  const gifFile = { name: "anim.gif", type: "image/gif", size: 1024 * 100 };
  assert.equal(validateImageFile(gifFile).valid, false);

  const emptyMime = { name: "unknown", type: "", size: 1024 * 100 };
  assert.equal(validateImageFile(emptyMime).valid, false);
});

test("validateImageFile rejects 0-byte empty files", () => {
  const emptyFile = { name: "empty.jpg", type: "image/jpeg", size: 0 };
  const result = validateImageFile(emptyFile);
  assert.equal(result.valid, false);
  assert.match(result.error, /empty/i);
});
