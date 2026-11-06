import assert from "node:assert/strict";
import test from "node:test";
import {
  findNavigationTarget,
  extractNavigationFromReply,
  extractComplaintFields,
  isExitIntent,
  getUserDisplayName,
  isQuestion,
  splitIntoSentences,
  stripRepetitiveGreeting,
} from "../src/components/layout/assistantUtils.js";

const sampleNavItems = [
  { id: "complaints", label: "Complaints" },
  { id: "campusMap", label: "Campus Map & GIS" },
  { id: "users", label: "User access" },
  { id: "accounts", label: "Accounts" },
  { id: "sla", label: "SLA tracking" },
  { id: "reports", label: "Reports" },
  { id: "profile", label: "Profile" },
  { id: "newComplaint", label: "New complaint" },
  { id: "myComplaints", label: "My complaints" },
  { id: "activeComplaints", label: "Active complaints" },
  { id: "resolvedComplaints", label: "Resolved complaints" },
];

test("isQuestion detects informational queries vs action commands", () => {
  assert.equal(isQuestion("what can you do"), true);
  assert.equal(isQuestion("how do I track complaints"), true);
  assert.equal(isQuestion("show me how to make a complaint"), true);
  assert.equal(isQuestion("tell me about complaints"), true);
  assert.equal(isQuestion("what is SLA tracking?"), true);
  assert.equal(isQuestion("why is my complaint pending?"), true);
  assert.equal(isQuestion("explain campus map to me"), true);

  assert.equal(isQuestion("can you open campus map?"), false);
  assert.equal(isQuestion("could you please go to profile?"), false);
  assert.equal(isQuestion("open complaints"), false);
  assert.equal(isQuestion("campus map"), false);
  assert.equal(isQuestion("profile"), false);
});

test("findNavigationTarget never hijacks questions as navigation", () => {
  assert.equal(findNavigationTarget("what can you do", sampleNavItems), null);
  assert.equal(findNavigationTarget("how do I track complaints", sampleNavItems), null);
  assert.equal(findNavigationTarget("how to file a complaint", sampleNavItems), null);
  assert.equal(findNavigationTarget("what is my complaint status", sampleNavItems), null);
  assert.equal(findNavigationTarget("show me how to make a complaint", sampleNavItems), null);
  assert.equal(findNavigationTarget("tell me about complaints", sampleNavItems), null);
  assert.equal(findNavigationTarget("can you check complaints", sampleNavItems), null);
  assert.equal(findNavigationTarget("do I have any complaints", sampleNavItems), null);
  assert.equal(findNavigationTarget("explain SLA tracking", sampleNavItems), null);
});

test("findNavigationTarget resolves navigation commands across app views", () => {
  assert.equal(
    findNavigationTarget("I said take me to my profile page", sampleNavItems)?.id,
    "profile",
  );
  assert.equal(
    findNavigationTarget("take me to my profile page", sampleNavItems)?.id,
    "profile",
  );
  assert.equal(
    findNavigationTarget("open campus map", sampleNavItems)?.id,
    "campusMap",
  );
  assert.equal(
    findNavigationTarget("can you open campus map?", sampleNavItems)?.id,
    "campusMap",
  );
  assert.equal(
    findNavigationTarget("take me to SLA tracking", sampleNavItems)?.id,
    "sla",
  );
  assert.equal(
    findNavigationTarget("show reports", sampleNavItems)?.id,
    "reports",
  );
  assert.equal(
    findNavigationTarget("go to user access", sampleNavItems)?.id,
    "users",
  );
  assert.equal(
    findNavigationTarget("switch to profile", sampleNavItems)?.id,
    "profile",
  );
  assert.equal(
    findNavigationTarget("create complaint", sampleNavItems)?.id,
    "newComplaint",
  );
  assert.equal(
    findNavigationTarget("open my complaints", sampleNavItems)?.id,
    "myComplaints",
  );
  assert.equal(
    findNavigationTarget("show resolved complaints", sampleNavItems)?.id,
    "resolvedComplaints",
  );
});

test("findNavigationTarget handles Hindi and direct alias variations", () => {
  assert.equal(
    findNavigationTarget("campus map kholo", sampleNavItems)?.id,
    "campusMap",
  );
  assert.equal(
    findNavigationTarget("profile dikhao", sampleNavItems)?.id,
    "profile",
  );
  assert.equal(
    findNavigationTarget("complaints", sampleNavItems)?.id,
    "complaints",
  );
  assert.equal(
    findNavigationTarget("reports", sampleNavItems)?.id,
    "reports",
  );
  assert.equal(
    findNavigationTarget("sla tracking", sampleNavItems)?.id,
    "sla",
  );
});

test("extractNavigationFromReply extracts destination from assistant confirmation", () => {
  assert.equal(
    extractNavigationFromReply(
      "I am navigating you to your profile page right away.",
      sampleNavItems,
    )?.id,
    "profile",
  );
  assert.equal(
    extractNavigationFromReply("Opening the campus map now.", sampleNavItems)?.id,
    "campusMap",
  );
  assert.equal(
    extractNavigationFromReply("Taking you to SLA tracking right away.", sampleNavItems)?.id,
    "sla",
  );
  assert.equal(
    extractNavigationFromReply("Opening complaints.", sampleNavItems)?.id,
    "complaints",
  );
  assert.equal(
    extractNavigationFromReply(
      "FixFlow gives you advisory recommendations.",
      sampleNavItems,
    ),
    null,
  );
});

test("splitIntoSentences segments spoken text for line-by-line display", () => {
  const parts = splitIntoSentences(
    "Hello! How can I help you today? I can navigate to campus facilities and submit complaints.",
  );
  assert.deepEqual(parts, [
    "Hello!",
    "How can I help you today?",
    "I can navigate to campus facilities and submit complaints.",
  ]);

  const single = splitIntoSentences("Opening Complaints. I'm right here in the orb listening.");
  assert.deepEqual(single, [
    "Opening Complaints.",
    "I'm right here in the orb listening.",
  ]);
});

test("stripRepetitiveGreeting removes redundant greetings in conversational turns", () => {
  assert.equal(
    stripRepetitiveGreeting("Hello Kohinoor, the library is open until 8 PM.", "Kohinoor"),
    "the library is open until 8 PM.",
  );
  assert.equal(
    stripRepetitiveGreeting("Hi Kohinoor! You have 2 pending complaints.", "Kohinoor"),
    "You have 2 pending complaints.",
  );
  assert.equal(
    stripRepetitiveGreeting("Hello! The campus map shows 9 buildings.", "Kohinoor"),
    "The campus map shows 9 buildings.",
  );
  assert.equal(
    stripRepetitiveGreeting("Sure, opening the campus map now.", "Kohinoor"),
    "Sure, opening the campus map now.",
  );
});

test("extractComplaintFields parses explicit key-value pairs", () => {
  const text =
    "title: Wi-Fi not working, category: Internet, building: PG Block, floor: 2nd Floor, room: E28, desc: Connection drops repeatedly.";
  const fields = extractComplaintFields(text);
  assert.ok(fields);
  assert.equal(fields.title, "Wi-Fi not working");
  assert.equal(fields.category, "Internet");
  assert.equal(fields.building, "PG Block");
  assert.equal(fields.floor, "2nd Floor");
  assert.equal(fields.room, "E28");
  assert.equal(fields.description, "Connection drops repeatedly.");
});

test("extractComplaintFields infers category and location from natural sentences", () => {
  const plumbing = extractComplaintFields(
    "water leakage in washroom of Science Block Room 204",
  );
  assert.ok(plumbing);
  assert.equal(plumbing.category, "Plumbing");
  assert.equal(plumbing.building, "Science Block");
  assert.equal(plumbing.room, "204");
  assert.match(plumbing.title, /Water leakage/i);

  const electrical = extractComplaintFields(
    "AC not cooling in IT Labs room 102",
  );
  assert.ok(electrical);
  assert.equal(electrical.category, "Electrical");
  assert.equal(electrical.building, "IT Labs");
  assert.equal(electrical.room, "102");

  const furniture = extractComplaintFields(
    "broken bench in Commerce Block 1st floor",
  );
  assert.ok(furniture);
  assert.equal(furniture.category, "Furniture");
  assert.equal(furniture.building, "Commerce Block");
  assert.equal(furniture.floor, "1st Floor");
});

test("isExitIntent detects session closing phrases", () => {
  assert.equal(isExitIntent("bye"), true);
  assert.equal(isExitIntent("goodbye!"), true);
  assert.equal(isExitIntent("exit"), true);
  assert.equal(isExitIntent("stop listening"), true);
  assert.equal(isExitIntent("tata see you"), true);
  assert.equal(isExitIntent("band karo"), true);

  assert.equal(isExitIntent("how do I track a complaint?"), false);
  assert.equal(isExitIntent("open campus map"), false);
});

test("getUserDisplayName extracts person name cleanly from user record", () => {
  assert.equal(getUserDisplayName({ username: "Kohinoor Singh" }), "Kohinoor");
  assert.equal(getUserDisplayName({ username: "Kohinoor Ji" }), "Kohinoor");
  assert.equal(getUserDisplayName({ username: "Kohinoor" }), "Kohinoor");
  assert.equal(getUserDisplayName({ username: "Priya Sharma" }), "Priya");
  assert.equal(getUserDisplayName({ username: "" }), "");
  assert.equal(getUserDisplayName(null), "");
});
