const supabase = require('../config/database');
const chatService = require('./chatService');

async function getContacts(userId) {
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id, is_favorite, is_blocked, created_at,
      contact:users!contact_id (
        id, name, phone_number, profile_photo, bio, is_online, last_seen
      )
    `)
    .eq('user_id', userId)
    .eq('is_blocked', false)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    is_favorite: c.is_favorite,
    contact: c.contact
  }));
}

async function addContact(userId, contactId) {
  if (userId === contactId) throw new Error('Cannot add yourself');

  const { data: contactUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', contactId)
    .eq('is_verified', true)
    .maybeSingle();

  if (!contactUser) throw new Error('User not found');

  const { data: existing } = await supabase
    .from('contacts')
    .select('id, is_blocked')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existing) {
    if (existing.is_blocked) {
      await supabase.from('contacts').update({ is_blocked: false }).eq('id', existing.id);
      const convId = await chatService.getOrCreateConversation(userId, contactId);
      return { message: 'Contact unblocked', id: existing.id, conversation_id: convId, already_exists: false };
    }
    const convId = await chatService.getOrCreateConversation(userId, contactId);
    return { message: 'Already in your contacts', id: existing.id, conversation_id: convId, already_exists: true };
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({ user_id: userId, contact_id: contactId })
    .select('id')
    .single();

  if (error) throw error;

  const convId = await chatService.getOrCreateConversation(userId, contactId);
  return { message: 'Contact added', id: data.id, conversation_id: convId, already_exists: false };
}

async function removeContact(userId, contactId) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('user_id', userId)
    .eq('contact_id', contactId);

  if (error) throw error;
  return { message: 'Contact removed' };
}

async function toggleFavorite(userId, contactId) {
  const { data } = await supabase
    .from('contacts')
    .select('id, is_favorite')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .single();

  if (!data) throw new Error('Contact not found');

  const { error } = await supabase
    .from('contacts')
    .update({ is_favorite: !data.is_favorite })
    .eq('id', data.id);

  if (error) throw error;
  return { is_favorite: !data.is_favorite };
}

async function blockUser(userId, contactId) {
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existing) {
    await supabase.from('contacts').update({ is_blocked: true }).eq('id', existing.id);
  } else {
    await supabase.from('contacts').insert({
      user_id: userId, contact_id: contactId, is_blocked: true
    });
  }
  return { message: 'User blocked' };
}

async function unblockUser(userId, contactId) {
  await supabase
    .from('contacts')
    .update({ is_blocked: false })
    .eq('user_id', userId)
    .eq('contact_id', contactId);
  return { message: 'User unblocked' };
}

async function getBlockedUsers(userId) {
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id, created_at,
      contact:users!contact_id (id, name, profile_photo, phone_number)
    `)
    .eq('user_id', userId)
    .eq('is_blocked', true);

  if (error) throw error;
  return data || [];
}

async function isBlocked(userId, otherId) {
  const { data } = await supabase
    .from('contacts')
    .select('is_blocked')
    .eq('user_id', userId)
    .eq('contact_id', otherId)
    .eq('is_blocked', true)
    .maybeSingle();
  return !!data;
}

module.exports = {
  getContacts, addContact, removeContact, toggleFavorite,
  blockUser, unblockUser, getBlockedUsers, isBlocked
};
