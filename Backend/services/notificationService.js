const supabase = require('../config/database');

async function createNotification(userId, { type, title, body, data }) {
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      body,
      data: data || null,
      is_read: false
    })
    .select('*')
    .single();

  if (error) throw error;
  return notification;
}

async function getNotifications(userId, page = 1, limit = 30) {
  const offset = (page - 1) * limit;
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

async function markNotificationRead(notificationId, userId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  return { message: 'Marked as read' };
}

async function markAllRead(userId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return { message: 'All marked as read' };
}

async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

module.exports = {
  createNotification, getNotifications, markNotificationRead,
  markAllRead, getUnreadCount
};
