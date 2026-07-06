const express = require('express');
const { authenticate } = require('../middleware/auth');
const profileService = require('../services/profileService');
const { upload } = require('../middleware/upload');
const { validate } = require('../middleware/validation');
const { profileValidation } = require('../middleware/validators');

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.userId);
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/me', authenticate, profileValidation, validate, async (req, res) => {
  try {
    const profile = await profileService.updateProfile(req.userId, req.body);
    res.json({ success: true, profile });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/me/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Photo required' });
    const result = await profileService.updateProfilePhoto(req.userId, req.file);
    res.json({ success: true, profile: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.params.id);
    const { email, ...publicProfile } = profile;
    if (req.params.id !== req.userId) delete publicProfile.about;
    res.json({ success: true, profile: publicProfile });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

module.exports = router;
