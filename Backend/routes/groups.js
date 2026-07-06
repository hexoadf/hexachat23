const express = require('express');
const { authenticate } = require('../middleware/auth');
const groupService = require('../services/groupService');
const notificationService = require('../services/notificationService');
const { upload } = require('../middleware/upload');
const { validate } = require('../middleware/validation');
const { groupValidation, body } = require('../middleware/validators');

const router = express.Router();

async function notifyGroupMembers(io, memberIds, group, creatorId) {
  if (!io) return;
  for (const id of memberIds) {
    if (id === creatorId) continue;
    io.to(`user:${id}`).emit('group_added', group);
    io.to(`user:${id}`).emit('notification', {
      type: 'group',
      title: 'Added to group',
      body: `You were added in ${group.name}`,
      data: { group_id: group.id, conversation_id: group.id }
    });
    await notificationService.createNotification(id, {
      type: 'group',
      title: 'Added to group',
      body: `You were added in ${group.name}`,
      data: { group_id: group.id, conversation_id: group.id }
    });
  }
}

router.post('/', authenticate, upload.single('photo'), groupValidation, validate, async (req, res) => {
  try {
    const memberIds = req.body.member_ids ? JSON.parse(req.body.member_ids) : [];
    const group = await groupService.createGroup(req.userId, {
      name: req.body.name,
      description: req.body.description,
      memberIds,
      photo: req.file
    });
    const io = req.app.get('io');
    await notifyGroupMembers(io, memberIds, group, req.userId);
    res.status(201).json({ success: true, group });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const groups = await groupService.getUserGroups(req.userId);
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const groups = await groupService.getUserGroups(req.userId);
    const filtered = groups.filter(g => g.name.toLowerCase().includes(q));
    res.json({ success: true, groups: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:groupId', authenticate, async (req, res) => {
  try {
    const group = await groupService.getGroup(req.params.groupId, req.userId);
    res.json({ success: true, group });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:groupId', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const group = await groupService.updateGroup(req.params.groupId, req.userId, {
      name: req.body.name,
      description: req.body.description,
      photo: req.file
    });
    res.json({ success: true, group });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:groupId/members', authenticate, [body('member_ids').isArray()], validate, async (req, res) => {
  try {
    const result = await groupService.addMembers(req.params.groupId, req.userId, req.body.member_ids);
    const group = await groupService.getGroup(req.params.groupId, req.userId);
    const io = req.app.get('io');
    await notifyGroupMembers(io, result.added || req.body.member_ids, group, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:groupId/members/:memberId', authenticate, async (req, res) => {
  try {
    const result = await groupService.removeMember(req.params.groupId, req.userId, req.params.memberId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:groupId/promote/:memberId', authenticate, async (req, res) => {
  try {
    const result = await groupService.promoteAdmin(req.params.groupId, req.userId, req.params.memberId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:groupId/leave', authenticate, async (req, res) => {
  try {
    const result = await groupService.leaveGroup(req.params.groupId, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:groupId', authenticate, async (req, res) => {
  try {
    const result = await groupService.deleteGroup(req.params.groupId, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
