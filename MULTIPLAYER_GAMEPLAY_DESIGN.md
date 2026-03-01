# 🎮 多人游戏流程设计文档

## 📋 核心概念

### 游戏状态转移

```
PLAYING
  ↓
[Player N's Turn]
  ↓
WAITING (其他玩家等待)
  ↓
Player N 掷骰子 → ROLLING
  ↓
结果同步给所有玩家 → MOVING
  ↓
Player N 移动棋子（可选）
  ↓
触发事件？ → EVENT / 继续下一玩家 → 回到 Player (N+1)'s Turn
```

---

## 🎯 核心设计原则

### 1. **谁可以操作？**

- ✅ **当前玩家（turn player）**：可以掷骰子、移动棋子
- ❌ **其他玩家**：只能看，不能操作（按钮禁用）
- 📊 **所有玩家**：实时看到别人的操作和结果

### 2. **状态同步点**

| 操作     | 触发者   | 同步到   | 存储位置                |
| -------- | -------- | -------- | ----------------------- |
| 掷骰子   | 当前玩家 | 所有玩家 | room_games.dice_results |
| 移动棋子 | 当前玩家 | 所有玩家 | room_players[].position |
| 触发事件 | 当前玩家 | 所有玩家 | room_games.active_event |
| 切换回合 | 系统自动 | 所有玩家 | room_games.turn         |

### 3. **实时通信流**

```
Player A 点击"掷骰子"
  ↓
POST /api/rooms {action: "rollDice", roomId, diceCount}
  ↓
服务端：更新 room_games.dice_results
  ↓
Realtime: 推送 room_games UPDATE 给所有玩家
  ↓
Player A & B 同时收到骰子结果
```

---

## 🔢 回合制管理

### room_games 表中的关键字段

```typescript
interface RoomGameState {
  room_id: UUID;

  // 回合信息
  turn: number; // 当前玩家索引 (0-3)
  phase: "playing" | "rolling" | "moving" | "event" | "finished";

  // 掷骰结果
  dice_results: number[]; // [1, 3, 2]
  dice_value: number; // 6

  // 事件处理
  active_event: {
    type: string;
    description: string;
    affectedPlayers?: number[];
  } | null;

  // 游戏日志
  logs: Array<{
    timestamp: number;
    playerId: number;
    action: string;
    details: any;
  }>;
}
```

### 回合流程图

```
初始状态
  turn = 0, phase = "playing"
  ↓
检查当前玩家是否存活
  ├─ 存活 → 等待掷骰子
  └─ 死亡/跳过 → turn++ → 继续检查
  ↓
Player 0 掷骰子 (只有他能操作)
  rollDice(diceCount: 1-3)
  → 生成 [1-6] * diceCount
  → room_games.dice_results = [...]
  → room_games.phase = "moving"
  ↓
所有玩家看到骰子结果
  → Player 0 开始移动
  → move(diceValue)
  → 检查目标位置是否有事件
  ↓
有事件 → 触发事件 (triggerEvent)
  → room_games.phase = "event"
  → 事件处理（所有玩家同步）
  → phase = "playing"
  ↓
继续下一玩家 (turn++)
```

---

## 💻 具体实现方案

### 1. 回合判断逻辑（在 page.tsx）

```typescript
// 判断是否是当前玩家的回合
const isMyTurn = gameState?.turn === myPlayerIndex;

// 判断是否可以掷骰子
const canRollDice =
  isMyTurn && gameState?.phase === "playing" && !isRolling && !isMoving;

// 判断是否可以移动
const canMove =
  isMyTurn &&
  gameState?.phase === "moving" &&
  gameState?.dice_results?.length > 0;
```

### 2. DiceControl 组件 - 集成 API

```typescript
async function handleRollDice() {
  if (!isMyTurn || isRolling) {
    toast.error("不是你的回合");
    return;
  }

  try {
    setIsRolling(true);

    // 调用 API
    const { diceValue, diceResults } = await room.rollDice(diceCount);

    // 显示掷骰动画
    setDiceResults(diceResults);
    setDiceTotal(diceValue);

    // 日志
    addLog(`${playerName} 掷骰: ${diceResults.join("+")} = ${diceValue}`);

    // 等待 game state 更新（通过 Realtime）
    // 继续界面会自动禁用按钮
  } catch (error) {
    toast.error("掷骰失败: " + error.message);
  } finally {
    setIsRolling(false);
  }
}
```

### 3. GameBoard 组件 - 移动同步

```typescript
async function handleMoveComplete(newPosition: number, newLapCount: number) {
  if (!isMyTurn) return;

  try {
    setIsMoving(true);

    // 掉用 API 更新位置
    const { players } = await room.movePlayer(newPosition, newLapCount);

    // Realtime 会自动推送新状态，更新所有玩家的棋子位置

    // 检查是否触发事件
    const event = checkEventAt(newPosition);
    if (event) {
      const result = await room.triggerEvent(event);
      // 显示事件对话框
      setActiveEvent(result.event);
    } else {
      // 继续下一回合
      nextTurn();
    }
  } catch (error) {
    toast.error("移动失败: " + error.message);
  } finally {
    setIsMoving(false);
  }
}
```

### 4. 监听游戏状态变化

```typescript
useEffect(() => {
  if (!gameState) return;

  console.log("📊 游戏状态更新", {
    turn: gameState.turn,
    phase: gameState.phase,
    dice: gameState.dice_results,
  });

  // 根据 phase 调整 UI
  switch (gameState.phase) {
    case "rolling":
      setDiceResults(gameState.dice_results);
      setDiceTotal(gameState.dice_value);
      // 显示掷骰动画
      break;

    case "moving":
      // 使用 dice_value 设置移动步数
      setMovingSteps(gameState.dice_value);
      break;

    case "event":
      // 显示事件弹窗
      if (gameState.active_event) {
        setActiveEvent(gameState.active_event);
      }
      break;

    case "playing":
      // 清空临时状态，等待下一玩家
      clearDiceAndEvent();
      break;
  }
}, [gameState?.phase, gameState?.turn]);
```

---

## 🔐 权限控制

### API 层面（在 /api/rooms/route.ts）

```typescript
// rollDice 操作 - 只有当前玩家可以调用
async function rollDice(roomId: string, userId: string, diceCount: number) {
  // 1. 验证玩家在房间中
  const player = await supabaseAdmin
    .from("room_players")
    .select("player_index")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .single();

  if (!player) throw new Error("Not in room");

  // 2. 验证是当前回合
  const gameState = await supabaseAdmin
    .from("room_games")
    .select("turn, phase")
    .eq("room_id", roomId)
    .single();

  if (gameState.turn !== player.player_index) {
    throw new Error("Not your turn!");
  }

  if (gameState.phase !== "playing") {
    throw new Error("Invalid game phase");
  }

  // 3. 生成掷骰结果
  const diceResults = generateDice(diceCount);
  const diceValue = diceResults.reduce((a, b) => a + b);

  // 4. 更新数据库
  await supabaseAdmin
    .from("room_games")
    .update({
      dice_results: diceResults,
      dice_value: diceValue,
      phase: "moving",
    })
    .eq("room_id", roomId);

  return { diceValue, diceResults };
}
```

### UI 层面（在 GameBoard.tsx）

```typescript
// 掷骰按钮
<button
  onClick={handleRollDice}
  disabled={
    !isMyTurn ||                    // 不是我的回合
    gameState?.phase !== "playing" ||  // 游戏阶段不对
    isRolling                       // 正在掷骰
  }
  className={`... ${isMyTurn ? "bg-blue-600" : "bg-gray-600 cursor-not-allowed"}`}>
  {isMyTurn ? "🎲 掷骰子" : "⏳ 等待中..."}
</button>

// 移动按钮
<button
  onClick={move}
  disabled={
    !isMyTurn ||
    gameState?.phase !== "moving" ||
    !gameState?.dice_results ||
    isMoving
  }>
  移动
</button>
```

---

## 📲 UI 反馈设计

### 当前玩家视角

```
╔═════════════════════════════════════╗
║ 现在是你的回合 - Alice             ║
║                                     ║
║ 🎲 掷骰子 (可点击)                  ║
║ ├─ 显示当前骰子数: 1-3    ▼         ║
║                                     ║
║ 玩家列表：                          ║
║ ✓ Alice (你) - 位置: 5              ║
║ ⏳ Bob       - 位置: 12             ║
║ ⏳ Charlie   - 位置: 8              ║
╚═════════════════════════════════════╝
```

### 其他玩家视角

```
╔═════════════════════════════════════╗
║ 现在是 Alice 的回合                 ║
║                                     ║
║ ⏳ 等待中... (禁用所有按钮)         ║
║                                     ║
║ 玩家列表：                          ║
║ ⏳ Alice (他人) - 位置: 5           ║
║ ✓ Bob (你)  - 位置: 12             ║
║ ⏳ Charlie - 位置: 8                ║
║                                     ║
║ 游戏日志：                          ║
║ • Alice 掷骰: 2 + 1 = 3            ║
║ • Alice 移动至位置 8                ║
╚═════════════════════════════════════╝
```

---

## 🧪 测试场景

### 场景 1: 两个玩家的完整回合

| 步骤 | 播放器 A        | 播放器 B         | 数据库             |
| ---- | --------------- | ---------------- | ------------------ |
| 1    | 等待中          | 掷骰子按钮亮     | turn=1             |
| 2    | 看到 B 掷骰结果 | 掷骰 → [3, 2]    | dice_results=[3,2] |
| 3    | 看到 B 移动     | 移动棋子至位置 8 | position=8         |
| 4    | 掷骰子按钮亮    | 等待中           | turn=0             |
| 5    | 掷骰 → [1, 4]   | 看到结果         | dice_results=[1,4] |

### 场景 2: 事件触发

1. A 掷骰数字为 5
2. A 移动到位置 20（事件位置）
3. 弹出事件对话框（两个浏览器都看到）
4. A 确认事件
5. 继续下一玩家 B

### 场景 3: 网络延迟（模拟）

1. 打开 Chrome DevTools → Network → 设置延迟 200ms
2. A 掷骰 → 等待约 200ms 后 B 看到结果 ✅
3. A 移动 → 等待后 B 的棋盘同步更新 ✅

---

## 📊 数据流总结

```
用户操作 (rollDice)
  ↓
localState 更新 (setIsRolling)
  ↓
API: POST /api/rooms {action: "rollDice"}
  ↓
服务端：更新 room_games 表
  ↓
Supabase Realtime: 广播 UPDATE 事件
  ↓
所有客户端：gameState 更新
  ↓
自动触发 useEffect hooks
  ↓
UI 刷新（显示骰子动画）
```

---

## 🚀 开发顺序

1. ✅ **房间系统** (3.1) - 已完成
2. ✅ **游戏启动同步** - 已完成
3. 🟡 **掷骰子同步** - 待做
   - [ ] API 完成 (✅ 已有)
   - [ ] DiceControl 集成
   - [ ] 权限检查
4. 🟡 **玩家移动同步** - 待做
   - [ ] GameBoard 集成
   - [ ] 位置同步
   - [ ] 事件触发
5. 🟡 **完整流程测试** - 待做
   - [ ] 两人游戏完整回合
   - [ ] 三人/四人游戏
   - [ ] 网络延迟测试

---

## 💡 关键注意事项

### ✅ 做得对的地方

- Realtime 订阅确保实时同步
- 服务端校验权限，防止作弊
- 回合制清晰明确

### ⚠️ 需要注意的地方

1. **并发操作**：如果 A 和 B 同时点击按钮，服务端应拒绝第二个请求
2. **断线重连**：玩家断线重新连接后应恢复到当前游戏状态
3. **超时处理**：如果玩家 5 分钟不操作，应自动跳过他的回合
4. **数据一致性**：确保 room_games.turn 和实际玩家状态同步
