const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function getOrCreateConversation(userId1, userId2) {
  const { data: myConvs } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId1);

  const myConvIds = (myConvs || []).map(c => c.conversation_id);

  if (myConvIds.length) {
    const { data: shared } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId2)
      .in('conversation_id', myConvIds);

    for (const row of shared || []) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, type')
        .eq('id', row.conversation_id)
        .eq('type', 'direct')
        .maybeSingle();
      if (conv) return conv.id;
    }
  }

  const conversationId = uuidv4();
  await supabase.from('conversations').insert({
    id: conversationId,
    type: 'direct',
    created_by: userId1
  });

  await supabase.from('conversation_members').insert([
    { conversation_id: conversationId, user_id: userId1 },
    { conversation_id: conversationId, user_id: userId2 }
  ]);

  return conversationId;
}

async function getUserChats(userId) {
  const { data: contactRows } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('user_id', userId)
    .eq('is_blocked', false);

  for (const row of contactRows || []) {
    await getOrCreateConversation(userId, row.contact_id);
  }

  const { data: memberships, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      conversations (
        id, type, name, avatar_url, created_at, updated_at, created_by
      )
    `)
    .eq('user_id', userId);

  if (error) throw error;

  const chats = [];
  const seen = new Set();

  for (const m of memberships || []) {
    const conv = m.conversations;
    if (!conv || seen.has(conv.id)) continue;
    seen.add(conv.id);

    let chatInfo = { ...conv };

    if (conv.type === 'direct') {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conv.id)
        .neq('user_id', userId);

      if (members?.[0]) {
        const { data: user } = await supabase
          .from('users')
          .select('id, name, profile_photo, is_online, last_seen, phone_number')
          .eq('id', members[0].user_id)
          .single();
        if (user) {
          chatInfo.participant = user;
          chatInfo.name = user.name;
          chatInfo.avatar_url = user.profile_photo;
        }
      }
    } else if (conv.type === 'group') {
      const { data: group } = await supabase
        .from('groups')
        .select('id, name, photo, description')
        .eq('id', conv.id)
        .maybeSingle();
      if (group) {
        chatInfo.name = group.name;
        chatInfo.avatar_url = group.photo;
        chatInfo.description = group.description;
        chatInfo.group_id = group.id;
      }
    }

    const { data: lastMsg } = await supabase
      .from('messages')
      .select('id, content, message_type, sender_id, created_at, is_deleted')
      .eq('conversation_id', conv.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', userId)
      .eq('is_read', false)
      .eq('is_deleted', false);

    chatInfo.last_message = lastMsg;
    chatInfo.unread_count = count || 0;
    chats.push(chatInfo);
  }

  chats.sort((a, b) => {
    const aTime = a.last_message?.created_at || a.updated_at || a.created_at;
    const bTime = b.last_message?.created_at || b.updated_at || b.created_at;
    return new Date(bTime) - new Date(aTime);
  });

  return chats;
}

async function clearChat(conversationId, userId) {
  const { data: member } = await supabase
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) throw new Error('Access denied');

  const { data: messages } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId);

  if (messages?.length) {
    const inserts = messages.map(m => ({
      message_id: m.id,
      user_id: userId
    }));
    await supabase.from('deleted_messages').upsert(inserts, { onConflict: 'message_id,user_id' });
  }

  return { message: 'Chat cleared', conversation_id: conversationId };
}

async function searchChats(userId, query) {
  const chats = await getUserChats(userId);
  const q = query.toLowerCase();
  return chats.filter(c =>
    c.name?.toLowerCase().includes(q) ||
    c.participant?.phone_number?.includes(q) ||
    c.last_message?.content?.toLowerCase().includes(q)
  );
}

module.exports = { getOrCreateConversation, getUserChats, searchChats, clearChat };
