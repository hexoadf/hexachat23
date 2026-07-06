const express = require('express');
const { authenticate } = require('../middleware/auth');
const settingsService = require('../services/settingsService');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const settings = await settingsService.getSettings(req.userId);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/', authenticate, async (req, res) => {
  try {
    const settings = await settingsService.updateSettings(req.userId, req.body);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/storage', authenticate, async (req, res) => {
  try {
    const storage = await settingsService.getStorageUsage(req.userId);
    res.json({ success: true, storage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
