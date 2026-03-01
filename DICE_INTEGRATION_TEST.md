# 掷骰子同步集成测试报告

## 实现概览

✅ **第一阶段：多人游戏框架集成**

- [x] 从 useRoom hook 导入 gameState, rollDice, subscribe 方法
- [x] 添加 Realtime 订阅到 page.tsx (useEffect with roomId dependency)
- [x] 添加 gameState 监听 (另一个 useEffect)
- [x] 自动同步 turn, diceValue, diceResults 等状态

✅ **第二阶段：API 集成到 handleRollDice**

- [x] 检查是否为多人模式
- [x] 多人模式下验证权限 (currentPlayerIndex === turn)
- [x] 调用 room.rollDice() 获取服务器掷骰结果
- [x] 提取骰子动画到独立函数 animateDiceRoll()
- [x] 使用服务器结果显示动画
- [x] 单人模式保持原有行为

✅ **第三阶段：UI 权限展示**

- [x] DiceControl 添加 isMultiplayer 和 currentPlayerIndex props
- [x] 不是当前玩家时显示 "⏳ 等待玩家 N 掷骰..." 提示
- [x] 禁用非当前玩家的掷骰操作
- [x] 添加到 page.tsx 的 DiceControl 调用

## 测试场景

### 测试 1：单人模式验证

**目标**: 确保本地游戏仍能正常工作

**步骤**:

1. 运行 `npm run dev`
2. 进入游戏
3. 选择"设置游戏"(单人模式)
4. 配置玩家数、骰子数等
5. 点击"开始游戏"
6. 点击骰子掷骰
7. 观察骰子动画和移动

**预期结果**:

- ✓ 骰子正常显示动画
- ✓ 显示掷骰结果
- ✓ 玩家自动移动
- ✓ 回合自动切换

### 测试 2：多人模式基础验证

**目标**: 验证房间创建和加入功能

**步骤** (需要两个浏览器):

1. **浏览器 A** (玩家 1):
   - 进入游戏
   - 点击"创建房间"
   - 输入玩家名称和配置
   - 记录房间代码

2. **浏览器 B** (玩家 2):
   - 进入游戏
   - 点击"加入房间"
   - 输入房间代码和玩家名称
   - 点击"加入"

3. **浏览器 A 或 B**:
   - 验证双方的玩家列表相同
   - 点击"开始游戏"

**预期结果**:

- ✓ 房间成功创建
- ✓ 玩家 2 成功加入
- ✓ 两个浏览器的玩家列表实时同步
- ✓ 两个浏览器都进入游戏状态

### 测试 3：掷骰权限检查

**目标**: 验证权限检查和状态同步

**步骤** (继续测试 2):

1. **浏览器 A** (玩家 1，turn=0):
   - 看到骰子可点击
   - 点击骰子掷骰
   - 观察动画

2. **浏览器 B** (玩家 2，turn≠0):
   - 看到提示 "⏳ 等待玩家 1 掷骰..."
   - 骰子不可点击（灰显）
   - 摇一摇按钮被禁用

3. **浏览器 A** 掷骰完成:
   - 显示掷骰结果
   - turn 切换到玩家 2

4. **浏览器 B** 接收更新:
   - 提示变为 "⏳ 等待玩家 2 掷骰..."
   - 骰子变为可点击
   - 可以进行掷骰

**预期结果**:

- ✓ 权限检查正确工作
- ✓ 非当前玩家看到等待提示
- ✓ Realtime 同步 turn 更新
- ✓ 骰子权限状态实时变化

### 测试 4：掷骰结果同步

**目标**: 验证掷骰结果的服务器同步

**步骤** (继续测试 3):

1. **浏览器 A** 掷骰:
   - 调用 room.rollDice() API
   - 服务器生成随机数
   - 显示动画
   - 记录显示的数字

2. **浏览器 B** 实时接收:
   - 看到 gameState 变化（Realtime 推送）
   - 游戏日志显示掷骰结果
   - 数字与浏览器 A 一致

3. 交换角色再掷一次验证

**预期结果**:

- ✓ 服务器正确生成并存储掷骰结果
- ✓ Realtime 推送更新到所有客户端
- ✓ 所有客户端看到相同的掷骰结果
- ✓ 无结果冲突或不一致

### 测试 5：多骰子同步

**目标**: 验证多个骰子的同步

**步骤**:

1. 创建房间时设置 dice_count = 2
2. 重复测试 3 和 4

**预期结果**:

- ✓ 两个骰子同时显示动画
- ✓ 两个结果都同步传送
- ✓ 日志显示两个数字

## 已知的数据流

```
玩家点击骰子 (浏览器 A)
    ↓
handleRollDice() 调用 room.rollDice()
    ↓
API /api/rooms POST {action: "rollDice"}
    ↓
服务器验证权限 (turn === currentPlayerIndex)
    ↓
服务器生成随机数: diceResults = [1, 3, 2]
    ↓
服务器更新 room_games 表
    ↓
Supabase Realtime 推送变化
    ↓
所有订阅客户端收到 gameState 更新
    ↓
page.tsx 的 gameState useEffect 触发
    ↓
setDiceValue() 和 setDiceResults() 更新
    ↓
UI 重新渲染，显示新的掷骰数字
    ↓
同时动画执行 (使用从服务器返回的结果)
    ↓
handleMove() 执行移动逻辑
```

## 关键代码变更

### page.tsx

1. useRoom 导入增强:

```typescript
const {
  room,
  players: roomPlayers,
  gameState,
  rollDice: roomRollDice,
  subscribe,
} = useRoom();
```

2. 新增状态跟踪:

```typescript
const [isMultiplayer, setIsMultiplayer] = useState(false);
const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number | null>(
  null,
);
```

3. Realtime 订阅:

```typescript
useEffect(() => {
  if (!roomId) return;
  setIsMultiplayer(true);
  const unsubscribe = subscribe(roomId);
  return () => unsubscribe();
}, [roomId, subscribe]);
```

4. GameState 监听:

```typescript
useEffect(() => {
  if (!gameState || !isMultiplayer) return;
  setTurn(gameState.turn);
  setDiceResults(gameState.dice_results);
  setDiceValue(gameState.dice_value);
}, [gameState, isMultiplayer]);
```

5. handleRollDice 修改:

```typescript
const handleRollDice = async () => {
  if (isMultiplayer && currentPlayerIndex !== turn) return;
  if (isMultiplayer && room) {
    const { diceValue, diceResults } = await roomRollDice(diceCount);
    await animateDiceRoll(diceResults);
  } else {
    // 本地模式保持原样
  }
};
```

### DiceControl.tsx

1. Props 增强:

```typescript
isMultiplayer?: boolean
currentPlayerIndex?: number | null
```

2. 权限显示:

```typescript
{isMultiplayer && currentPlayerIndex !== turn && (
  <p>⏳ 等待玩家 {turn + 1} 掷骰...</p>
)}
```

## 调试建议

如果出现问题，检查浏览器控制台的日志：

```javascript
// 看这些日志
console.log("🔌 订阅房间 Realtime:", roomId);
console.log("👤 当前玩家索引:", myIndex);
console.log("🎮 游戏状态更新:", gameState);
console.log("🎲 多人模式：调用 rollDice API");
console.log("📡 服务器掷骰结果:", diceValue, diceResults);
```

如果是 Realtime 问题，检查：

1. Supabase 是否启用了 room_games 表的 Realtime
2. RLS 策略是否允许当前用户访问 room_games
3. 是否成功建立了 WebSocket 连接（浏览器网络检查器）

## 后续优化

- [ ] 添加网络延迟模拟
- [ ] 添加重试机制（API 失败）
- [ ] 添加超时处理（玩家长时间未掷骰）
- [ ] 添加离线恢复机制
- [ ] 性能监控和日志聚合
