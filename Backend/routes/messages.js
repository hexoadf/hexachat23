const express = require('express');
const { authenticate } = require('../middleware/auth');
const messageService = require('../services/messageService');
const groupService = require('../services/groupService');
const { upload } = require('../middleware/upload');
const { validate } = require('../middleware/validation');
const { messageValidation, body } = require('../middleware/validators');

const router = express.Router();

router.get('/search/all', authenticate, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ success: true, messages: [] });
    const messages = await messageService.searchMessages(req.userId, q);
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File required' });
    const result = await messageService.uploadMedia(req.file, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/', authenticate, messageValidation, validate, async (req, res) => {
  try {
    const message = await messageService.sendMessage(req.userId, req.body);
    const { blocked_by_receiver, ...safeMessage } = message;
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.userId}`).emit('new_message', safeMessage);
      if (message.group_id) {
        io.to(`conversation:${message.conversation_id}`).emit('new_message', safeMessage);
        const memberIds = await groupService.getGroupMemberIds(message.group_id);
        const preview = message.content || (message.message_type !== 'text' ? 'Sent an attachment' : '');
        for (const id of memberIds) {
          if (id === req.userId) continue;
          io.to(`user:${id}`).emit('new_message', safeMessage);
          io.to(`user:${id}`).emit('notification', {
            type: 'message',
            title: message.sender?.name || 'Group message',
            body: preview,
            data: { conversation_id: message.conversation_id, group_id: message.group_id }
          });
        }
      } else if (message.receiver_id && !blocked_by_receiver) {
        io.to(`user:${message.receiver_id}`).emit('new_message', safeMessage);
        io.to(`user:${message.receiver_id}`).emit('notification', {
          type: 'message', title: message.sender?.name || 'New Message',
          body: message.content || 'Sent an attachment', data: { conversation_id: message.conversation_id }
        });
      }
    }
    res.status(201).json({ success: true, message: safeMessage });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const messages = await messageService.getMessages(req.params.conversationId, req.userId, page, limit);
    const pinned = await messageService.getPinnedMessage(req.params.conversationId);
    res.json({ success: true, messages, pinned });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:conversationId/read', authenticate, async (req, res) => {
  try {
    const result = await messageService.markAsRead(req.params.conversationId, req.userId);
    const io = req.app.get('io');
    if (io) io.to(`conversation:${req.params.conversationId}`).emit('messages_read', { conversation_id: req.params.conversationId, user_id: req.userId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:messageId', authenticate, [body('content').notEmpty()], validate, async (req, res) => {
  try {
    const message = await messageService.editMessage(req.params.messageId, req.userId, req.body.content);
    const io = req.app.get('io');
    if (io) io.to(`conversation:${message.conversation_id}`).emit('message_edited', message);
    res.json({ success: true, message });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:messageId/me', authenticate, async (req, res) => {
  try {
    const result = await messageService.deleteForMe(req.params.messageId, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:messageId/everyone', authenticate, async (req, res) => {
  try {
    const result = await messageService.deleteForEveryone(req.params.messageId, req.userId);
    const io = req.app.get('io');
    if (io) io.emit('message_deleted', result);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:messageId/pin', authenticate, [body('conversation_id').isUUID()], validate, async (req, res) => {
  try {
    const pinned = await messageService.pinMessage(req.params.messageId, req.userId, req.body.conversation_id);
    const io = req.app.get('io');
    if (io) io.to(`conversation:${req.body.conversation_id}`).emit('message_pinned', pinned);
    res.json({ success: true, pinned });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/pin/:conversationId', authenticate, async (req, res) => {
  try {
    const result = await messageService.unpinMessage(req.params.conversationId);
    const io = req.app.get('io');
    if (io) io.to(`conversation:${req.params.conversationId}`).emit('message_unpinned', { conversation_id: req.params.conversationId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:messageId/star', authenticate, async (req, res) => {
  try {
    const result = await messageService.starMessage(req.params.messageId, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:messageId/reaction', authenticate, [body('reaction').notEmpty()], validate, async (req, res) => {
  try {
    const reaction = await messageService.addReaction(req.params.messageId, req.userId, req.body.reaction);
    const io = req.app.get('io');
    if (io) io.emit('message_reaction', { message_id: req.params.messageId, reaction });
    res.json({ success: true, reaction });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:messageId/reaction', authenticate, async (req, res) => {
  try {
    const result = await messageService.removeReaction(req.params.messageId, req.userId);
    const io = req.app.get('io');
    if (io) io.emit('message_reaction_removed', { message_id: req.params.messageId, user_id: req.userId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
