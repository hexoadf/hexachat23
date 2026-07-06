const nodemailer = require('nodemailer');

const SMTP_USER = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

function createTransporter() {
  if (SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000
  });
}

const transporter = createTransporter();

function isSmtpConfigured() {
  return !!(SMTP_USER && SMTP_PASS);
}

async function sendOTPEmail(to, otp, type = 'verification') {
  const subjects = {
    verification: 'HexaChat - Verify Your Email',
    signup: 'HexaChat - Verify Your Email',
    reset: 'HexaChat - Password Reset OTP',
    login: 'HexaChat - Login OTP'
  };

  const messages = {
    verification: 'Use this OTP to verify your HexaChat account:',
    signup: 'Use this OTP to verify your HexaChat account:',
    reset: 'Use this OTP to reset your HexaChat password:',
    login: 'Use this OTP to login to HexaChat:'
  };

  if (!isSmtpConfigured()) {
    console.warn(`[OTP] SMTP not configured — OTP for ${to}: ${otp}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = process.env.SMTP_FROM || `HexaChat <${SMTP_USER}>`;
  const mailOptions = {
    from,
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

  const sendPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('SMTP connection timed out')), 10000);
  });

  try {
    await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[OTP] Email sent to ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[OTP] Email failed for ${to}:`, err.message);
    console.warn(`[OTP] OTP code for ${to}: ${otp}`);
    return { sent: false, reason: err.message };
  }
}

function sendOTPEmailAsync(to, otp, type = 'signup') {
  sendOTPEmail(to, otp, type).catch((err) => {
    console.error(`[OTP] Background send error for ${to}:`, err.message);
  });
}

module.exports = { transporter, sendOTPEmail, sendOTPEmailAsync, isSmtpConfigured };
