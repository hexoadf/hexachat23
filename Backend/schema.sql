-- HexaChat Complete Database Schema for Supabase PostgreSQL
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  profile_photo TEXT,
  bio TEXT DEFAULT '',
  about TEXT DEFAULT '',
  is_verified BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OTP CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'signup' CHECK (type IN ('signup', 'reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- ============================================================
-- USER SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dark_theme BOOLEAN DEFAULT TRUE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  read_receipts BOOLEAN DEFAULT TRUE,
  last_seen_visible BOOLEAN DEFAULT TRUE,
  group_notifications BOOLEAN DEFAULT TRUE,
  status_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact ON contacts(contact_id);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  photo TEXT,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT,
  message_type VARCHAR(20) DEFAULT 'text',
  attachment_url TEXT,
  attachment_name TEXT,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_content ON messages USING gin(to_tsvector('english', coalesce(content, '')));

-- ============================================================
-- MESSAGE REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ============================================================
-- PINNED / STARRED / DELETED MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS pinned_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id)
);

CREATE TABLE IF NOT EXISTS starred_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS deleted_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ============================================================
-- STATUS
-- ============================================================
CREATE TABLE IF NOT EXISTS statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(20) DEFAULT 'text',
  background_color VARCHAR(20) DEFAULT '#1e3a5f',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statuses_user ON statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_statuses_expires ON statuses(expires_at);

CREATE TABLE IF NOT EXISTS status_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status_id UUID NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(status_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS status_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status_id UUID NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(status_id, user_id)
);

-- ============================================================
-- CALLS
-- ============================================================
CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type VARCHAR(10) NOT NULL CHECK (call_type IN ('voice', 'video')),
  status VARCHAR(20) NOT NULL DEFAULT 'initiated',
  duration INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON call_history(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver ON call_history(receiver_id);

CREATE TABLE IF NOT EXISTS call_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('media', 'media', true, 52428800, ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','audio/mpeg','audio/wav','audio/ogg','audio/webm','application/pdf','application/zip']),
  ('status', 'status', true, 20971520, ARRAY['image/jpeg','image/png','video/mp4','video/webm']),
  ('groups', 'groups', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; deny anon/authenticated direct access
CREATE POLICY "service_role_all" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON otp_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON conversation_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON groups FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON group_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON message_reactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON pinned_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON starred_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON deleted_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON statuses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON status_views FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON status_reactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON call_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON call_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Storage policies
CREATE POLICY "Public read storage" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars','media','status','groups'));
CREATE POLICY "Service upload storage" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id IN ('avatars','media','status','groups'));
CREATE POLICY "Service update storage" ON storage.objects FOR UPDATE TO service_role USING (bucket_id IN ('avatars','media','status','groups'));
CREATE POLICY "Service delete storage" ON storage.objects FOR DELETE TO service_role USING (bucket_id IN ('avatars','media','status','groups'));

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-delete expired statuses
CREATE OR REPLACE FUNCTION delete_expired_statuses()
RETURNS void AS $$
BEGIN
  DELETE FROM statuses WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Auto-delete expired OTPs
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;
