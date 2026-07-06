const supabase = require('../config/database');
const { BUCKETS, uploadFile } = require('../config/storage');
const { generateFileName } = require('../middleware/upload');
const { sanitizeInput } = require('../utils/helpers');
const sharp = require('sharp');

async function createStatus(userId, { content, media_type, media_file, background_color }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let mediaUrl = null;
  let type = media_type || 'text';

  if (media_file) {
    let buffer = media_file.buffer;
    let contentType = media_file.mimetype;

    if (media_file.mimetype.startsWith('image/')) {
      type = 'image';
      buffer = await sharp(buffer).resize(1080, 1920, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
      contentType = 'image/jpeg';
    } else if (media_file.mimetype.startsWith('video/')) {
      type = 'video';
    }

    const fileName = `status/${userId}/${generateFileName(media_file.originalname)}`;
    mediaUrl = await uploadFile(BUCKETS.status, fileName, buffer, contentType);
  } else if (content && !media_type) {
    if (/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]+$/u.test(content)) {
      type = 'emoji';
    } else {
      type = 'text';
    }
  }

  const { data, error } = await supabase
    .from('statuses')
    .insert({
      user_id: userId,
      content: content ? sanitizeInput(content) : null,
      media_url: mediaUrl,
      media_type: type,
      background_color: background_color || '#1e3a5f',
      expires_at: expiresAt.toISOString()
    })
    .select('*, user:users(id, name, profile_photo)')
    .single();

  if (error) throw error;
  return data;
}

async function getContactStatuses(userId) {
  const { data: contacts } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('user_id', userId)
    .eq('is_blocked', false);

  const contactIds = (contacts || []).map(c => c.contact_id);
  contactIds.push(userId);

  const { data, error } = await supabase
    .from('statuses')
    .select('*, user:users(id, name, profile_photo), views:status_views(viewer_id), reactions:status_reactions(*)')
    .in('user_id', contactIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  const grouped = {};
  for (const status of data || []) {
    if (!grouped[status.user_id]) {
      grouped[status.user_id] = {
        user: status.user,
        statuses: [],
        has_unseen: false
      };
    }
    const viewed = (status.views || []).some(v => v.viewer_id === userId);
    if (!viewed && status.user_id !== userId) grouped[status.user_id].has_unseen = true;
    grouped[status.user_id].statuses.push({ ...status, viewed });
  }

  return Object.values(grouped);
}

async function viewStatus(statusId, viewerId) {
  await supabase.from('status_views').upsert({
    status_id: statusId,
    viewer_id: viewerId,
    viewed_at: new Date().toISOString()
  }, { onConflict: 'status_id,viewer_id' });

  const { data: views } = await supabase
    .from('status_views')
    .select('viewer:users(id, name, profile_photo), viewed_at')
    .eq('status_id', statusId);

  return views || [];
}

async function deleteStatus(statusId, userId) {
  const { data } = await supabase.from('statuses').select('user_id').eq('id', statusId).single();
  if (!data || data.user_id !== userId) throw new Error('Cannot delete this status');

  await supabase.from('status_views').delete().eq('status_id', statusId);
  await supabase.from('status_reactions').delete().eq('status_id', statusId);
  await supabase.from('statuses').delete().eq('id', statusId);
  return { message: 'Status deleted' };
}

async function reactToStatus(statusId, userId, reaction) {
  await supabase.from('status_reactions').delete()
    .eq('status_id', statusId).eq('user_id', userId);

  const { data, error } = await supabase
    .from('status_reactions')
    .insert({ status_id: statusId, user_id: userId, reaction })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  createStatus, getContactStatuses, viewStatus, deleteStatus, reactToStatus
};
