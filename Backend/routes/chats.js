const express = require('express');
const { authenticate } = require('../middleware/auth');
const chatService = require('../services/chatService');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const chats = await chatService.getUserChats(req.userId);
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:conversationId/clear', authenticate, async (req, res) => {
  try {
    const result = await chatService.clearChat(req.params.conversationId, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ success: true, chats: [] });
    const chats = await chatService.searchChats(req.userId, q);
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
