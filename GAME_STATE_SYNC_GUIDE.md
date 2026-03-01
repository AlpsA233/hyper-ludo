# 游戏状态同步 (Phase 3.2) 实现指南

## 📋 概述

Phase 3.2 已完成以下内容：

- ✅ 扩展 `/api/rooms` API 支持游戏操作
- ✅ 在 `useRoom` hook 中添加游戏函数
- ✅ 建立 Realtime 订阅游戏状态变化
- ✅ 编译验证通过（无错误）

## 🎮 新增 API 操作

### 1. startGame - 启动游戏

**调用方式**:

```typescript
const { room, players } = await useRoom().startGame();
```

**功能**:

- 验证调用者是房间创建者
- 初始化 `room_games` 表记录
- 更新房间状态为 "playing"
- 返回更新后的房间和玩家列表

**使用场景**: GameSetup → GameBoard 时调用

---

### 2. rollDice - 掷骰子

**调用方式**:

```typescript
const { diceValue, diceResults, turn } = await useRoom().rollDice(diceCount);
```

**参数**:

- `diceCount` (number): 骰子个数（1-3）

**返回**:

- `diceValue` (number): 掷骰总数
- `diceResults` (number[]): 各骰子结果数组 [1, 3, 2]
- `turn` (number): 当前回合数（0-based）

**功能**:

- 生成骰子随机结果
- 更新 room_games 表的 dice_value 和 dice_results
- 设置游戏阶段为 "moving"

**使用场景**: DiceControl 点击按钮或摇一摇触发时调用

---

### 3. movePlayer - 移动棋子

**调用方式**:

```typescript
const { position, lapCount, players } = await useRoom().movePlayer(
  position,
  lapCount,
);
```

**参数**:

- `position` (number): 新位置（0-51）
- `lapCount` (number): 新圈数

**返回**:

- `position` (number): 确认的位置
- `lapCount` (number): 确认的圈数
- `players` (RoomPlayer[]): 更新后的玩家列表

**功能**:

- 更新当前玩家的位置和圈数
- 返回更新后的完整玩家列表供 Realtime 订阅

**使用场景**: GameBoard 棋子移动动画结束后调用

---

### 4. triggerEvent - 触发事件

**调用方式**:

```typescript
const { event, phase } = await useRoom().triggerEvent(eventData);
```

**参数**:

- `event` (object): 事件对象，包含事件类型和参数

**返回**:

- `event` (object): 触发的事件
- `phase` (string): "event"

**功能**:

- 更新 room_games 表的 active_event
- 设置游戏阶段为 "event"
- 所有客户端通过 Realtime 订阅收到事件

**使用场景**: 着陆事件位置时调用

---

## 🔄 Realtime 订阅

### 订阅房间更新

```typescript
import { useRoom } from '@/app/hooks/useRoom';

function MyGameComponent() {
  const room = useRoom(userId);

  useEffect(() => {
    if (!room.room?.id) return;

    // 订阅房间变化（自动订阅玩家列表和游戏状态）
    const unsubscribe = room.subscribe(room.room.id);

    return unsubscribe;
  }, [room.room?.id]);

  // room.players 和 room.gameState 自动更新
  return (
    <div>
      <p>玩家数: {room.players.length}</p>
      <p>当前阶段: {room.gameState?.phase}</p>
      <p>掷骰结果: {room.gameState?.dice_results?.join(', ')}</p>
    </div>
  );
}
```

### 自动订阅内容

1. **room_players 变化**:
   - 玩家加入: room.players 增加新记录
   - 玩家更新: 位置、圈数等更新
   - 玩家离开: 自动从列表删除

2. **room_games 变化**:
   - room.gameState 自动更新
   - 包含: turn, phase, dice_value, dice_results, active_event, active_card

---

## 📊 游戏状态流程

```
创建房间 (waiting)
  ↓
加入房间 (多玩家)
  ↓
startGame() → phase: "playing"
  ↓
rollDice() → phase: "moving"
  ↓
movePlayer() → 棋子移动
  ↓
若着陆事件 → triggerEvent() → phase: "event"
  ↓
处理事件完成 → 继续下一玩家回合
```

---

## 🔌 集成建议

### 1. GameSetup 组件

```typescript
async function handleStartGame() {
  try {
    const { room, players } = await room.startGame();
    // 游戏已启动，切换到 GameBoard
    setGamePhase("playing");
  } catch (err) {
    console.error("Failed to start game:", err);
  }
}
```

### 2. DiceControl 组件

```typescript
async function handleRollDice() {
  try {
    const { diceValue, diceResults } = await room.rollDice(diceCount);
    // 显示掷骰动画，然后移动
    setDiceResults(diceResults);
    setMovingSteps(diceValue);
  } catch (err) {
    console.error("Failed to roll dice:", err);
  }
}
```

### 3. GameBoard 组件

```typescript
async function handleMoveComplete(newPosition: number, newLap: number) {
  try {
    const { players } = await room.movePlayer(newPosition, newLap);
    // 所有客户端通过 Realtime 订阅自动更新

    // 检查是否触发事件
    if (checkEventTrigger(newPosition)) {
      const event = getEventData(newPosition);
      await room.triggerEvent(event);
    }
  } catch (err) {
    console.error("Failed to move player:", err);
  }
}
```

---

## 🧪 测试清单

### 单浏览器测试

- [ ] 创建房间 → 开始游戏
- [ ] 掷骰子 → 骰子结果显示正确
- [ ] 移动棋子 → 位置更新
- [ ] 触发事件 → 事件弹窗出现

### 两浏览器测试

- [ ] A 掷骰 → B 立即看到骰子结果
- [ ] A 移动 → B 看到 A 的棋子位置更新
- [ ] A 触发事件 → B 也看到事件弹窗
- [ ] 网络延迟模拟 → 功能仍可用

### 多人游戏测试（3-4 玩家）

- [ ] 所有玩家的操作同步
- [ ] 回合循环正确
- [ ] 实时延迟 < 500ms

---

## 📁 文件修改清单

- ✅ `/app/api/rooms/route.ts` - 新增 4 个操作（startGame, rollDice, movePlayer, triggerEvent）
- ✅ `/app/hooks/useRoom.ts` - 新增 4 个方法 + gameState 状态 + Realtime 订阅
- ✅ 编译验证通过 - ✓ Compiled successfully

---

## 🚀 后续工作

### 立即实现

1. 在 GameSetup 集成 startGame
2. 在 DiceControl 集成 rollDice
3. 在 GameBoard 集成 movePlayer
4. 两浏览器测试

### 优化项

1. 添加离线缓存（网络断开时保存操作）
2. 添加操作重试机制
3. 性能监控（记录延迟）

---

**状态**: ✅ API 实现完成，编译通过
**下一步**: 在游戏组件中集成，进行两浏览器测试
