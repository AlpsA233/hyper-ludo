-- =============================================
-- Phase 3 房间系统 - 增量迁移
-- =============================================
-- 这个文件只包含新增的房间相关表和 RLS 策略
-- 安全执行：不会影响已存在的表

-- 4️⃣ 房间表
-- 存储游戏房间的基本信息
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL, -- 6位房间码（2位数字+4位字母/数字，避免O/I/L）例：42ABCD
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

CREATE POLICY "Room creator can create game state"
  ON room_games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE id = room_id
        AND creator_id = auth.uid()
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
-- 自动清理过期和空房间的函数
-- =============================================

-- 1. 清理过期房间和空房间
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS void AS $$
BEGIN
  -- 删除过期房间（7天未活动）
  DELETE FROM rooms WHERE expires_at < NOW();
  
  -- 删除所有玩家都离开的房间（级联删除 room_games）
  DELETE FROM rooms 
  WHERE id IN (
    SELECT r.id FROM rooms r
    WHERE NOT EXISTS (
      SELECT 1 FROM room_players WHERE room_id = r.id
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 2. 玩家离开后的自动清理触发器
CREATE OR REPLACE FUNCTION cleanup_empty_room_after_player_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- 当玩家离开房间时，检查房间是否已无玩家
  IF NOT EXISTS (SELECT 1 FROM room_players WHERE room_id = OLD.room_id) THEN
    -- 房间无玩家，删除房间及其关联的 room_games 记录
    DELETE FROM room_games WHERE room_id = OLD.room_id;
    DELETE FROM rooms WHERE id = OLD.room_id;
  ELSE
    -- 房间还有玩家，更新 current_players 计数
    UPDATE rooms 
    SET current_players = (SELECT COUNT(*) FROM room_players WHERE room_id = OLD.room_id)
    WHERE id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建触发器：当删除 room_players 时触发清理
DROP TRIGGER IF EXISTS cleanup_empty_room_trigger ON room_players;
CREATE TRIGGER cleanup_empty_room_trigger
AFTER DELETE ON room_players
FOR EACH ROW
EXECUTE FUNCTION cleanup_empty_room_after_player_delete();

-- 4. 在创建 room_games 时自动更新 room 的 expires_at（延长房间生命周期）
CREATE OR REPLACE FUNCTION extend_room_expiry_on_game_start()
RETURNS TRIGGER AS $$
BEGIN
  -- 游戏开始时，延长房间过期时间到 24 小时后
  UPDATE rooms 
  SET expires_at = NOW() + INTERVAL '24 hours'
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器：当创建 room_games 时触发
DROP TRIGGER IF EXISTS extend_room_expiry_trigger ON room_games;
CREATE TRIGGER extend_room_expiry_trigger
AFTER INSERT ON room_games
FOR EACH ROW
EXECUTE FUNCTION extend_room_expiry_on_game_start();

-- =============================================
-- 可选：用 pg_cron 定期执行清理（企业版 Supabase 支持）
-- 如果你的 Supabase 版本不支持 pg_cron，可以手动调用以下函数
-- =============================================
-- SELECT cleanup_expired_rooms(); -- 手动执行

-- 每天凌晨1点执行一次清理（需要 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-rooms', '0 1 * * *', 'SELECT cleanup_expired_rooms();');
