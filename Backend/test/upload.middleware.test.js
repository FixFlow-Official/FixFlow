const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const test = require("node:test");
const studentRouter = require("../src/routes/student.routes");
const staffRouter = require("../src/routes/staff.routes");
const {
  MAX_IMAGE_SIZE,
  uploadSingleImage,
  validateImageSignature,
} = require("../src/middlewares/multer.middleware");

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XioAAAAASUVORK5CYII=",
  "base64",
);

async function startServer(t, app) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  return `http://127.0.0.1:${server.address().port}`;
}

function createUploadTestApp() {
  const app = express();
  app.post(
    "/upload",
    uploadSingleImage("photo"),
    validateImageSignature,
    (req, res) => res.status(200).json({ type: req.file?.mimetype ?? null }),
  );
  return app;
}

function imageForm(buffer, type, fieldName = "photo") {
  const form = new FormData();
  form.append(fieldName, new Blob([buffer], { type }), "proof");
  return form;
}

test("accepts a PNG whose content signature matches its MIME type", async (t) => {
  const baseUrl = await startServer(t, createUploadTestApp());
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: imageForm(onePixelPng, "image/png"),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { type: "image/png" });
});

test("rejects unsupported upload MIME types", async (t) => {
  const baseUrl = await startServer(t, createUploadTestApp());
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: imageForm(Buffer.from("not an image"), "text/plain"),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /JPG, PNG, or WebP/);
});

test("rejects a file whose claimed MIME type does not match its signature", async (t) => {
  const baseUrl = await startServer(t, createUploadTestApp());
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: imageForm(onePixelPng, "image/jpeg"),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /not a valid JPG, PNG, or WebP/);
});

test("rejects files larger than the 5 MB cap", async (t) => {
  const baseUrl = await startServer(t, createUploadTestApp());
  const oversizedImage = Buffer.alloc(MAX_IMAGE_SIZE + 1, 0);
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    body: imageForm(oversizedImage, "image/png"),
  });

  assert.equal(response.status, 413);
  assert.match((await response.json()).message, /5 MB or smaller/);
});

test("checks student authentication before parsing the uploaded file", async (t) => {
  const app = express();
  app.use("/api/student", studentRouter);
  const baseUrl = await startServer(t, app);
  const response = await fetch(`${baseUrl}/api/student/create-complaint`, {
    method: "POST",
    body: imageForm(Buffer.from("not an image"), "text/plain", "complaintImage"),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Unauthorized" });
});

test("checks staff authentication before parsing the resolution photo", async (t) => {
  const app = express();
  app.use("/api/staff", staffRouter);
  const baseUrl = await startServer(t, app);
  const response = await fetch(
    `${baseUrl}/api/staff/complaints/507f1f77bcf86cd799439011/status`,
    {
      method: "PATCH",
      body: imageForm(Buffer.from("not an image"), "text/plain", "resolutionProof"),
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Unauthorized" });
});
