const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");
const studentRouter = require("../src/routes/student.routes");
const staffRouter = require("../src/routes/staff.routes");
const {
  MAX_IMAGE_SIZE,
  uploadSingleImage,
  validateImageSignature,
} = require("../src/middlewares/multer.middleware");

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function validate(buffer, mimetype) {
  const req = { file: buffer ? { buffer, mimetype } : undefined };
  const res = makeResponse();
  let nextCalled = false;
  validateImageSignature(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

function parseMultipartImage(buffer, mimetype, fieldName = "photo") {
  const boundary = "fixflow-test-boundary";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="proof"\r\nContent-Type: ${mimetype}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const req = Readable.from([body]);
  req.headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": String(body.length),
  };
  req.method = "POST";
  req.originalUrl = "/upload";

  return new Promise((resolve) => {
    const res = {
      statusCode: null,
      payload: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; resolve({ req, res: this, nextCalled: false }); return this; },
    };
    uploadSingleImage("photo")(req, res, () => resolve({ req, res, nextCalled: true }));
  });
}

const imageFixtures = [
  ["PNG", "image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ["JPEG", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
  ["WebP", "image/webp", Buffer.from("RIFF0000WEBP", "ascii")],
];

test("accepts image files when the bytes match the declared JPG, PNG, or WebP MIME type", () => {
  for (const [label, mimetype, buffer] of imageFixtures) {
    const result = validate(buffer, mimetype);
    assert.equal(result.nextCalled, true, `${label} image should continue`);
    assert.equal(result.res.statusCode, null);
  }
});

test("rejects a claimed image type that does not match the file signature", () => {
  const result = validate(imageFixtures[0][2], "image/jpeg");
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 400);
  assert.match(result.res.payload.message, /not a valid JPG, PNG, or WebP/);
});

test("rejects invalid image bytes and permits requests without an optional image", () => {
  const invalid = validate(Buffer.from("not an image"), "image/png");
  assert.equal(invalid.nextCalled, false);
  assert.equal(invalid.res.statusCode, 400);

  const noImage = validate(undefined, undefined);
  assert.equal(noImage.nextCalled, true);
  assert.equal(noImage.res.statusCode, null);
});

test("multipart parser accepts supported MIME types and rejects unsupported types", async () => {
  const accepted = await parseMultipartImage(imageFixtures[0][2], "image/png");
  assert.equal(accepted.nextCalled, true);
  assert.equal(accepted.req.file.mimetype, "image/png");

  const rejected = await parseMultipartImage(Buffer.from("not an image"), "text/plain");
  assert.equal(rejected.nextCalled, false);
  assert.equal(rejected.res.statusCode, 400);
  assert.match(rejected.res.payload.message, /JPG, PNG, or WebP/);
});

test("multipart parser rejects files that exceed the configured size cap", async () => {
  const oversized = await parseMultipartImage(Buffer.alloc(MAX_IMAGE_SIZE + 1), "image/png");
  assert.equal(oversized.nextCalled, false);
  assert.equal(oversized.res.statusCode, 413);
  assert.match(oversized.res.payload.message, /5 MB or smaller/);
});

test("keeps authentication before multipart parsing on complaint and resolution uploads", () => {
  const studentRoute = studentRouter.stack.find(
    (layer) => layer.route?.path === "/create-complaint",
  );
  const staffRoute = staffRouter.stack.find(
    (layer) => layer.route?.path === "/complaints/:complaintId/status",
  );

  assert.ok(studentRoute, "student complaint upload route should exist");
  assert.ok(staffRoute, "staff resolution upload route should exist");
  for (const route of [studentRoute, staffRoute]) {
    const handlers = route.route.stack.map((layer) => layer.name);
    assert.ok(handlers.indexOf("verifyAccessToken") < handlers.indexOf("parseImageRequest"));
    assert.ok(handlers.indexOf("parseImageRequest") < handlers.indexOf("validateImageSignature"));
  }
});

test("retains the configured five-megabyte upload cap", () => {
  assert.equal(MAX_IMAGE_SIZE, 5 * 1024 * 1024);
});
