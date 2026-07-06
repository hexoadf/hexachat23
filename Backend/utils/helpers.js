const bcrypt = require('bcryptjs');
const xss = require('xss');
const sanitizeHtml = require('sanitize-html');

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return xss(sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {}
  })).trim();
}

function sanitizeObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function formatPhone(phone) {
  return phone.replace(/\D/g, '');
}

function paginate(query, page = 1, limit = 50) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (p - 1) * l;
  return { ...query, offset, limit: l, page: p };
}

module.exports = {
  hashPassword,
  comparePassword,
  sanitizeInput,
  sanitizeObject,
  formatPhone,
  paginate
};
