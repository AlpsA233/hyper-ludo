# Phase 3.1 多人房间系统 - 诊断与修复报告

## 发现的问题

### 1. 玩家加入后没有显示更新的UI

**症状**：玩家B加入房间，但玩家A的房间页面仍显示只有自己
**根本原因**：多个问题的组合

- ✅ **已修复**：joinRoom 不返回 roomId，导致加入流程中断
- ✅ **已修复**：RoomManager 传递错误的参数（roomCode 而不是 roomId）
- ✅ **已修复**：实时订阅未处理 DELETE 事件

### 2. 房间码管理问题

**症状**：

- 房间码生成为纯数字，难以区分，容易用尽（1,000,000 个组合）
- RoomManager 中房间码显示被写死为 "000001"
- 用户无法看到实际的房间码

**根本原因**：

- 房间码生成策略不够健壮
- RoomManager 创建房间后没有正确获取房间码

**解决方案**：
✅ **已实施**：改为 6 位混合码（2位数字 + 4位字母）

- 数字范围：2-9（避免易混淆的 0/1）
- 字母范围：23456789ABCDEFGHJKMNPQRSTUVWXYZ（避免 O/I/L）
- 可用组合：8² × 32⁴ = 33,554,432（足够长期使用）
- 示例：42ABCD, 17XYZ9, 89QWER

### 3. 房间数据清理

**症状**：创建后又退出的房间数据是否还在？
**当前状态**：✅ **正确**

- 创建者离开房间时，leaveRoom 会删除整个房间
- 级联删除会清理 room_players 和 room_games 记录
- 数据库空间不会被占用

## 已应用的修复

### useRoom.ts 改进

```typescript
// 1. 房间码生成改进
generateRoomCode() {
  // 2位数字 + 4位字母/数字混合
  // 避免 O/I/L 等混淆字符
  return `${nums[i]}${nums[j]}${chars[k]}${chars[l]}...`
}

// 2. joinRoom 现在返回 roomId
joinRoom(roomCode, playerName, avatar): Promise<string> {
  return targetRoom.id; // 返回房间ID而不是void
}

// 3. 实时订阅处理 DELETE 事件
subscribe(roomId): (() => void) {
  channel.on('postgres_changes', ..., (payload) => {
    if (payload.eventType === 'INSERT' || 'UPDATE') {
      // 添加或更新玩家
    } else if (payload.eventType === 'DELETE') {
      // 删除玩家 - 新增处理！
      setPlayers(prev => prev.filter(p => p.id !== payload.old.id))
    }
  })
}
```

### RoomManager.tsx 改进

```typescript
// handleJoinRoom 修复
const roomId = await joinRoom(roomCode, playerName, avatar);
onRoomJoined?.(roomId); // 正确传递 roomId
```

## 流程梳理

### 创建房间流程

```
GameSetup → "🌐 多人游戏" button
↓
RoomManager (phase = "room_select")
↓
handleCreateRoom():
  1. 调用 useRoom.createRoom()
  2. 生成 6 位房间码（如 42ABCD）
  3. 创建房间记录
  4. 添加创建者到 room_players
  5. 返回 roomId
  6. onRoomCreated(roomId) 回调
↓
page.tsx:
  setRoomId(roomId)
  setPhase("room_lobby")
↓
RoomLobby 组件显示：
  - 房间码（大字体显示 42ABCD）
  - 复制按钮
  - 玩家槽位（1/4）
  - "Start Game" 按钮（仅创建者可见）
```

### 加入房间流程

```
GameSetup → "🌐 多人游戏" button
↓
RoomManager (phase = "room_select")
↓
用户选择 "Join Room" 模式
↓
handleJoinRoom():
  1. 输入房间码（如 42ABCD）
  2. 输入玩家名称
  3. 调用 useRoom.joinRoom()
  4. 验证房间存在且未开始
  5. 验证玩家未在房间中
  6. 添加玩家到 room_players（player_index = 现有玩家数）
  7. 更新房间 current_players 计数
  8. 返回 roomId ✅ (新增)
  9. onRoomJoined(roomId) 回调
↓
page.tsx:
  setRoomId(roomId)
  setPhase("room_lobby")
↓
RoomLobby 组件：
  1. useEffect 调用 loadRoom(roomId)
  2. useEffect 调用 subscribe(roomId)
  3. 实时订阅监听 room_players 的 INSERT 事件
  4. 当新玩家加入时，触发 INSERT
  5. payload.new 被添加到 players 状态
  6. UI 更新显示新玩家 ✅ (需验证)
```

### 退出房间流程

```
RoomLobby → "Leave Game" 按钮
↓
handleLeaveRoom():
  1. 调用 useRoom.leaveRoom()
↓
leaveRoom():
  是否是创建者？
  ├─ 是：删除整个房间
  │  └─ 级联删除 room_players（所有玩家）
  │  └─ 级联删除 room_games（游戏记录）
  │
  └─ 否：删除自己的玩家记录
     └─ 更新房间 current_players 计数
↓
实时订阅监听 DELETE 事件 ✅ (新增)
↓
UI 更新移除该玩家 ✅ (新增)
↓
page.tsx:
  setRoomId(null)
  setPhase("setup")
```

## 待验证项

1. **实时订阅完整性测试**
   - 玩家B加入后，玩家A是否看到新玩家？
   - 玩家退出时，列表是否正确移除？

2. **房间码显示**
   - RoomLobby 是否正确显示新房间码格式（42ABCD）？
   - 复制功能是否工作？

3. **并发场景**
   - 多个玩家同时加入？
   - 创建者和玩家同时离开？

## 数据库设计评估

### 房间码方案对比

| 方案          | 格式                     | 组合数      | 易用性           | 推荐度        |
| ------------- | ------------------------ | ----------- | ---------------- | ------------- |
| 纯数字 v1     | 6位（000000-999999）     | 1,000,000   | 低（易混淆0/1）  | ❌            |
| 纯数字 v2     | 8位（00000000-99999999） | 100,000,000 | 低（太长）       | ❌            |
| 字母码        | 6位字母                  | 308,915,776 | 高               | ⚠️ (不如混合) |
| **混合码** ✅ | 2数字+4混合              | 33,554,432  | 高（易读易输入） | ✅            |

### RLS 策略评估

| 表               | 操作                 | 策略                    | 评估                    |
| ---------------- | -------------------- | ----------------------- | ----------------------- |
| rooms            | SELECT               | 允许所有人              | ✅ 正确（可见房间列表） |
|                  | INSERT               | creator_id = auth.uid() | ✅ 正确                 |
|                  | UPDATE/DELETE        | creator_id = auth.uid() | ✅ 正确                 |
| **room_players** | SELECT               | self + creators         | ✅ 已修复（移除递归）   |
|                  | INSERT/UPDATE/DELETE | auth.uid() = user_id    | ✅ 正确                 |
| room_games       | SELECT               | 房间玩家可见            | ✅ 正确                 |
|                  | INSERT               | 创建者可操作            | ✅ 已添加               |
|                  | UPDATE               | 创建者可操作            | ✅ 正确                 |

## 后续建议

### 立即验证

1. 在 Supabase 控制台验证新房间码格式生成
2. 两个浏览器测试创建→加入→游戏开始流程
3. 验证玩家加入时 RoomLobby 实时更新

### Phase 3.2 优化点

1. **离线重连**：实现玩家掉线重连机制
2. **房间锁定**：游戏开始后禁止新玩家加入
3. **超时清理**：7天自动清理过期房间（已有 expires_at）
4. **玩家超时**：实现心跳检测，检测掉线玩家
5. **观众模式**：允许观众加入观看正在进行的游戏

### 数据库优化

1. 考虑添加 room_messages 表实现聊天功能
2. 实现房间历史记录表统计玩家胜率
3. 添加房间禁言名单（ban list）
4. 实现 ELO 排分系统

## 文件修改清单

✅ **已修改**：

- `app/hooks/useRoom.ts`
  - 房间码生成方案改进
  - joinRoom 返回值修改
  - 实时订阅 DELETE 事件处理
- `app/components/RoomManager.tsx`
  - handleJoinRoom 回调参数修正
- `supabase/migrations/add_rooms.sql`
  - 注释更新说明新房间码格式

⚠️ **需在 Supabase 执行的 SQL**：

```sql
-- 如果之前未执行，需要添加 INSERT 策略
CREATE POLICY "Room creator can create game state"
  ON room_games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE id = room_id AND creator_id = auth.uid()
    )
  );
```

## 调试建议

如果问题持续，检查以下项：

1. Supabase 底部的 Logs 标签，查看 RLS 错误
2. 浏览器 Network 标签，确认 RealtimeChannel 连接已建立
3. 使用 Supabase Studio 直接查询，验证数据是否正确插入
4. 检查玩家A和玩家B的 auth.uid() 是否不同

---

更新时间：2026-03-01  
系统版本：Phase 3.1（多人房间系统）  
状态：关键修复已应用，待验证测试
