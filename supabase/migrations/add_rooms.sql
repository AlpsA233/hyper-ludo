-- =============================================
-- Phase 3 房间系统 - 增量迁移
-- =============================================
-- 这个文件只包含新增的房间相关表和 RLS 策略
-- 安全执行：不会影响已存在的表

-- 4️⃣ 房间表
-- 存储游戏房间的基本信息
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL, -- 6位房间码：000000-999999
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT DEFAULT 'waiting', -- waiting | playing | finished
  max_players INT DEFAULT 4,
  current_players INT DEFAULT 0,
  
  -- 游戏配置（从创建者的设置复制）
  num_players INT DEFAULT 4,
  dice_count INT DEFAULT 1,
  laps_to_win INT DEFAULT 3,
  initial_cards INT DEFAULT 5,
  event_density INT DEFAULT 40,
  
  -- 自定义数据库ID（指向user_cards和user_events的配置）
  cards_config_id BIGINT, -- 可选，指向某个保存的卡牌库
  events_config_id BIGINT, -- 可选，指向某个保存的事件库
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days' -- 7天后自动清理
);

-- 5️⃣ 房间玩家表
-- 存储每个房间中的玩家及其位置、状态
CREATE TABLE IF NOT EXISTS room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_index INT NOT NULL, -- 玩家编号 0-7
  
  -- 玩家UI信息
  player_name TEXT,
  avatar TEXT,
  color_index INT,
  
  -- 游戏状态（实时更新）
  position INT DEFAULT -1,
  lap INT DEFAULT 0,
  cards JSONB DEFAULT '[]'::JSONB,
  shield BOOLEAN DEFAULT FALSE,
  skip_turn BOOLEAN DEFAULT FALSE,
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6️⃣ 房间游戏状态表
-- 存储房间中的实时游戏状态
CREATE TABLE IF NOT EXISTS room_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- 游戏流程状态
  turn INT DEFAULT 0, -- 当前回合（0-based，对应player_index）
  phase TEXT DEFAULT 'setup', -- setup | playing | event | win
  
  -- 掷骰结果
  dice_value INT,
  dice_results JSONB, -- [1, 2, 3] for 3 dice
  
  -- 事件和卡牌
  active_event JSONB, -- 当前触发的事件
  active_card JSONB, -- 当前使用的卡牌
  
  -- 游戏历史日志
  logs JSONB DEFAULT '[]'::JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) 策略
-- =============================================

-- 启用 RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_games ENABLE ROW LEVEL SECURITY;

-- 房间表策略
CREATE POLICY "Anyone can view rooms"
  ON rooms FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Room creator can update room"
  ON rooms FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Room creator can delete room"
  ON rooms FOR DELETE
  USING (auth.uid() = creator_id);

-- 房间玩家表策略
CREATE POLICY "Room players can view their room - self"
  ON room_players FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Room players can view their room - creators"
  ON room_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE id = room_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Room players can view their room - participants"
  ON room_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_id
        AND EXISTS (
          SELECT 1 FROM room_players rp
          WHERE rp.room_id = r.id AND rp.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can insert themselves as room player"
  ON room_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Room players can update their state"
  ON room_players FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Room players can delete themselves"
  ON room_players FOR DELETE
  USING (auth.uid() = user_id);

-- 房间游戏状态表策略
CREATE POLICY "Room players can view game state"
  ON room_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_players
      WHERE room_id = room_games.room_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Room creator can update game state"
  ON room_games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE id = room_games.room_id
        AND creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE id = room_games.room_id
        AND creator_id = auth.uid()
    )
  );

-- =============================================
-- 索引优化
-- =============================================

CREATE INDEX IF NOT EXISTS idx_rooms_creator_id ON rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_rooms_state ON rooms(state);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON room_players(user_id);
CREATE INDEX IF NOT EXISTS idx_room_games_room_id ON room_games(room_id);

-- =============================================
-- 自动清理过期房间的函数（可选，需要定期运行）
-- =============================================

CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM rooms WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
