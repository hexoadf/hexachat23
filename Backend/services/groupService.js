const supabase = require('../config/database');
const { BUCKETS, uploadFile } = require('../config/storage');
const { generateFileName } = require('../middleware/upload');
const { sanitizeInput } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const GROUP_MIN_MEMBERS = 1;
const GROUP_MAX_MEMBERS = 1000;

async function createGroup(creatorId, { name, description, memberIds, photo }) {
  const filtered = (memberIds || []).filter(id => id !== creatorId);
  if (filtered.length < GROUP_MIN_MEMBERS) {
    throw new Error(`Add at least ${GROUP_MIN_MEMBERS} member to the group`);
  }

  const groupId = uuidv4();
  const cleanName = sanitizeInput(name);
  const cleanDesc = description ? sanitizeInput(description) : null;

  let photoUrl = null;
  if (photo) {
    const buffer = await sharp(photo.buffer).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    photoUrl = await uploadFile(BUCKETS.groups, `groups/${groupId}/${generateFileName(photo.originalname)}`, buffer, 'image/jpeg');
  }

  await supabase.from('groups').insert({
    id: groupId,
    name: cleanName,
    description: cleanDesc,
    photo: photoUrl,
    created_by: creatorId
  });

  await supabase.from('conversations').insert({
    id: groupId,
    type: 'group',
    name: cleanName,
    avatar_url: photoUrl,
    created_by: creatorId
  });

  const allMembers = [creatorId, ...filtered];
  const uniqueMembers = [...new Set(allMembers)];

  if (uniqueMembers.length > GROUP_MAX_MEMBERS) {
    throw new Error(`Group cannot exceed ${GROUP_MAX_MEMBERS} members`);
  }

  const memberInserts = uniqueMembers.map((userId, idx) => ({
    group_id: groupId,
    user_id: userId,
    role: userId === creatorId ? 'admin' : 'member'
  }));

  await supabase.from('group_members').insert(memberInserts);

  const convMemberInserts = uniqueMembers.map(userId => ({
    conversation_id: groupId,
    user_id: userId
  }));
  await supabase.from('conversation_members').insert(convMemberInserts);

  const { data } = await supabase.from('groups').select('*').eq('id', groupId).single();
  return data;
}

async function getGroup(groupId, userId) {
  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) throw new Error('Not a group member');

  const { data: group, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) throw error;

  const { data: members } = await supabase
    .from('group_members')
    .select('role, joined_at, user:users(id, name, profile_photo, is_online)')
    .eq('group_id', groupId);

  group.members = members || [];
  return group;
}

async function getUserGroups(userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('group:groups(id, name, photo, description, created_at)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map(d => d.group).filter(Boolean);
}

async function addMembers(groupId, adminId, memberIds) {
  const { data: admin } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', adminId)
    .single();

  if (!admin || admin.role !== 'admin') throw new Error('Only admins can add members');

  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  const currentCount = count || 0;
  const newIds = memberIds.filter(id => id !== adminId);
  if (!newIds.length) throw new Error(`Select at least ${GROUP_MIN_MEMBERS} member`);

  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .in('user_id', newIds);

  const existingSet = new Set((existing || []).map(e => e.user_id));
  const toAdd = newIds.filter(id => !existingSet.has(id));

  if (currentCount + toAdd.length > GROUP_MAX_MEMBERS) {
    throw new Error(`Group cannot exceed ${GROUP_MAX_MEMBERS} members`);
  }
  if (!toAdd.length) throw new Error('Selected members are already in the group');

  const inserts = toAdd.map(userId => ({
    group_id: groupId,
    user_id: userId,
    role: 'member'
  }));

  await supabase.from('group_members').upsert(inserts, { onConflict: 'group_id,user_id', ignoreDuplicates: true });

  const convInserts = toAdd.map(userId => ({
    conversation_id: groupId,
    user_id: userId
  }));
  await supabase.from('conversation_members').upsert(convInserts, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true });

  return { message: 'Members added', added: toAdd };
}

async function removeMember(groupId, adminId, memberId) {
  const { data: admin } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', adminId)
    .single();

  if (!admin || admin.role !== 'admin') throw new Error('Only admins can remove members');
  if (memberId === adminId) throw new Error('Cannot remove yourself as admin');

  await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', memberId);
  await supabase.from('conversation_members').delete().eq('conversation_id', groupId).eq('user_id', memberId);
  return { message: 'Member removed' };
}

async function promoteAdmin(groupId, adminId, memberId) {
  const { data: admin } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', adminId)
    .single();

  if (!admin || admin.role !== 'admin') throw new Error('Only admins can promote');

  await supabase.from('group_members').update({ role: 'admin' }).eq('group_id', groupId).eq('user_id', memberId);
  return { message: 'Member promoted to admin' };
}

async function leaveGroup(groupId, userId) {
  await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  await supabase.from('conversation_members').delete().eq('conversation_id', groupId).eq('user_id', userId);
  return { message: 'Left group' };
}

async function deleteGroup(groupId, userId) {
  const { data: group } = await supabase.from('groups').select('created_by').eq('id', groupId).single();
  if (!group || group.created_by !== userId) throw new Error('Only creator can delete group');

  await supabase.from('group_members').delete().eq('group_id', groupId);
  await supabase.from('conversation_members').delete().eq('conversation_id', groupId);
  await supabase.from('messages').delete().eq('group_id', groupId);
  await supabase.from('conversations').delete().eq('id', groupId);
  await supabase.from('groups').delete().eq('id', groupId);
  return { message: 'Group deleted' };
}

async function updateGroup(groupId, userId, updates) {
  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!member || member.role !== 'admin') throw new Error('Only admins can update group');

  const allowed = {};
  if (updates.name) allowed.name = sanitizeInput(updates.name);
  if (updates.description !== undefined) allowed.description = sanitizeInput(updates.description);

  if (updates.photo) {
    const buffer = await sharp(updates.photo.buffer).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    allowed.photo = await uploadFile(BUCKETS.groups, `groups/${groupId}/${generateFileName(updates.photo.originalname)}`, buffer, 'image/jpeg');
  }

  const { data, error } = await supabase.from('groups').update(allowed).eq('id', groupId).select('*').single();
  if (error) throw error;

  if (allowed.name || allowed.photo) {
    await supabase.from('conversations').update({
      name: allowed.name || data.name,
      avatar_url: allowed.photo || data.photo
    }).eq('id', groupId);
  }

  return data;
}

async function getGroupMemberIds(groupId) {
  const { data } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  return (data || []).map(d => d.user_id);
}

module.exports = {
  createGroup, getGroup, getUserGroups, getGroupMemberIds, addMembers, removeMember,
  promoteAdmin, leaveGroup, deleteGroup, updateGroup
};
