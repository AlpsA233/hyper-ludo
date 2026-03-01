-- =============================================
-- RLS 策略修复 - 修复 room_players Realtime 订阅权限
-- =============================================
-- 问题：A看不到B加入，因为Realtime权限检查存在问题
-- 解决：用更简单、更Realtime友好的RLS策略取代

-- 删除原有的复杂策略（使用递归子查询）
DROP POLICY IF EXISTS "Room players can view all players in their room" ON room_players;

-- 添加新的、更简单的策略（类似room_games已有的模式）
-- 这个策略说：只要你在某个房间里，你就能看到这个房间的所有玩家
CREATE POLICY "Room players can view room members - simplified"
  ON room_players FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM room_players WHERE user_id = auth.uid()
    )
  );

-- 注意：这个策略等效于原来的，但使用了更简单的 IN 子查询
-- 而不是 EXISTS，这对 Realtime RLS 检查更友好
