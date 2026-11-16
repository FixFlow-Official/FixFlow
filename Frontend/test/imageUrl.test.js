import assert from "node:assert/strict";
import test from "node:test";
import { getOptimizedImageUrl, IMAGE_VARIANTS } from "../src/utils/imageUrl.js";

test("getOptimizedImageUrl returns null or empty inputs unchanged", () => {
  assert.equal(getOptimizedImageUrl(null), null);
  assert.equal(getOptimizedImageUrl(""), "");
  assert.equal(getOptimizedImageUrl(undefined), undefined);
});

test("getOptimizedImageUrl preserves blob and data URLs without modification", () => {
  const blobUrl = "blob:http://localhost:5173/7efb99e7-d4fa-4fc6";
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA";
  assert.equal(getOptimizedImageUrl(blobUrl, "card"), blobUrl);
  assert.equal(getOptimizedImageUrl(dataUrl, "detail"), dataUrl);
});

test("getOptimizedImageUrl preserves non-ImageKit domains untouched", () => {
  const externalUrl = "https://images.unsplash.com/photo-1581578731548?auto=format";
  assert.equal(getOptimizedImageUrl(externalUrl, "card"), externalUrl);
});

test("getOptimizedImageUrl formats card and detail variants for ImageKit URLs", () => {
  const ikUrl = "https://ik.imagekit.io/campus123/complaints/water-leak.jpg";

  const cardUrl = getOptimizedImageUrl(ikUrl, "card");
  assert.equal(cardUrl, `https://ik.imagekit.io/campus123/complaints/water-leak.jpg?tr=${IMAGE_VARIANTS.card}`);
  assert.match(cardUrl, /tr=w-800,q-80/);

  const detailUrl = getOptimizedImageUrl(ikUrl, "detail");
  assert.equal(detailUrl, `https://ik.imagekit.io/campus123/complaints/water-leak.jpg?tr=${IMAGE_VARIANTS.detail}`);
  assert.match(detailUrl, /tr=w-1600,q-85/);
});

test("getOptimizedImageUrl replaces existing tr param if already present", () => {
  const ikUrlWithTr = "https://ik.imagekit.io/campus123/complaints/water-leak.jpg?tr=w-200,q-50";
  const updatedUrl = getOptimizedImageUrl(ikUrlWithTr, "detail");
  assert.equal(updatedUrl, "https://ik.imagekit.io/campus123/complaints/water-leak.jpg?tr=w-1600,q-85");
});

test("getOptimizedImageUrl preserves additional query params while updating tr", () => {
  const ikUrlWithParams = "https://ik.imagekit.io/campus123/complaints/water-leak.jpg?token=abc123";
  const updatedUrl = getOptimizedImageUrl(ikUrlWithParams, "card");
  assert.match(updatedUrl, /token=abc123/);
  assert.match(updatedUrl, /tr=w-800,q-80/);
});
