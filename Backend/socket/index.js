const { verifyToken } = require('../utils/jwt');
const userService = require('../services/userService');
const callService = require('../services/callService');
const notificationService = require('../services/notificationService');
const supabase = require('../config/database');

const onlineUsers = new Map();
const activeCalls = new Map();

function setupSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyToken(token);
      const { data: user } = await supabase
        .from('users')
        .select('id, name, profile_photo, is_verified')
        .eq('id', decoded.userId)
        .single();
      if (!user || !user.is_verified) return next(new Error('Invalid user'));
      socket.userId = user.id;
      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    onlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);

    userService.updateOnlineStatus(userId, true);
    io.emit('user_online', { user_id: userId });

    supabase.from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        (data || []).forEach(m => socket.join(`conversation:${m.conversation_id}`));
      });

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing_start', ({ conversation_id }) => {
      socket.to(`conversation:${conversation_id}`).emit('typing', {
        user_id: userId, conversation_id, is_typing: true
      });
    });

    socket.on('typing_stop', ({ conversation_id }) => {
      socket.to(`conversation:${conversation_id}`).emit('typing', {
        user_id: userId, conversation_id, is_typing: false
      });
    });

    socket.on('message_delivered', ({ message_id, conversation_id }) => {
      socket.to(`conversation:${conversation_id}`).emit('message_delivered', {
        message_id, user_id: userId
      });
    });

    socket.on('call_initiate', async ({ receiver_id, call_type }) => {
      const receiverSocket = onlineUsers.get(receiver_id);
      const busyReceiver = [...activeCalls.values()].some(c =>
        c.receiver_id === receiver_id || c.caller_id === receiver_id
      );
      const busyCaller = [...activeCalls.values()].some(c =>
        c.caller_id === userId || c.receiver_id === userId
      );

      if (busyCaller) {
        socket.emit('call_busy', { reason: 'You are already in a call' });
        return;
      }

      if (busyReceiver || !receiverSocket) {
        const call = await callService.createCallRecord(userId, receiver_id, call_type, busyReceiver ? 'busy' : 'missed');
        if (!receiverSocket) {
          await callService.updateCallStatus(call.id, 'missed');
          socket.emit('call_missed', { call_id: call.id });
        } else {
          socket.emit('call_busy', { call_id: call.id });
          io.to(receiverSocket).emit('call_busy_notification', { caller: socket.user });
        }
        return;
      }

      const call = await callService.createCallRecord(userId, receiver_id, call_type, 'ringing');
      activeCalls.set(call.id, { call_id: call.id, caller_id: userId, receiver_id, call_type, status: 'ringing' });

      io.to(receiverSocket).emit('incoming_call', {
        call_id: call.id,
        caller: socket.user,
        call_type
      });

      socket.emit('outgoing_call', {
        call_id: call.id,
        receiver_id,
        call_type
      });

      await notificationService.createNotification(receiver_id, {
        type: 'call',
        title: `Incoming ${call_type} call`,
        body: `${socket.user.name} is calling`,
        data: { call_id: call.id, caller_id: userId, call_type }
      });
    });

    socket.on('call_accept', async ({ call_id }) => {
      const callData = activeCalls.get(call_id);
      if (!callData || callData.receiver_id !== userId) return;

      callData.status = 'active';
      activeCalls.set(call_id, callData);
      await callService.updateCallStatus(call_id, 'active');

      const callerSocket = onlineUsers.get(callData.caller_id);
      if (callerSocket) {
        io.to(callerSocket).emit('call_accepted', {
          call_id,
          receiver: socket.user,
          call_type: callData.call_type
        });
        io.to(callerSocket).emit('call_connected', {
          call_id,
          peer_id: userId,
          call_type: callData.call_type
        });
      }
      socket.emit('call_connected', {
        call_id,
        peer_id: callData.caller_id,
        call_type: callData.call_type
      });
    });

    socket.on('call_reject', async ({ call_id }) => {
      const callData = activeCalls.get(call_id);
      if (!callData) return;

      await callService.updateCallStatus(call_id, 'rejected');
      activeCalls.delete(call_id);

      const otherId = callData.caller_id === userId ? callData.receiver_id : callData.caller_id;
      const otherSocket = onlineUsers.get(otherId);
      if (otherSocket) io.to(otherSocket).emit('call_rejected', { call_id });
    });

    socket.on('call_end', async ({ call_id, duration }) => {
      const callData = activeCalls.get(call_id);
      if (!callData) return;

      await callService.updateCallStatus(call_id, 'ended', duration || 0);
      activeCalls.delete(call_id);

      const otherId = callData.caller_id === userId ? callData.receiver_id : callData.caller_id;
      const otherSocket = onlineUsers.get(otherId);
      if (otherSocket) io.to(otherSocket).emit('call_ended', { call_id, duration });
      socket.emit('call_ended', { call_id, duration });
    });

    socket.on('webrtc_offer', async ({ call_id, receiver_id, offer }) => {
      await callService.saveSignal(userId, receiver_id, 'offer', offer);
      const callData = activeCalls.get(call_id);
      const receiverSocket = onlineUsers.get(receiver_id);
      if (receiverSocket) {
        io.to(receiverSocket).emit('webrtc_offer', {
          call_id,
          caller_id: userId,
          offer,
          call_type: callData?.call_type || 'voice'
        });
      }
    });

    socket.on('webrtc_answer', async ({ call_id, caller_id, answer }) => {
      await callService.saveSignal(userId, caller_id, 'answer', answer);
      const callerSocket = onlineUsers.get(caller_id);
      if (callerSocket) {
        io.to(callerSocket).emit('webrtc_answer', { call_id, answer });
      }
    });

    socket.on('webrtc_ice_candidate', ({ receiver_id, candidate, call_id }) => {
      const receiverSocket = onlineUsers.get(receiver_id);
      if (receiverSocket) {
        io.to(receiverSocket).emit('webrtc_ice_candidate', { candidate, call_id, sender_id: userId });
      }
    });

    socket.on('call_reconnect', ({ call_id }) => {
      const callData = activeCalls.get(call_id);
      if (!callData) return;
      const otherId = callData.caller_id === userId ? callData.receiver_id : callData.caller_id;
      const otherSocket = onlineUsers.get(otherId);
      if (otherSocket) io.to(otherSocket).emit('call_reconnect_request', { call_id });
    });

    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await userService.updateOnlineStatus(userId, false);
      io.emit('user_offline', { user_id: userId, last_seen: new Date().toISOString() });

      for (const [callId, callData] of activeCalls.entries()) {
        if (callData.caller_id === userId || callData.receiver_id === userId) {
          await callService.updateCallStatus(callId, 'ended', 0);
          const otherId = callData.caller_id === userId ? callData.receiver_id : callData.caller_id;
          const otherSocket = onlineUsers.get(otherId);
          if (otherSocket) io.to(otherSocket).emit('call_ended', { call_id: callId, reason: 'disconnect' });
          activeCalls.delete(callId);
        }
      }
    });
  });
}

module.exports = { setupSocket, onlineUsers, activeCalls };
