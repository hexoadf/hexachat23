const supabase = require('../config/database');
const { BUCKETS, uploadFile } = require('../config/storage');
const { generateFileName } = require('../middleware/upload');
const { sanitizeInput } = require('../utils/helpers');
const chatService = require('./chatService');
const contactService = require('./contactService');
const sharp = require('sharp');

async function sendMessage(senderId, data) {
  const {
    content, message_type = 'text', receiver_id, group_id, conversation_id,
    reply_to_id, forwarded_from_id, attachment_url, attachment_name,
    metadata
  } = data;

  let convId = conversation_id;

  if (!convId) {
    if (receiver_id) {
      convId = await chatService.getOrCreateConversation(senderId, receiver_id);
    } else if (group_id) {
      const { data: member } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group_id)
        .eq('user_id', senderId)
        .maybeSingle();
      if (!member) throw new Error('Not a group member');
      convId = group_id;
    } else {
      throw new Error('Receiver or group required');
    }
  }

  const messageData = {
    sender_id: senderId,
    receiver_id: receiver_id || null,
    group_id: group_id || null,
    conversation_id: convId,
    content: content ? sanitizeInput(content) : null,
    message_type,
    attachment_url: attachment_url || null,
    attachment_name: attachment_name || null,
    reply_to_id: reply_to_id || null,
    forwarded_from_id: forwarded_from_id || null,
    metadata: metadata || null,
    is_read: false,
    is_deleted: false,
    delivered_at: new Date().toISOString()
  };

  const { data: message, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select(`
      *,
      sender:users!messages_sender_id_fkey (id, name, profile_photo)
    `)
    .single();

  if (error) throw error;

  const blockedByReceiver = receiver_id
    ? await contactService.isBlocked(receiver_id, senderId)
    : false;
  message.blocked_by_receiver = blockedByReceiver;

  await supabase.from('conversations').update({
    updated_at: new Date().toISOString()
  }).eq('id', convId);

  if (reply_to_id) {
    const { data: replyMsg } = await supabase
      .from('messages')
      .select('id, content, message_type, sender_id, sender:users!messages_sender_id_fkey(name)')
      .eq('id', reply_to_id)
      .single();
    message.reply_to = replyMsg;
  }

  return message;
}

async function getMessages(conversationId, userId, page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const { data: member } = await supabase
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  const { data: groupMember } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member && !groupMember) throw new Error('Access denied');

  const { data: deletedForMe } = await supabase
    .from('deleted_messages')
    .select('message_id')
    .eq('user_id', userId);

  const deletedIds = (deletedForMe || []).map(d => d.message_id);

  const { data: blockedContacts } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('user_id', userId)
    .eq('is_blocked', true);
  const blockedSenderIds = new Set((blockedContacts || []).map(b => b.contact_id));

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:users!messages_sender_id_fkey (id, name, profile_photo),
      reactions:message_reactions (id, user_id, reaction, user:users(name))
    `)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  const messages = (data || [])
    .filter(m => !deletedIds.includes(m.id) && !blockedSenderIds.has(m.sender_id))
    .reverse();

  for (const msg of messages) {
    if (msg.reply_to_id) {
      const { data: reply } = await supabase
        .from('messages')
        .select('id, content, message_type, sender:users!messages_sender_id_fkey(name)')
        .eq('id', msg.reply_to_id)
        .maybeSingle();
      msg.reply_to = reply;
    }
  }

  return messages;
}

async function markAsRead(conversationId, userId) {
  await supabase
    .from('messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .eq('is_read', false);

  return { message: 'Messages marked as read' };
}

async function editMessage(messageId, userId, content) {
  const { data: msg } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('id', messageId)
    .single();

  if (!msg || msg.sender_id !== userId) throw new Error('Cannot edit this message');

  const { data, error } = await supabase
    .from('messages')
    .update({
      content: sanitizeInput(content),
      edited_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function deleteForMe(messageId, userId) {
  await supabase.from('deleted_messages').upsert({
    message_id: messageId,
    user_id: userId
  }, { onConflict: 'message_id,user_id' });
  return { message: 'Deleted for you' };
}

async function deleteForEveryone(messageId, userId) {
  const { data: msg } = await supabase
    .from('messages')
    .select('sender_id, created_at')
    .eq('id', messageId)
    .single();

  if (!msg || msg.sender_id !== userId) throw new Error('Cannot delete this message');

  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (new Date(msg.created_at).getTime() < hourAgo) {
    throw new Error('Can only delete within 1 hour');
  }

  await supabase.from('messages').update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    content: null
  }).eq('id', messageId);

  return { message: 'Deleted for everyone', messageId };
}

async function pinMessage(messageId, userId, conversationId) {
  await supabase.from('pinned_messages').delete().eq('conversation_id', conversationId);
  const { data, error } = await supabase
    .from('pinned_messages')
    .insert({ message_id: messageId, conversation_id: conversationId, pinned_by: userId })
    .select('*, message:messages(*)')
    .single();
  if (error) throw error;
  return data;
}

async function unpinMessage(conversationId) {
  await supabase.from('pinned_messages').delete().eq('conversation_id', conversationId);
  return { message: 'Unpinned' };
}

async function getPinnedMessage(conversationId) {
  const { data } = await supabase
    .from('pinned_messages')
    .select('*, message:messages(*, sender:users!messages_sender_id_fkey(name, profile_photo))')
    .eq('conversation_id', conversationId)
    .maybeSingle();
  return data;
}

async function starMessage(messageId, userId) {
  const { data: existing } = await supabase
    .from('starred_messages')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('starred_messages').delete().eq('id', existing.id);
    return { starred: false };
  }

  await supabase.from('starred_messages').insert({ message_id: messageId, user_id: userId });
  return { starred: true };
}

async function addReaction(messageId, userId, reaction) {
  await supabase.from('message_reactions').delete()
    .eq('message_id', messageId).eq('user_id', userId);

  const { data, error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: userId, reaction })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function removeReaction(messageId, userId) {
  await supabase.from('message_reactions').delete()
    .eq('message_id', messageId).eq('user_id', userId);
  return { message: 'Reaction removed' };
}

async function searchMessages(userId, query) {
  const { data: convs } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId);

  const convIds = (convs || []).map(c => c.conversation_id);
  if (!convIds.length) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:users!messages_sender_id_fkey(name, profile_photo)')
    .in('conversation_id', convIds)
    .ilike('content', `%${sanitizeInput(query)}%`)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

async function uploadMedia(file, userId) {
  let buffer = file.buffer;
  let contentType = file.mimetype;

  if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
    buffer = await sharp(file.buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    contentType = 'image/jpeg';
  }

  const fileName = `chat/${userId}/${generateFileName(file.originalname)}`;
  const url = await uploadFile(BUCKETS.media, fileName, buffer, contentType);

  let messageType = 'file';
  if (file.mimetype.startsWith('image/')) messageType = file.mimetype === 'image/gif' ? 'gif' : 'image';
  else if (file.mimetype.startsWith('video/')) messageType = 'video';
  else if (file.mimetype.startsWith('audio/')) {
    messageType = /voice/i.test(file.originalname) ? 'voice' : 'audio';
  }

  return { url, name: file.originalname, message_type: messageType };
}

module.exports = {
  sendMessage, getMessages, markAsRead, editMessage,
  deleteForMe, deleteForEveryone, pinMessage, unpinMessage,
  getPinnedMessage, starMessage, addReaction, removeReaction,
  searchMessages, uploadMedia
};
