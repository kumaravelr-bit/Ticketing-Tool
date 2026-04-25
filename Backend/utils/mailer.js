const { sendMailWithFallback } = require("./mailTransport");

exports.sendOTP = async (to, otp) => {
  await sendMailWithFallback({
    to,
    subject: "Password Reset OTP",
    html: `
      <h3>Your OTP is: ${otp}</h3>
      <p>This OTP is valid for <b>2 minutes</b>.</p>
      <p>Do not share this OTP.</p>
    `,
  }, "HR System");
};
