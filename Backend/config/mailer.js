const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendOTPEmail(to, otp, type = 'verification') {
  const subjects = {
    verification: 'HexaChat - Verify Your Email',
    reset: 'HexaChat - Password Reset OTP',
    login: 'HexaChat - Login OTP'
  };

  const messages = {
    verification: 'Use this OTP to verify your HexaChat account:',
    reset: 'Use this OTP to reset your HexaChat password:',
    login: 'Use this OTP to login to HexaChat:'
  };

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: subjects[type] || subjects.verification,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0a0a0a; color: #fff; border-radius: 16px;">
        <h1 style="color: #3b82f6; margin-bottom: 8px;">HexaChat</h1>
        <p style="color: #a1a1aa; margin-bottom: 24px;">${messages[type] || messages.verification}</p>
        <div style="background: #18181b; border: 1px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #60a5fa;">${otp}</span>
        </div>
        <p style="color: #71717a; font-size: 14px;">This OTP expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share it with anyone.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { transporter, sendOTPEmail };
