const nodemailer = require("nodemailer");
const config = require("../config/config");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    refreshToken: config.GOOGLE_REFRESH_TOKEN,
    user: config.GOOGLE_USER,
  },
});

async function verifyTransporter() {
  try {
    await transporter.verify();
    console.log("Email server is ready to send emails");
    return true;
  } catch (error) {
    console.warn("Could not verify email transporter connection:", error.message || error);
    return false;
  }
}

// Function to send email
const sendEmail = async (toOrOptions, subject, text, html, attachments = []) => {
  try {
    let mailOptions;
    if (typeof toOrOptions === "object" && toOrOptions !== null && !Array.isArray(toOrOptions)) {
      mailOptions = {
        from: `"FixFlow-project" <${config.GOOGLE_USER}>`,
        ...toOrOptions,
      };
    } else {
      mailOptions = {
        from: `"FixFlow-project" <${config.GOOGLE_USER}>`,
        to: toOrOptions,
        subject,
        text,
        html,
        ...(attachments && attachments.length ? { attachments } : {}),
      };
    }

    const activeTransporter = sendEmail.transporter || transporter;
    const info = await activeTransporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

sendEmail.verifyTransporter = verifyTransporter;
sendEmail.transporter = transporter;

module.exports = sendEmail;
module.exports.verifyTransporter = verifyTransporter;
