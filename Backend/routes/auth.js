const express = require('express');
const authService = require('../services/authService');
const { validate } = require('../middleware/validation');
const {
  signupValidation, loginValidation, otpValidation,
  emailValidation, resetPasswordValidation
} = require('../middleware/validators');

const router = express.Router();

router.post('/signup', signupValidation, validate, async (req, res) => {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('Signup error:', err.message || err);
    res.status(400).json({ success: false, message: err.message || 'Signup failed' });
  }
});

router.post('/verify-otp', otpValidation, validate, async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    const result = await authService.verifyOTP(email, otp, type || 'signup');
    if (result.token) {
      res.cookie('token', result.token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/resend-otp', emailValidation, validate, async (req, res) => {
  try {
    const result = await authService.resendOTP(req.body.email, req.body.type || 'signup');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/login', loginValidation, validate, async (req, res) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    if (result.requiresVerification) {
      return res.status(403).json({ success: false, ...result });
    }
    res.cookie('token', result.token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ success: true, user: result.user, token: result.token });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
});

router.post('/forgot-password', emailValidation, validate, async (req, res) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/reset-password', resetPasswordValidation, validate, async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body.email, req.body.otp, req.body.new_password);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
