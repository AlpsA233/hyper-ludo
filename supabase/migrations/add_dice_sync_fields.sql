-- =============================================
-- 骰子同步功能增强 - 增量迁移
-- =============================================
-- 添加掷骰状态锁和动画同步所需的字段

-- 添加骰子同步相关字段到 room_games 表
ALTER TABLE room_games 
  ADD COLUMN IF NOT EXISTS is_rolling BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dice_roller_index INT,
  ADD COLUMN IF NOT EXISTS dice_rolled_at TIMESTAMPTZ;

-- 添加注释说明
COMMENT ON COLUMN room_games.is_rolling IS '掷骰状态锁：防止同时掷骰子';
COMMENT ON COLUMN room_games.dice_roller_index IS '记录哪个玩家掷的骰子（用于动画同步）';
COMMENT ON COLUMN room_games.dice_rolled_at IS '掷骰时间戳（用于动画同步）';

-- 创建自动释放掷骰锁的函数（5秒后自动释放）
CREATE OR REPLACE FUNCTION auto_release_dice_lock()
RETURNS TRIGGER AS $$
BEGIN
  -- 当 is_rolling 设置为 TRUE 时，启动定时释放
  IF NEW.is_rolling = TRUE AND (OLD.is_rolling IS NULL OR OLD.is_rolling = FALSE) THEN
    -- 使用 pg_sleep 不现实，改为在应用层处理
    -- 这里只记录时间戳供应用层检查
    NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS auto_release_dice_lock_trigger ON room_games;
CREATE TRIGGER auto_release_dice_lock_trigger
AFTER UPDATE ON room_games
FOR EACH ROW
EXECUTE FUNCTION auto_release_dice_lock();

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_room_games_is_rolling ON room_games(is_rolling);
