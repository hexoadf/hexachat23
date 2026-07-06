const { body, param, query } = require('express-validator');

const signupValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone_number').trim().isLength({ min: 10, max: 15 }).withMessage('Valid phone number required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
];

const otpValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
];

const emailValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
];

const resetPasswordValidation = [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('new_password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const profileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('about').optional().trim().isLength({ max: 1000 }),
  body('phone_number').optional().trim().isLength({ min: 10, max: 15 })
];

const messageValidation = [
  body('content').optional().trim().isLength({ max: 5000 }),
  body('message_type').optional().isIn(['text', 'image', 'video', 'audio', 'file', 'gif', 'voice', 'location', 'contact']),
  body('receiver_id').optional().isUUID(),
  body('group_id').optional().isUUID(),
  body('conversation_id').optional().isUUID()
];

const groupValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Group name required'),
  body('description').optional().trim().isLength({ max: 500 })
];

const uuidParam = (name) => param(name).isUUID().withMessage(`Valid ${name} required`);

module.exports = {
  signupValidation,
  loginValidation,
  otpValidation,
  emailValidation,
  resetPasswordValidation,
  profileValidation,
  messageValidation,
  groupValidation,
  uuidParam,
  body,
  param,
  query
};
