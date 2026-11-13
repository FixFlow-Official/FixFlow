const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeWhatsAppRecipient,
  sendWhatsAppMessage,
  sendWhatsAppOtp,
} = require("../src/services/whatsappCloud.service");

test("normalizeWhatsAppRecipient cleans formats and applies country code defaults", () => {
  assert.equal(normalizeWhatsAppRecipient("+91 98765-43210"), "919876543210");
  assert.equal(normalizeWhatsAppRecipient("9876543210"), "919876543210");
  assert.equal(normalizeWhatsAppRecipient("+1 (555) 019-2834"), "15550192834");
  assert.equal(normalizeWhatsAppRecipient(""), "");
});

test("sendWhatsAppMessage runs safely in simulated mode when env credentials are unset", async () => {
  const origWaToken = process.env.WHATSAPP_TOKEN;
  const origWaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;

  try {
    const result = await sendWhatsAppMessage({
      to: "+91 98765 43210",
      message: "Test message from FixFlow",
    });

    assert.equal(result.success, true);
    assert.equal(result.simulated, true);
    assert.ok(result.messageId.startsWith("sim_wa_"));
    assert.equal(result.recipient, "919876543210");
  } finally {
    if (origWaToken !== undefined) process.env.WHATSAPP_TOKEN = origWaToken;
    if (origWaPhoneId !== undefined) process.env.WHATSAPP_PHONE_NUMBER_ID = origWaPhoneId;
  }
});

test("sendWhatsAppOtp dispatches formatted OTP message to WhatsApp recipient", async () => {
  const origWaToken = process.env.WHATSAPP_TOKEN;
  const origWaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;

  try {
    const result = await sendWhatsAppOtp({
      to: "+91 98765 43210",
      otp: "542918",
    });

    assert.equal(result.success, true);
    assert.equal(result.simulated, true);
    assert.equal(result.recipient, "919876543210");
  } finally {
    if (origWaToken !== undefined) process.env.WHATSAPP_TOKEN = origWaToken;
    if (origWaPhoneId !== undefined) process.env.WHATSAPP_PHONE_NUMBER_ID = origWaPhoneId;
  }
});

test("sendWhatsAppMessage makes live Meta Graph API call when credentials exist", async () => {
  const originalFetch = global.fetch;
  let interceptedUrl = "";
  let interceptedHeaders = {};
  let interceptedBody = null;

  global.fetch = async (url, options) => {
    interceptedUrl = url;
    interceptedHeaders = options.headers;
    interceptedBody = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: "whatsapp",
        contacts: [{ input: "919876543210", wa_id: "919876543210" }],
        messages: [{ id: "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSQjU1" }],
      }),
    };
  };

  const originalToken = process.env.WHATSAPP_TOKEN;
  const originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  try {
    process.env.WHATSAPP_TOKEN = "EAABtesttoken123";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "10987654321";

    const result = await sendWhatsAppMessage({
      to: "+91 98765 43210",
      message: "Your FixFlow technician is arriving.",
    });

    assert.equal(result.success, true);
    assert.equal(result.simulated, false);
    assert.equal(result.messageId, "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSQjU1");
    assert.equal(interceptedUrl, "https://graph.facebook.com/v20.0/10987654321/messages");
    assert.equal(interceptedHeaders.Authorization, "Bearer EAABtesttoken123");
    assert.equal(interceptedBody.messaging_product, "whatsapp");
    assert.equal(interceptedBody.to, "919876543210");
    assert.equal(interceptedBody.text.body, "Your FixFlow technician is arriving.");
  } finally {
    global.fetch = originalFetch;
    if (originalToken !== undefined) {
      process.env.WHATSAPP_TOKEN = originalToken;
    } else {
      delete process.env.WHATSAPP_TOKEN;
    }
    if (originalPhoneId !== undefined) {
      process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId;
    } else {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    }
  }
});
