const supabase = require('../config/database');

async function getSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const defaults = {
      user_id: userId,
      dark_theme: true,
      notifications_enabled: true,
      sound_enabled: true,
      read_receipts: true,
      last_seen_visible: true,
      group_notifications: true,
      status_notifications: true
    };
    await supabase.from('user_settings').insert(defaults);
    return defaults;
  }

  return data;
}

async function updateSettings(userId, updates) {
  const allowed = {};
  const fields = [
    'dark_theme', 'notifications_enabled', 'sound_enabled',
    'read_receipts', 'last_seen_visible', 'group_notifications',
    'status_notifications'
  ];

  for (const field of fields) {
    if (updates[field] !== undefined) allowed[field] = updates[field];
  }

  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...allowed }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getStorageUsage(userId) {
  const { data: messages } = await supabase
    .from('messages')
    .select('attachment_url, attachment_name')
    .eq('sender_id', userId)
    .not('attachment_url', 'is', null);

  const files = (messages || []).map(m => ({
    name: m.attachment_name,
    url: m.attachment_url
  }));

  return {
    file_count: files.length,
    files: files.slice(0, 50)
  };
}

module.exports = { getSettings, updateSettings, getStorageUsage };
