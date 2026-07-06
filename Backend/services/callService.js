const supabase = require('../config/database');

async function createCallRecord(callerId, receiverId, callType, status = 'initiated') {
  const { data, error } = await supabase
    .from('call_history')
    .insert({
      caller_id: callerId,
      receiver_id: receiverId,
      call_type: callType,
      status,
      started_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function updateCallStatus(callId, status, duration = null) {
  const updates = { status };
  if (status === 'ended' || status === 'missed' || status === 'rejected') {
    updates.ended_at = new Date().toISOString();
  }
  if (duration !== null) updates.duration = duration;

  const { data, error } = await supabase
    .from('call_history')
    .update(updates)
    .eq('id', callId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getCallHistory(userId, page = 1, limit = 30) {
  const offset = (page - 1) * limit;

  const { data, error } = await supabase
    .from('call_history')
    .select(`
      *,
      caller:users!call_history_caller_id_fkey (id, name, profile_photo),
      receiver:users!call_history_receiver_id_fkey (id, name, profile_photo)
    `)
    .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data || []).map(call => ({
    ...call,
    direction: call.caller_id === userId ? 'outgoing' : 'incoming',
    contact: call.caller_id === userId ? call.receiver : call.caller
  }));
}

async function saveSignal(callerId, receiverId, signalType, signalData) {
  await supabase.from('call_signals').insert({
    caller_id: callerId,
    receiver_id: receiverId,
    signal_type: signalType,
    signal_data: signalData
  });
}

module.exports = {
  createCallRecord, updateCallStatus, getCallHistory, saveSignal
};
