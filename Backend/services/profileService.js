const supabase = require('../config/database');
const { BUCKETS, uploadFile } = require('../config/storage');
const { generateFileName } = require('../middleware/upload');
const sharp = require('sharp');
const { sanitizeInput } = require('../utils/helpers');

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone_number, profile_photo, bio, about, is_online, last_seen, is_verified, created_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function updateProfile(userId, updates) {
  const allowed = {};
  if (updates.name) allowed.name = sanitizeInput(updates.name);
  if (updates.bio !== undefined) allowed.bio = sanitizeInput(updates.bio);
  if (updates.about !== undefined) allowed.about = sanitizeInput(updates.about);
  if (updates.phone_number) allowed.phone_number = updates.phone_number.replace(/\D/g, '');
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .update(allowed)
    .eq('id', userId)
    .select('id, name, email, phone_number, profile_photo, bio, about, is_online, last_seen')
    .single();

  if (error) throw error;
  return data;
}

async function updateProfilePhoto(userId, file) {
  let buffer = file.buffer;
  if (file.mimetype.startsWith('image/')) {
    buffer = await sharp(file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  const fileName = `profiles/${userId}/${generateFileName(file.originalname)}`;
  const url = await uploadFile(BUCKETS.avatars, fileName, buffer, 'image/jpeg');

  const { data, error } = await supabase
    .from('users')
    .update({ profile_photo: url, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, name, profile_photo')
    .single();

  if (error) throw error;
  return data;
}

module.exports = { getProfile, updateProfile, updateProfilePhoto };
