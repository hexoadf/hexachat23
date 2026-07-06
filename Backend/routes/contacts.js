const express = require('express');
const { authenticate } = require('../middleware/auth');
const contactService = require('../services/contactService');
const { body } = require('../middleware/validators');
const { validate } = require('../middleware/validation');

const router = express.Router();

router.get('/blocked/list', authenticate, async (req, res) => {
  try {
    const blocked = await contactService.getBlockedUsers(req.userId);
    res.json({ success: true, blocked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const contacts = await contactService.getContacts(req.userId);
    res.json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/add', authenticate, [body('contact_id').isUUID()], validate, async (req, res) => {
  try {
    const result = await contactService.addContact(req.userId, req.body.contact_id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:contactId', authenticate, async (req, res) => {
  try {
    const result = await contactService.removeContact(req.userId, req.params.contactId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:contactId/favorite', authenticate, async (req, res) => {
  try {
    const result = await contactService.toggleFavorite(req.userId, req.params.contactId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:contactId/block', authenticate, async (req, res) => {
  try {
    const result = await contactService.blockUser(req.userId, req.params.contactId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/:contactId/unblock', authenticate, async (req, res) => {
  try {
    const result = await contactService.unblockUser(req.userId, req.params.contactId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
