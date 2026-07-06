const express = require('express');
const { authenticate } = require('../middleware/auth');
const callService = require('../services/callService');

const router = express.Router();

router.get('/history', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const calls = await callService.getCallHistory(req.userId, page);
    res.json({ success: true, calls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
