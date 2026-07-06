function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

function getOTPExpiry() {
  const minutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
  return new Date(Date.now() + minutes * 60 * 1000);
}

module.exports = { generateOTP, getOTPExpiry };
