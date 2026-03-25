# PartyKit WebSocket 多人游戏同步方案

## 状态
- **阶段**: 实现
- **作者**: alps
- **创建时间**: 2026-03-25
- **分支**: develop-alfred

---

## 背景

### 当前问题
1. **Supabase Realtime 延迟 100-500ms** - 基于 PostgreSQL 通知，延迟高
2. **骰子结果不同步** - 两个玩家的游戏状态、骰子结果、回合切换不能同步
3. **React 状态与数据库状态不同步** - 轮询闭包陷阱导致 stale state
4. **回合切换竞态** - 非当前玩家不会推进自己的 `turn`

### 根本原因
Supabase Realtime 的 PostgreSQL 通知机制不适合实时游戏这种需要毫秒级同步的场景。需要替换为真正的 WebSocket 双向通信。

---

## 解决方案

### 技术选型: PartyKit
- **实时 WebSocket** - 真正的双向通信，延迟 < 50ms
- **Room 抽象** - 每个游戏房间对应一个 PartyKit room
- **服务器端权威** - 骰子结果、回合切换在服务器生成
- **自动重连** - 内置连接管理和重连机制
- **开发友好** - 本地开发服务器支持

### 架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                         游戏房间架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Client A              PartyKit Server            Client B        │
│  ┌─────────┐           ┌──────────────┐           ┌─────────┐     │
│  │ React   │◄─────────►│ party/index.ts│◄────────►│ React   │     │
│  │ App     │  WebSocket │ (Room State) │  WebSocket│ App     │     │
│  └─────────┘           └──────────────┘           └─────────┘     │
│       │                        │                        │          │
│       │                        │                        │          │
│       ▼                        ▼                        ▼          │
│  ┌─────────┐           ┌──────────────┐           ┌─────────┐     │
│  │ Local   │           │ Authoritative│           │ Local   │     │
│  │ State   │           │ Game State   │           │ State   │     │
│  └─────────┘           └──────────────┘           └─────────┘     │
│                              │                                     │
│                              ▼                                     │
│                       ┌──────────────┐                             │
│                       │   Supabase   │                             │
│                       │ (Auth+Persist)│                             │
│                       └──────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流

1. **玩家加入房间**
   - 客户端通过 Supabase 认证
   - 连接 PartyKit WebSocket: `ws://localhost:1999/parties/main/{roomId}`
   - 服务器将玩家添加到 room 状态，广播 `player_joined` 事件

2. **游戏开始**
   - 房主调用 `startGame` (Supabase API)
   - 所有人通过 WebSocket 收到 `game_start` 消息

3. **掷骰子**
   - 当前玩家发起 `roll_dice` 消息
   - **服务器生成骰子结果**（权威）
   - 服务器广播 `dice_rolled` 给所有玩家

4. **移动与回合**
   - 服务器在广播骰子结果时同时更新 turn
   - 所有客户端同步接收，无竞态

5. **事件触发**
   - 服务器决定事件，广播 `event_triggered`
   - 当前玩家确认后，广播 `event_applied`，服务器推进回合

---

## 文件变更

### 新增文件
| 文件 | 说明 |
|------|------|
| `party/index.ts` | PartyKit WebSocket 服务器 |
| `party/tsconfig.json` | PartyKit TypeScript 配置 |
| `app/hooks/usePartyRoom.ts` | PartyKit 客户端 Hook |
| `app/lib/party.ts` | PartyKit 客户端初始化 |

### 修改文件
| 文件 | 说明 |
|------|------|
| `app/hooks/useRoom.ts` | 移除 Realtime 订阅，保留 Supabase API |
| `app/page.tsx` | 使用 `usePartyRoom` 替换轮询 + Realtime |
| `package.json` | 添加 partykit 依赖 |
| `.env.local` | 添加 `NEXT_PUBLIC_PARTYKIT_HOST` |
| `next.config.ts` | 添加 `serverExternalPackages` |

---

## API 设计

### PartyKit 消息类型

#### Client → Server
```typescript
// 加入房间
{ type: "join", payload: { userId: string, playerName: string, playerIndex: number } }

// 掷骰子
{ type: "roll_dice", payload: { playerIndex: number } }

// 移动完成
{ type: "move_done", payload: { playerIndex: number, position: number, lap: number } }

// 事件确认
{ type: "event_confirm", payload: { playerIndex: number } }

// 使用卡牌
{ type: "use_card", payload: { playerIndex: number, cardId: number, targetIndex?: number } }
```

#### Server → Client
```typescript
// 玩家加入
{ type: "player_joined", payload: { players: PlayerState[] } }

// 玩家离开
{ type: "player_left", payload: { playerIndex: number, players: PlayerState[] } }

// 游戏开始
{ type: "game_start", payload: { boardTiles: BoardTile[], players: PlayerState[], currentTurn: number } }

// 骰子结果（服务器权威）
{ type: "dice_rolled", payload: { playerIndex: number, diceValue: number, diceResults: number[], currentTurn: number } }

// 玩家移动
{ type: "player_moved", payload: { playerIndex: number, position: number, lap: number, players: PlayerState[] } }

// 事件触发
{ type: "event_triggered", payload: { playerIndex: number, event: GameEvent, players: PlayerState[] } }

// 事件应用
{ type: "event_applied", payload: { players: PlayerState[], currentTurn: number } }

// 卡牌使用
{ type: "card_used", payload: { playerIndex: number, card: Card, players: PlayerState[] } }

// 回合结束
{ type: "turn_ended", payload: { currentTurn: number, phase: string } }

// 胜利
{ type: "game_win", payload: { winnerIndex: number } }

// 错误
{ type: "error", payload: { message: string } }
```

---

## 实现步骤

### Step 1: 安装依赖
```bash
npm install partykit
```

### Step 2: 创建 PartyKit Server
创建 `party/index.ts` - 处理所有游戏房间逻辑

### Step 3: 创建客户端 Hook
创建 `app/hooks/usePartyRoom.ts` - 管理 WebSocket 连接和状态同步

### Step 4: 修改 page.tsx
- 移除轮询逻辑
- 使用 `usePartyRoom` 替代 Realtime 订阅

### Step 5: 配置环境
添加 `NEXT_PUBLIC_PARTYKIT_HOST` 到 `.env.local`

---

## 向后兼容

### 单人游戏
- 保持现有逻辑不变
- `usePartyRoom` 在单人模式下不初始化 WebSocket
- 游戏完全在客户端运行

### 多人游戏（Supabase 保留场景）
- **用户认证** - 继续使用 Supabase Auth
- **持久化存储** - 游戏结束后保存到 Supabase
- **房间列表** - 继续使用 Supabase 存储房间元数据
- **实时同步** - 切换到 PartyKit WebSocket

---

## 测试计划

1. **单人游戏** - 确保向后兼容
2. **两人同时加入房间** - 验证 WebSocket 连接
3. **轮流掷骰子** - 验证服务器权威骰子结果同步
4. **移动和回合切换** - 验证 turn 同步
5. **事件触发** - 验证事件同步到所有客户端
6. **网络延迟模拟** - 验证重连和状态恢复
