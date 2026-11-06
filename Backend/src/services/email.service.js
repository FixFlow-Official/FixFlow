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
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"FixFlow-project" <${config.GOOGLE_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

sendEmail.verifyTransporter = verifyTransporter;
sendEmail.transporter = transporter;

module.exports = sendEmail;
module.exports.verifyTransporter = verifyTransporter;
