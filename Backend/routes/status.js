const express = require('express');
const { authenticate } = require('../middleware/auth');
const statusService = require('../services/statusService');
const { upload } = require('../middleware/upload');
const { body } = require('../middleware/validators');
const { validate } = require('../middleware/validation');

const router = express.Router();

router.post('/', authenticate, upload.single('media'), async (req, res) => {
  try {
    const status = await statusService.createStatus(req.userId, {
      content: req.body.content,
      media_type: req.body.media_type,
      media_file: req.file,
      background_color: req.body.background_color
    });
    const io = req.app.get('io');
    if (io) io.emit('new_status', status);
    res.status(201).json({ success: true, status });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const statuses = await statusService.getContactStatuses(req.userId);
    res.json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:statusId/view', authenticate, async (req, res) => {
  try {
    const views = await statusService.viewStatus(req.params.statusId, req.userId);
    res.json({ success: true, views });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:statusId', authenticate, async (req, res) => {
  try {
    const result = await statusService.deleteStatus(req.params.statusId, req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:statusId/react', authenticate, [body('reaction').notEmpty()], validate, async (req, res) => {
  try {
    const reaction = await statusService.reactToStatus(req.params.statusId, req.userId, req.body.reaction);
    res.json({ success: true, reaction });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
