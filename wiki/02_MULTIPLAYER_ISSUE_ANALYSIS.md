# 多人游戏问题分析报告

> 创建时间：2026-03-26
> 状态：待尚书大人确认

---

## 一、问题概述

### 1.1 现象
- 玩家进入同一房间后，`/api/ably` 返回 400 Bad Request
- 骰子结果显示 `diceResults: []`（空数组）
- `room_games` 表数据为空（未插入成功）

### 1.2 控制台关键日志

```
POST https://hyper-ludo.vercel.app/api/ably 400 (Bad Request)
⚡ Ably 收到服务器骰子结果: {value: 1, results: Array(0), waitCount: 40}
```

---

## 二、问题根因分析

### 2.1 400 错误来源

`/api/ably/route.ts` 第 72-74 行：

```typescript
if (!roomId || !userId) {
  return NextResponse.json({ error: "Missing roomId or userId" }, { status: 400 });
}
```

**问题**：`sync_state` action 在连接时发送，但 `userId` 可能为空或 `undefined`。

### 2.2 骰子结果为空

**可能原因 1**：Ably 消息时序问题
- `dice_rolled` 消息在 `roomState` 初始化之前到达
- `usePartyRoom.ts` 中 `setRoomState` 更新不及时

**可能原因 2**：`start_game` 未正确执行
- `room_games` 表插入失败
- 导致后续 `roll_dice` 查询 `gameState` 为 `null`

### 2.3 数据层问题

根据 Supabase 数据查询：
- `rooms` 表：存在游戏房间数据（state: "playing"）
- `room_games` 表：**为空**（说明 `start_game` 插入失败）
- `room_players` 表：存在 2 个玩家数据

---

## 三、代码流程追踪

### 3.1 游戏开始流程

```
1. page.tsx 检测 phase === "playing" && isCreator
   ↓
2. 调用 partyRoom.startGame(lapsToWin, eventDensity)
   ↓
3. usePartyRoom.ts → callAction("start_game", { lapsToWin, eventDensity })
   ↓
4. POST /api/ably { action: "start_game", roomId, userId, payload }
   ↓
5. /api/ably/route.ts 执行 case "start_game":
   - 验证 room 和 creator_id
   - 生成 boardTiles
   - INSERT room_games（此处可能失败）
   - UPDATE rooms.state = "playing"
   - publishState("game_start", state)
   ↓
6. Ably 广播 "game_start" 消息
```

### 3.2 掷骰流程

```
1. 玩家点击掷骰按钮
   ↓
2. partyRoom.rollDice(playerIndex, diceCount)
   ↓
3. POST /api/ably { action: "roll_dice", roomId, userId, payload: { diceCount } }
   ↓
4. /api/ably/route.ts 执行 case "roll_dice":
   - 查询 room_players（验证玩家在房间中）
   - 查询 room_games（获取当前 turn 和 phase）← **如果 room_games 为空，这里返回 404**
   - 验证 playerIndex === gameState.turn
   - 生成骰子结果
   - UPDATE room_games { dice_value, dice_results, phase: "moving" }
   - publishState("dice_rolled", payload)
   ↓
5. 所有客户端收到 Ably 消息，更新本地 roomState
```

---

## 四、假设与验证步骤

### 4.1 假设 1：userId 为空导致 sync_state 400

**验证**：在 `/api/ably/route.ts` 添加日志，打印接收到的 `userId` 值

### 4.2 假设 2：room_games INSERT 失败

**可能原因**：
- `SUPABASE_SERVICE_ROLE_KEY` 在 Vercel 环境变量中配置错误
- RLS 策略阻止了 INSERT
- 表结构不匹配

**验证步骤**：
1. 登录 Vercel → Settings → Environment Variables
2. 确认 `SUPABASE_SERVICE_ROLE_KEY` 值是 `service_role` 角色（不是 `anon`）
3. 检查 Supabase Dashboard → Tables → room_games 是否有数据

### 4.3 假设 3：diceResults 未正确序列化

**验证**：检查 Supabase 中 `room_games.dice_results` 字段的实际值

---

## 五、修复建议

### 5.1 紧急修复

1. **修复 `sync_state` 的 userId 检查**
   ```typescript
   // 将
   if (!roomId || !userId) { ... }
   // 改为
   if (!roomId || (!userId && action !== "sync_state")) { ... }
   ```
   ✅ 已修复（commit: 099ceaf）

2. **添加详细的错误日志**
   ```typescript
   // 在每个 action 的关键步骤添加 console.log
   console.log("[/api/ably] start_game:", { roomId, userId, lapsToWin });
   ```

3. **防御性处理 diceResults**
   ```typescript
   // 在 usePartyRoom.ts 中
   const diceResults = Array.isArray(p.diceResults) && p.diceResults.length > 0 
     ? p.diceResults 
     : [p.diceValue].filter(v => v > 0);
   ```
   ✅ 已修复（commit: ef93aa1）

### 5.2 根本解决方案

1. **确认 Vercel 环境变量**
   - `SUPABASE_SERVICE_ROLE_KEY` 必须是 Supabase Dashboard → Settings → API → `service_role` 密钥
   - 不是 `anon` 密钥

2. **数据库 RLS 检查**
   - 确认 `room_games` 表的 INSERT 策略允许 service_role 写入

3. **添加数据验证**
   - 在 `start_game` 插入后验证数据是否真正插入
   - 失败时返回具体错误信息

---

## 六、尚书大人动手操作项

### 6.1 必须确认

1. **Supabase Service Role Key**
   - 登录 https://supabase.com/dashboard
   - 进入项目 → Settings → API
   - 复制 `service_role` 密钥（不是 `anon`）
   - 确认 Vercel 环境变量 `SUPABASE_SERVICE_ROLE_KEY` 已设置为该值

2. **Ably API Key**
   - 确认 Vercel 环境变量已设置：
     - `ABLY_API_KEY` = Ably REST API key
     - `NEXT_PUBLIC_ABLY_API_KEY` = Ably client key

### 6.2 部署后验证

在浏览器控制台查看以下日志：
```
[/api/ably] Environment check: { hasSupabaseUrl, hasServiceKey, hasAblyKey }
[/api/ably] start_game insert error: ...  (如果有错误)
[Ably] dice_rolled payload: {...}
```

---

## 七、后续优化方向

1. **状态回滚机制**：当 Ably 消息处理失败时，回退到 Supabase 查询
2. **离线队列**：玩家离线时的动作队列
3. **乐观更新**：先更新本地 UI，再确认服务器
4. **重连逻辑**：Ably 断连后自动重连并同步状态
