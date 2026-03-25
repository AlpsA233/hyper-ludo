# Hyper Ludo 在线对战同步修复方案

## 背景问题

1. **两名玩家的游戏状态和掷骰子结果没有互相同步**
2. **两名玩家开始后，移动方向相反**

## 问题根因分析

### 问题1：状态同步失效

**根因A - 轮询的闭包陷阱：**
```javascript
// page.tsx 中的轮询 effect
useEffect(() => {
  if (!isMultiplayer || !roomId || phase !== "playing") return;
  const pollGameState = async () => {
    if (isRolling || isMoving) return;  // ❌ isRolling/isMoving 是闭包中的旧值
    // ...
    if (remoteState.turn !== turn) {  // ❌ turn 是闭包创建时的值，不是最新的
      setTurn(remoteState.turn);  // 可能设置错误的回合
    }
  };
  // ...
}, [isMultiplayer, roomId, phase, isRolling, isMoving, turn]);  // 依赖项过多导致频繁重建
```

**根因B - 非当前玩家不推进回合：**
当 `gameState.phase === "moving"` 时，只有当前玩家会调用 `handleMove` 并最终调用 `endPlayerTurn`。非当前玩家播放动画后，不会推进自己的 `turn`。

**根因C - `dice_roller_index` 未正确持久化：**
`rollDice` API 中虽然设置了 `dice_roller_index`，但更新时缺少条件，可能被其他操作覆盖。

### 问题2：移动方向相反

**根因 - `num_players` 不一致导致棋盘几何错误：**

服务器 `startGame` 中：
```javascript
const totalSteps = 40;  // ❌ 硬编码！
const numPlayers = room.num_players || 2;
```

- 当 `num_players = 4`（正确）：每玩家 10 格，棋盘总长 40 格
- 当 `num_players = 2`（错误）：每玩家 20 格，但棋盘仍按 40 格生成

客户端 `page.tsx` 中：
```javascript
const totalSteps = useMemo(() => numPlayers * 10, [numPlayers]);  // 正确
```

如果玩家 A 房间配置为 2 人但玩家 B 错误地使用 `num_players = 4`（默认值），双方会生成不同的棋盘几何，导致显示位置不一致。

**另一个根因 - `startPos` 全为 0：**
所有玩家的 `startPos` 都初始化为 0，但正确逻辑应该是每个玩家有不同的起始位置（对于 4 人游戏：0, 10, 20, 30）。

## 修复方案

### Fix 1: 轮询闭包问题（page.tsx）

将 `turn`、`isRolling`、`isMoving` 从依赖项中移除，改用 ref 来跟踪最新值：

```javascript
const turnRef = useRef(turn);
const isRollingRef = useRef(isRolling);
const isMovingRef = useRef(isMoving);

useEffect(() => { turnRef.current = turn; }, [turn]);
useEffect(() => { isRollingRef.current = isRolling; }, [isRolling]);
useEffect(() => { isMovingRef.current = isMoving; }, [isMoving]);

useEffect(() => {
  if (!isMultiplayer || !roomId || phase !== "playing") return;
  const pollGameState = async () => {
    if (isRollingRef.current || isMovingRef.current) return;
    // ...
    if (remoteState.turn !== turnRef.current) {
      setTurn(remoteState.turn);
    }
  };
  // ...
}, [isMultiplayer, roomId, phase]);  // 减少依赖项
```

### Fix 2: 服务器强制同步 `num_players`（route.ts）

在 `startGame` 返回值中始终包含 `num_players`：

```javascript
return {
  room: updatedRoom,  // 包含 num_players
  players: players || [],
  boardTiles,
  numPlayers: room.num_players,  // 显式返回
};
```

### Fix 3: 修复硬编码的 `totalSteps`（route.ts）

```javascript
// startGame 函数中
const numPlayers = room.num_players || 4;
const totalSteps = numPlayers * 10;  // ✅ 动态计算

const boardTiles = Array.from({ length: totalSteps }).map((_, i) => {
  const tilesPerPlayer = totalSteps / numPlayers;
  if (i % tilesPerPlayer < 2) {
    return { id: "SAFE" };
  }
  return Math.random() * 100 < eventDensity
    ? { id: "CUSTOM" }
    : { id: "SAFE" };
});
```

### Fix 4: 确保 `dice_roller_index` 正确持久化（route.ts）

```javascript
// rollDice 函数中，更新时添加条件避免覆盖
const { error: updateError } = await supabaseAdmin
  .from("room_games")
  .update({
    dice_value: diceValue,
    dice_results: diceResults,
    dice_roller_index: player.player_index,
    dice_rolled_at: new Date().toISOString(),
    phase: "moving",
  })
  .eq("room_id", roomId)
  .eq("is_rolling", true);  // ✅ 只更新正在掷骰的状态
```

### Fix 5: 客户端验证 `num_players`（page.tsx）

在收到服务器响应后，验证本地 `numPlayers` 与服务器一致：

```javascript
if (latestRoom) {
  const serverNumPlayers = latestRoom.num_players;
  if (serverNumPlayers && serverNumPlayers !== numPlayers) {
    console.warn("⚠️ num_players 不一致，强制同步:", numPlayers, "→", serverNumPlayers);
    setNumPlayers(serverNumPlayers);
  }
  // ...
}
```

## 变更文件

1. `app/api/rooms/route.ts` - 服务器端修复
2. `app/page.tsx` - 客户端修复
