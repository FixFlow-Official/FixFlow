const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatTimelineMessage,
  sendComplaintSmsWhatsAppUpdate,
  dispatchTimelineAlerts,
} = require("../src/services/smsWhatsApp.service");
const complaintModel = require("../src/models/complaint.model");
const studentModel = require("../src/models/student.model");

test("formatTimelineMessage produces clear, high-readability messages for all lifecycle events", () => {
  const complaint = {
    _id: "672f00000000000000000001",
    ticketNumber: "FF-1042",
    complaintTitle: "Lab 2 AC not cooling",
    assignedDepartment: "HVAC / Electrical",
    location: {
      building: "Science Block",
      floor: "2nd Floor",
      room: "Lab 201",
    },
  };

  const assignedMsg = formatTimelineMessage({
    event: "assigned",
    complaint,
    actorName: "Ramesh Kumar",
  });
  assert.match(assignedMsg, /FixFlow Alert/);
  assert.match(assignedMsg, /#FF-1042/);
  assert.match(assignedMsg, /Ramesh Kumar/);
  assert.match(assignedMsg, /HVAC \/ Electrical/);
  assert.match(assignedMsg, /Science Block, Room Lab 201/);

  const inProgressMsg = formatTimelineMessage({
    event: "in_progress",
    complaint,
    actorName: "Ramesh",
    note: "Compressor parts ordered from central store.",
  });
  assert.match(inProgressMsg, /FixFlow Update/);
  assert.match(inProgressMsg, /Compressor parts ordered/);

  const resolvedMsg = formatTimelineMessage({
    event: "resolved",
    complaint,
    actorName: "Ramesh",
  });
  assert.match(resolvedMsg, /FixFlow Resolved/);
  assert.match(resolvedMsg, /rate the fix and confirm if it's working now/);

  const reopenedMsg = formatTimelineMessage({
    event: "reopened",
    complaint,
    note: "Still blowing warm air after 30 mins.",
  });
  assert.match(reopenedMsg, /FixFlow Alert/);
  assert.match(reopenedMsg, /reopened by the student/);
  assert.match(reopenedMsg, /Still blowing warm air/);
});

test("sendComplaintSmsWhatsAppUpdate persists simulated timeline entry on complaint", async () => {
  const originalFindById = complaintModel.findById;
  const originalStudentFindById = studentModel.findById;

  const mockComplaint = {
    _id: "672f00000000000000000002",
    user: "672f00000000000000000099",
    ticketNumber: "FF-9001",
    complaintTitle: "Broken Water Tap",
    location: { building: "PG Block", room: "Washroom 101" },
    smsUpdates: [],
    save: async function () {
      return this;
    },
  };

  complaintModel.findById = async () => mockComplaint;
  studentModel.findById = () => ({
    select: async () => ({
      phoneNumber: "+91 98123 45678",
      smsNotificationsEnabled: true,
      whatsAppNotificationsEnabled: true,
    }),
  });

  try {
    const entry = await sendComplaintSmsWhatsAppUpdate({
      complaintId: mockComplaint._id,
      event: "assigned",
      channel: "whatsapp",
      actorName: "Suresh",
    });

    assert.ok(entry);
    assert.equal(entry.channel, "whatsapp");
    assert.equal(entry.recipientPhone, "+91 98123 45678");
    assert.equal(entry.event, "assigned");
    assert.equal(entry.status, "simulated");
    assert.ok(entry.providerMessageId.startsWith("sim_whatsapp_"));
    assert.equal(mockComplaint.smsUpdates.length, 1);
  } finally {
    complaintModel.findById = originalFindById;
    studentModel.findById = originalStudentFindById;
  }
});

test("dispatchTimelineAlerts dispatches both WhatsApp and SMS timeline records", async () => {
  const originalFindById = complaintModel.findById;
  const updates = [];

  const mockComplaint = {
    _id: "672f00000000000000000003",
    ticketNumber: "FF-3003",
    complaintTitle: "Light fixture sparking",
    location: { building: "Library", room: "204" },
    smsUpdates: updates,
    save: async function () {
      return this;
    },
  };

  complaintModel.findById = async () => mockComplaint;

  try {
    await dispatchTimelineAlerts({
      complaint: mockComplaint,
      event: "status_update",
      actorName: "Electrician Team",
      note: "Inspecting wiring junction box.",
    });

    assert.equal(updates.length, 2);
    const channels = updates.map((u) => u.channel).sort();
    assert.deepEqual(channels, ["sms", "whatsapp"]);
  } finally {
    complaintModel.findById = originalFindById;
  }
});
