const { verifyToken } = require('../utils/jwt');
const supabase = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone_number, profile_photo, is_verified, last_seen, bio, about, is_online')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: 'Email not verified' });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;
  if (!token) return next();
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
  } catch {
    // ignore
  }
  next();
}

module.exports = { authenticate, optionalAuth };
