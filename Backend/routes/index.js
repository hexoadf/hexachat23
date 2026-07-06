const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const profileRoutes = require('./profile');
const contactRoutes = require('./contacts');
const chatRoutes = require('./chats');
const messageRoutes = require('./messages');
const groupRoutes = require('./groups');
const statusRoutes = require('./status');
const callRoutes = require('./calls');
const notificationRoutes = require('./notifications');
const settingsRoutes = require('./settings');
const supabase = require('../config/database');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/profile', profileRoutes);
router.use('/contacts', contactRoutes);
router.use('/chats', chatRoutes);
router.use('/messages', messageRoutes);
router.use('/groups', groupRoutes);
router.use('/status', statusRoutes);
router.use('/calls', callRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingsRoutes);

router.get('/health', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true });
    if (error) {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    res.json({
      success: true,
      message: 'HexaChat API is running',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'Server error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
