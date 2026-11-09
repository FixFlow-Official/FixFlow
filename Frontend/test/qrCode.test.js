import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRoomReportUrl,
  parseRoomReportUrl,
  generateQrDataUrl,
} from "../src/utils/qrCode.js";

test("generateRoomReportUrl builds valid canonical deep-link URL", () => {
  const url = generateRoomReportUrl({
    building: "Science Block",
    floor: "2nd Floor",
    room: "Lab 201",
    origin: "https://fixflow.example.edu",
  });

  assert.equal(
    url,
    "https://fixflow.example.edu/report?building=Science+Block&floor=2nd+Floor&room=Lab+201&source=qr_door",
  );
});

test("parseRoomReportUrl extracts location components accurately", () => {
  const parsedFromUrl = parseRoomReportUrl(
    "https://fixflow.example.edu/report?building=PG+Block&floor=Ground+Floor&room=102&source=qr_door",
  );

  assert.deepEqual(parsedFromUrl, {
    building: "PG Block",
    floor: "Ground Floor",
    room: "102",
    source: "qr_door",
  });

  const parsedFromQuery = parseRoomReportUrl("?building=IT+Labs&room=Server+Room");
  assert.equal(parsedFromQuery.building, "IT Labs");
  assert.equal(parsedFromQuery.room, "Server Room");
  assert.equal(parsedFromQuery.floor, "");

  assert.equal(parseRoomReportUrl(""), null);
  assert.equal(parseRoomReportUrl("?foo=bar"), null);
});

test("generateQrDataUrl produces a valid data URL containing image/png", async () => {
  const dataUrl = await generateQrDataUrl("https://fixflow.example.edu/report?building=Library&room=Reading+Hall");
  assert.match(dataUrl, /^data:image\/png;base64,/);
  assert.ok(dataUrl.length > 500);
});
