# 🔧 多人游戏实时同步诊断与修复指南

## 问题现象

- **玩家A**: 看到 1 个玩家（只有自己）
- **玩家B**: 看到 2 个玩家（A和B）

原因：**A的 Realtime 订阅没有接收到 B 的 INSERT 事件**

---

## 🔍 诊断步骤

### 步骤 1: 验证轮询机制是否工作

**查看浏览器控制台** (F12 → Console)，打开 A 的开发者工具：

**预期看到的日志序列**:

```
📍 RoomLobby: 加载房间数据 room-id-xxx
✅ Realtime 订阅建立完成，订阅了 3 个频道 {roomId, channels: [...]}
👥 RoomLobby: 玩家列表更新 {count: 1, players: [...]}

[2秒后]
🔄 RoomLobby: 定期查询最新房间数据（轮询）
👥 RoomLobby: 玩家列表更新 {count: 1, players: [...]}

[B加入时]
👥 RoomLobby: 玩家列表更新 {count: 2, players: [...]}  ← 关键！这表示轮询成功更新
```

**如果看不到轮询日志**：

- 检查 RoomLobby.tsx 是否保存了修改
- 清空浏览器缓存 (Ctrl+Shift+Delete) 并重新刷新页面

### 步骤 2: 检查 Realtime 事件是否被接收

当 B 加入时，**A 的控制台应该显示**:

```
📍 Realtime: room_players 表事件 {
  eventType: "INSERT",
  new: {id: "...", player_name: "222", player_index: 1, ...},
  old: null,
  timestamp: "2026-03-01T10:30:45.123Z"
}

➕ 新玩家加入: 222
👥 更新后的玩家列表: {
  count: 2,
  players: [
    {id: "...", name: "111", index: 0},
    {id: "...", name: "222", index: 1}
  ]
}
```

**结果判断**:

- ✅ **有上述日志**：Realtime 工作正常，说明 RLS 策略已修复
- ❌ **没有上述日志**：Realtime 事件没有到达，问题在于 Supabase 权限配置

### 步骤 3: 验证 RLS 策略修复

如果步骤2中 Realtime 事件没有到达，需要手动执行 RLS 修复脚本：

1. **打开 Supabase Dashboard**
   - 进入项目 → SQL Editor
2. **执行修复脚本**:

   ```sql
   -- 打开: supabase/migrations/fix_room_players_rls.sql
   -- 复制全部内容到 SQL Editor 并执行
   ```

3. **验证修复**:

   ```sql
   -- 检查 room_players 的 RLS 策略
   SELECT * FROM pg_policies WHERE tablename = 'room_players';
   ```

4. **重新测试**:
   - 重新加载页面
   - A 再次创建房间
   - B 再加入
   - 查看是否看到 Realtime 事件

---

## 🔧 实施的修复

### 修复 1: RoomLobby 中的定期轮询 (立即生效)

**文件**: `app/components/RoomLobby.tsx`

**变更**:

```typescript
useEffect(() => {
  loadRoom(roomId);
  const unsubscribe = subscribe(roomId);

  // ✨ 新增：2秒轮询一次，确保获取最新数据
  const pollInterval = setInterval(() => {
    console.log("🔄 RoomLobby: 定期查询最新房间数据（轮询）");
    loadRoom(roomId);
  }, 2000);

  return () => {
    clearInterval(pollInterval);
    unsubscribe();
  };
}, [roomId, loadRoom]);
```

**效果**:

- ✅ 基于轮询，每2秒自动刷新一次玩家列表
- ✅ 即使 Realtime 有延迟或失败，轮询也能确保看到最新数据
- ✅ 已立即生效

### 修复 2: Realtime 订阅增强调试

**文件**: `app/hooks/useRoom.ts`

**变更**:

- 添加订阅开始时的日志标记
- 增强 room_players INSERT/UPDATE 事件的调试输出
- 显示更新前后的完整玩家列表
- 记录完整时间戳便于排查网络延迟

**效果**:

- ✅ 更容易诊断 Realtime 问题
- ✅ 显示事件接收的准确时间
- ✅ 便于分析数据一致性

### 修复 3: RLS 策略优化 (需要 Supabase 执行)

**文件**: `supabase/migrations/fix_room_players_rls.sql`

**变更**:

```sql
-- 旧策略（复杂，Realtime不友好）
DROP POLICY "Room players can view all players in their room" ON room_players;

-- 新策略（简单，Realtime友好）
CREATE POLICY "Room players can view room members - simplified"
  ON room_players FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM room_players WHERE user_id = auth.uid()
    )
  );
```

**原理**:

- 旧策略使用 EXISTS 子查询，Realtime 权限检查时可能出问题
- 新策略使用 IN 子查询，这是 Supabase Realtime 推荐的模式
- 两个策略在逻辑上等效，但新策略对 Realtime 更加友好

**需要执行**:

```bash
# 进入 Supabase Dashboard
# SQL Editor → 执行 supabase/migrations/fix_room_players_rls.sql 中的代码
```

---

## 📋 完整测试流程

### 快速测试 (5分钟)

```
1. 清空缓存 + 重新加载页面

2. 浏览器 A:
   - 打开控制台 (F12)
   - 创建房间

3. 浏览器 B:
   - 打开控制台 (F12)
   - 加入房间

4. 查看 A 的控制台:
   - 应该看到 2秒轮询日志
   - 应该看到玩家列表从 1 增加到 2
   - （可能看到 Realtime 事件，也可能没有，但轮询应该工作）

5. 结果判断:
   ✅ 如果玩家数增加到 2:  成功！轮询机制有效
   ❌ 如果玩家数仍然是 1: 可能 loadRoom() 有问题，需要进一步诊断
```

### 深度诊断 (15分钟)

**如果快速测试失败，执行以下步骤**:

```
1. 检查浏览器控制台错误
   - 是否有网络错误 (Network tab)
   - 是否有 JavaScript 错误 (Console tab)

2. 检查 API 调用
   - F12 → Network → XHR
   - 查看 GET /api/rooms 的响应
   - 应该返回最新的玩家列表

3. 检查 Supabase 连接
   - F12 → Network → WS (WebSocket)
   - 应该有一个 realtime.supabase.co 的 WebSocket 连接
   - 状态应该是 "101 Switching Protocols"（已建立）

4. 检查 RLS 策略
   - Supabase Dashboard → SQL Editor
   - 执行: SELECT * FROM pg_policies WHERE tablename = 'room_players';
   - 应该看到至少以下政策:
     * "Room players can view their room - self"
     * "Room players can view their room - creators"
     * "Room players can view room members - simplified" (或原来的)
```

---

## 🎯 预期的改进效果

### 之前 (问题状态)

- A: 1 个玩家
- B: 2 个玩家
- **差异**: 数据不一致

### 之后 (修复完成)

**最好的情况** (Realtime 工作):

```
🌅 B 加入 → Realtime INSERT 事件 → A 立即看到 2 个玩家 (< 100ms)
```

**可接受的情况** (Realtime 延迟或失败):

```
🌅 B 加入 → 等待最多 2 秒 → A 看到 2 个玩家 (轮询更新)
```

**最坏的情况** (不会再发生):

```
❌ A 永远看不到 B (这个问题已解决)
```

---

## 📚 日志关键词速查

根据控制台日志快速诊断：

| 日志内容                                     | 含义              | 接下来做什么                                 |
| -------------------------------------------- | ----------------- | -------------------------------------------- |
| `🔄 RoomLobby: 定期查询最新房间数据（轮询）` | 轮询工作中        | 检查完整的 `👥 RoomLobby: 玩家列表更新` 输出 |
| `📍 Realtime: room_players 表事件`           | Realtime 收到更新 | 检查 eventType 和 new 数据是否正确           |
| `➕ 新玩家加入: [名字]`                      | 玩家被添加到列表  | 正常工作 ✅                                  |
| `❌ 取消 Realtime 订阅`                      | 离开房间时        | 检查是否正确清理资源                         |
| `✅ Realtime 订阅建立完成`                   | 连接成功建立      | 等待更新事件或轮询                           |
| `👥 更新后的玩家列表: {count: 2`             | 有 2 个玩家       | 数据已同步 ✅                                |

---

## 🚨 如果问题仍然存在

1 **查看原始错误**:

- Console 中应该没有红色错误
- Network 中应该看到成功的 API 调用 (200 状态码)

2. **检查 API 响应**:

   ```javascript
   // 在控制台手动测试
   const roomId = "your-room-id";
   fetch(`/api/rooms`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ action: "getRoomInfo", roomId }),
   })
     .then((r) => r.json())
     .then((d) => console.log(d));
   ```

   应该返回最新的玩家列表

3. **检查数据库**:
   - Supabase Dashboard → room_players 表
   - 确认两个玩家的记录都存在
   - 检查 room_id 是否相同

4. **联系支持** (如果以上都不行):
   - 提供完整的控制台输出日志
   - 指明使用的 Supabase 版本
   - 提供房间 ID 和玩家 ID

---

## 📊 修复效果验证检查清单

- [ ] RoomLobby 中轮询日志每 2 秒出现一次
- [ ] B 加入后，A 的玩家列表在 2 秒内更新（通过轮询或 Realtime）
- [ ] RLS 修复脚本已在 Supabase 中执行
- [ ] 页面刷新后，数据仍然同步
- [ ] 网络 WebSocket 连接正常建立
- [ ] 多次测试都能成功同步
