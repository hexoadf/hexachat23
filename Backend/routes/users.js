const express = require('express');
const { authenticate } = require('../middleware/auth');
const userService = require('../services/userService');
const { query } = require('../middleware/validators');

const router = express.Router();

router.get('/lookup', authenticate, async (req, res) => {
  try {
    const phone = req.query.phone || '';
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return res.json({ success: true, found: false, user: null });
    }
    const user = await userService.lookupByPhone(phone, req.userId);
    res.json({ success: true, found: !!user, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) return res.json({ success: true, users: [] });
    const users = await userService.searchUsers(q, req.userId);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id, req.userId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

module.exports = router;
