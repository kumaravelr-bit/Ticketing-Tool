const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // ✅ important
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

exports.sendOTP = async (to, otp) => {
  await transporter.sendMail({
    from: `"HR System" <${process.env.MAIL_USER}>`,
    to,
    subject: "Password Reset OTP",
    html: `
      <h3>Your OTP is: ${otp}</h3>
      <p>This OTP is valid for <b>2 minutes</b>.</p>
      <p>Do not share this OTP.</p>
    `
  });
};

