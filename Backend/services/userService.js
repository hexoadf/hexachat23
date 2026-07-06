const supabase = require('../config/database');
const { sanitizeInput, formatPhone } = require('../utils/helpers');

function publicUserFields(user, viewerId) {
  const isSelf = viewerId === user.id;
  return {
    id: user.id,
    name: user.name,
    phone_number: user.phone_number,
    profile_photo: user.profile_photo,
    bio: user.bio,
    about: isSelf ? user.about : undefined,
    email: isSelf ? user.email : undefined,
    is_online: user.is_online,
    last_seen: user.last_seen,
    is_verified: user.is_verified
  };
}

async function getUserById(userId, viewerId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone_number, profile_photo, bio, about, is_online, last_seen, is_verified')
    .eq('id', userId)
    .single();

  if (error) throw new Error('User not found');
  return publicUserFields(data, viewerId);
}

async function searchUsers(query, currentUserId) {
  const q = sanitizeInput(query);
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone_number, profile_photo, bio, is_online, last_seen')
    .or(`name.ilike.%${q}%,phone_number.ilike.%${q}%`)
    .neq('id', currentUserId)
    .eq('is_verified', true)
    .limit(20);

  if (error) throw error;
  return data || [];
}

async function lookupByPhone(phone, currentUserId) {
  const clean = formatPhone(phone);
  if (clean.length < 10) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone_number, profile_photo, bio, is_online, last_seen')
    .neq('id', currentUserId)
    .eq('is_verified', true);

  if (error) throw error;

  const match = (data || []).find(u => formatPhone(u.phone_number) === clean || u.phone_number.includes(clean));
  return match || null;
}

async function updateOnlineStatus(userId, isOnline) {
  await supabase.from('users').update({
    is_online: isOnline,
    last_seen: new Date().toISOString()
  }).eq('id', userId);
}

module.exports = { getUserById, searchUsers, lookupByPhone, updateOnlineStatus, publicUserFields };
