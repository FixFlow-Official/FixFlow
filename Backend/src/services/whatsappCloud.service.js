const config = require("../config/config");

/**
 * Normalizes any phone number into pure digits with country code for Meta WhatsApp Cloud API.
 * E.g., "+91 98765-43210" -> "919876543210".
 * If a 10-digit number is provided without country code, defaults to India "91".
 */
function normalizeWhatsAppRecipient(phoneNumber) {
  if (!phoneNumber) return "";
  let digits = String(phoneNumber).replace(/\D/g, "");
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

/**
 * Sends a WhatsApp message via Meta WhatsApp Cloud API (Graph API v20.0).
 */
async function sendMetaWhatsAppMessage({ to, message, templateName, templateComponents }) {
  const token = (process.env.WHATSAPP_TOKEN || config.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || config.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const recipient = normalizeWhatsAppRecipient(to);

  const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  let payload;
  if (templateName) {
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_LANGUAGE_CODE?.trim() || config.WHATSAPP_LANGUAGE_CODE || "en_US" },
        components: templateComponents || [],
      },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: {
        preview_url: false,
        body: message,
      },
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error?.message || `Meta WhatsApp Cloud API error (status ${response.status})`;
      const errorCode = data?.error?.code;
      const errorSubcode = data?.error?.error_subcode;
      console.error(
        `[Meta WhatsApp Cloud API Error] Code: ${errorCode}, Subcode: ${errorSubcode}, Message: ${errorMsg}`,
      );
      return {
        success: false,
        simulated: false,
        error: errorMsg,
        code: errorCode,
        subcode: errorSubcode,
      };
    }

    const messageId = data?.messages?.[0]?.id || `wa_${Date.now()}`;
    return {
      success: true,
      simulated: false,
      messageId,
      provider: "meta",
      recipient,
    };
  } catch (netError) {
    console.error("[Meta WhatsApp Network Error]", netError);
    return {
      success: false,
      simulated: false,
      error: netError.message || "Network error while connecting to Meta WhatsApp Cloud API.",
    };
  }
}

/**
 * Meta WhatsApp Cloud API dispatcher for FixFlow.
 * Automatically uses Meta WhatsApp Cloud API when credentials are provided in .env.
 * Falls back to safe simulation mode when keys are not yet configured.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient phone number.
 * @param {string} options.message - Text message content.
 * @param {string} [options.templateName] - Optional Meta template name.
 * @param {Array} [options.templateComponents] - Optional Meta template parameters.
 * @returns {Promise<{ success: boolean, simulated: boolean, messageId?: string, error?: string }>}
 */
async function sendWhatsAppMessage({ to, message, templateName, templateComponents }) {
  const recipient = normalizeWhatsAppRecipient(to);
  if (!recipient) {
    return {
      success: false,
      simulated: false,
      error: "A valid recipient phone number is required for WhatsApp dispatch.",
    };
  }

  const waToken = (process.env.WHATSAPP_TOKEN || config.WHATSAPP_TOKEN || "").trim();
  const waPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || config.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const hasMeta = Boolean(waToken && waToken !== "undefined" && waPhoneId && waPhoneId !== "undefined");

  // 1. Dispatch via Meta WhatsApp Cloud API if configured
  if (hasMeta) {
    return sendMetaWhatsAppMessage({ to, message, templateName, templateComponents });
  }

  // 2. Safe simulation mode while awaiting Meta API activation
  return {
    success: true,
    simulated: true,
    messageId: `sim_wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recipient,
    note: "Meta WhatsApp credentials not yet configured in .env; message simulated safely.",
  };
}

/**
 * Sends a real 6-digit WhatsApp OTP verification code.
 * Dispatches via Meta WhatsApp Cloud API when configured,
 * or safely simulates for local development.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient phone number.
 * @param {string|number} options.otp - Real 6-digit verification code.
 */
async function sendWhatsAppOtp({ to, otp }) {
  const customMetaTemplate = (process.env.WHATSAPP_OTP_TEMPLATE || "").trim();

  if (!process.env.WHATSAPP_TOKEN?.trim()) {
    console.log(`[FixFlow WhatsApp OTP Simulation] OTP for ${to}: ${otp} (Awaiting Meta WhatsApp credentials in .env)`);
  }

  if (customMetaTemplate) {
    return sendWhatsAppMessage({
      to,
      templateName: customMetaTemplate,
      templateComponents: [
        {
          type: "body",
          parameters: [{ type: "text", text: String(otp) }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: String(otp) }],
        },
      ],
    });
  }

  const messageBody = `FixFlow Campus Support: Your WhatsApp verification code is *${otp}*.\n\nValid for 10 minutes. Please do not share this code with anyone.`;
  return sendWhatsAppMessage({
    to,
    message: messageBody,
  });
}

module.exports = {
  normalizeWhatsAppRecipient,
  sendWhatsAppMessage,
  sendWhatsAppOtp,
};
