const { randomInt } = require("crypto");

function getOtp() {
  return randomInt(100000, 1_000_000);
}

function getHtml(otp, purpose = "registration") {
  const isPasswordReset = purpose === "password-reset";

  const emailTitle = isPasswordReset
    ? "Your FixFlow password reset code"
    : "Your FixFlow verification code";

  const emailHeading = isPasswordReset
    ? "Reset your password"
    : "Verify your email";

  const emailDescription = isPasswordReset
    ? "Enter this one-time code on the FixFlow password reset page to choose a new password."
    : "Enter this one-time code on the FixFlow registration page to continue creating your account.";

  const emailCategory = isPasswordReset
    ? "Password reset"
    : "Campus account verification";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${emailTitle}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: Arial, Helvetica, sans-serif; color: #172b27;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7f6; padding: 32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e1e8e5; border-radius: 16px;">
            <tr>
              <td style="padding: 28px 32px 20px; border-bottom: 1px solid #e8eeeb;">
                <span style="display: inline-block; padding: 9px 12px; border-radius: 10px; background-color: #e8f3ef; color: #246b5b; font-weight: 700; font-size: 18px;">
                  FixFlow<span style="color: #172b27;">.</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="margin: 0 0 8px; color: #246b5b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">
                  ${emailCategory}
                </p>
                <h1 style="margin: 0 0 12px; font-size: 26px; line-height: 1.3; color: #172b27;">
                  ${emailHeading}
                </h1>
                <p style="margin: 0 0 24px; color: #64736f; font-size: 15px; line-height: 1.6;">
                  ${emailDescription}
                </p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; border-radius: 12px; background-color: #f1f7f4;">
                  <tr>
                    <td align="center" style="padding: 22px 12px;">
                      <span style="color: #246b5b; font-size: 32px; font-weight: 700; letter-spacing: 8px;">
                        ${otp}
                      </span>
                    </td>
                  </tr>
                </table>

                <p style="margin: 20px 0 0; color: #64736f; font-size: 14px; line-height: 1.6;">
                  This code expires in 5 minutes. For your security, don’t share it with anyone.
                </p>
                <p style="margin: 24px 0 0; color: #64736f; font-size: 13px; line-height: 1.6;">
                  If you didn’t request this code, you can ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 32px; border-top: 1px solid #e8eeeb; color: #82908c; font-size: 12px; line-height: 1.5;">
                FixFlow campus support
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = { getOtp, getHtml };