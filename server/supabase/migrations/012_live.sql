-- 012_live.sql
-- 유료 1:N 라이브 기능 스키마

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS live_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_enabled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_live_now BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS live_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  entry_fee_points INTEGER NOT NULL DEFAULT 50000,
  viewer_limit INTEGER NOT NULL DEFAULT 10,
  planned_duration_min INTEGER NOT NULL CHECK (planned_duration_min IN (30, 60)),
  scheduled_end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'live', 'ended', 'cancelled')),
  agora_channel TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  extension_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_rooms_status_started ON live_rooms(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_rooms_host_created ON live_rooms(host_id, created_at DESC);

ALTER TABLE live_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_rooms_read_authenticated" ON live_rooms;
CREATE POLICY "live_rooms_read_authenticated" ON live_rooms
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "live_rooms_host_write" ON live_rooms;
CREATE POLICY "live_rooms_host_write" ON live_rooms
  FOR ALL USING (auth.uid() = host_id);

CREATE TABLE IF NOT EXISTS live_room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('host', 'viewer', 'admin')),
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'left', 'kicked')),
  paid_points INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  join_ack_at TIMESTAMPTZ,
  blocked_until_room_end BOOLEAN NOT NULL DEFAULT false,
  refund_status TEXT NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'pending', 'refunded')),
  chat_muted_until TIMESTAMPTZ,
  chat_muted_by UUID REFERENCES users(id),
  chat_muted_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_room_participants_room_role_status
  ON live_room_participants(room_id, role, status);
CREATE INDEX IF NOT EXISTS idx_live_room_participants_user_created
  ON live_room_participants(user_id, created_at DESC);

ALTER TABLE live_room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_room_participants_read_self" ON live_room_participants;
CREATE POLICY "live_room_participants_read_self" ON live_room_participants
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "live_room_participants_write_self" ON live_room_participants;
CREATE POLICY "live_room_participants_write_self" ON live_room_participants
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('host', 'viewer', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_room_created
  ON live_chat_messages(room_id, created_at ASC);

ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_chat_messages_read_authenticated" ON live_chat_messages;
CREATE POLICY "live_chat_messages_read_authenticated" ON live_chat_messages
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "live_chat_messages_write_self" ON live_chat_messages;
CREATE POLICY "live_chat_messages_write_self" ON live_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE TABLE IF NOT EXISTS live_moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  actor_role TEXT NOT NULL CHECK (actor_role IN ('host', 'admin')),
  action TEXT NOT NULL CHECK (action IN ('kick', 'mute_user', 'unmute_user', 'lock_chat', 'unlock_chat', 'force_end')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_moderation_actions_room_created
  ON live_moderation_actions(room_id, created_at DESC);

ALTER TABLE live_moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_moderation_actions_read_authenticated" ON live_moderation_actions;
CREATE POLICY "live_moderation_actions_read_authenticated" ON live_moderation_actions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS live_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  added_duration_min INTEGER NOT NULL CHECK (added_duration_min IN (30, 60)),
  previous_end_at TIMESTAMPTZ NOT NULL,
  new_end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_extensions_room_created
  ON live_extensions(room_id, created_at DESC);

ALTER TABLE live_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_extensions_read_authenticated" ON live_extensions;
CREATE POLICY "live_extensions_read_authenticated" ON live_extensions
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE gifts
  ADD COLUMN IF NOT EXISTS live_room_id UUID REFERENCES live_rooms(id) ON DELETE SET NULL;

ALTER TABLE live_rooms
  ADD COLUMN IF NOT EXISTS chat_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_locked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS chat_locked_at TIMESTAMPTZ;

ALTER TABLE gifts
  DROP CONSTRAINT IF EXISTS gifts_target_context_check;

ALTER TABLE gifts
  ADD CONSTRAINT gifts_target_context_check
  CHECK (
    (call_session_id IS NOT NULL AND live_room_id IS NULL)
    OR (call_session_id IS NULL AND live_room_id IS NOT NULL)
  );

INSERT INTO system_config (key, value, updated_at) VALUES
  ('live_entry_fee_points', '50000', NOW()),
  ('live_viewer_limit', '10', NOW()),
  ('live_max_extension_count', '2', NOW()),
  ('live_join_ack_timeout_sec', '10', NOW())
ON CONFLICT (key) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE live_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE live_room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE live_moderation_actions;
