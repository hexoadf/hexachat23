const express = require('express');
const { authenticate } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await notificationService.getNotifications(req.userId);
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const result = await notificationService.markNotificationRead(req.params.id, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/read-all', authenticate, async (req, res) => {
  try {
    const result = await notificationService.markAllRead(req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
