# Hyper-Ludo 项目详解

> 创建时间：2026-03-26
> 作者：中书省（AI 协调层）

---

## 一、项目概述

### 1.1 基本信息

| 项目 | 内容 |
|------|------|
| 项目名称 | Hyper-Ludo |
| 项目类型 | 多人在线飞行棋（Multiplayer Board Game） |
| 部署地址 | https://hyper-ludo.vercel.app |
| 代码仓库 | github.com/AlpsA233/hyper-ludo |

### 1.2 核心功能

Hyper-Ludo 是一款网页版飞行棋游戏，支持以下功能：

1. **单人游戏**：本地与 AI/好友同屏对战
2. **多人在线对战**：通过 Ably 实时同步，Supabase 持久化存储
3. **骰子系统**：支持 1-3 个骰子，摇一摇掷骰（移动端）
4. **事件系统**：随机事件（格子效果）影响游戏进程
5. **卡牌系统**：玩家可以使用道具卡牌
6. **游戏配置**：可自定义回合数、事件密度、初始卡牌等
7. **多语言支持**：中文、英文、日文、法文

### 1.3 游戏流程

```
首页 → 登录/游客模式 → 主页（单人/多人选择）
                                ↓
                    多人：创建房间 → 等待加入 → 开始游戏
                                ↓
                    游戏进行中（掷骰 → 移动 → 事件/卡牌 → 回合结束）
                                ↓
                              胜利结算
```

---

## 二、技术栈详解

### 2.1 前端框架

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.1.6 | React 框架，页面路由，API Routes |
| **React** | 19.2.3 | UI 组件库 |
| **TypeScript** | 5.9.3 | 类型安全 |
| **TailwindCSS** | 4.x | 样式框架 |

### 2.2 状态管理与实时同步

| 技术 | 用途 |
|------|------|
| **Ably** | 实时 WebSocket 消息广播（玩家动作、骰子结果、回合切换） |
| **Supabase** | 数据库持久化（房间、玩家、游戏状态）+ Realtime 订阅 |
| **React useState/useEffect** | 本地 UI 状态管理 |

### 2.3 后端服务

| 技术 | 用途 |
|------|------|
| **Vercel API Routes** | `/api/rooms`、`/api/ably` 等接口处理游戏逻辑 |
| **Supabase** | PostgreSQL 数据库 + Row Level Security |
| **Ably** | 实时消息通道（Channel: `game:{roomId}`） |

### 2.4 依赖库

```json
{
  "ably": "^2.21.0",           // 实时消息
  "@supabase/supabase-js": "^2.98.0",  // 数据库客户端
  "lucide-react": "^0.574.0",  // 图标库
  "partykit": "^0.0.115"       // 原计划使用，现已替换为 Ably
}
```

---

## 三、文件结构与职责

### 3.1 根目录结构

```
hyper-ludo/
├── app/                    # Next.js App Router 所有页面和 API
│   ├── api/               # API Routes（服务端接口）
│   ├── components/        # React 组件
│   ├── hooks/            # 自定义 React Hooks
│   ├── lib/              # 工具库（Supabase、Ably 客户端）
│   ├── locales/           # 多语言文件
│   ├── page.tsx          # 主页面（游戏核心逻辑）
│   ├── layout.tsx        # 根布局
│   ├── constants.ts      # 常量定义
│   └── types/            # TypeScript 类型定义
├── party/                # PartyKit 服务器代码（已弃用）
├── wiki/                 # 项目文档（不提交 Git）
├── package.json
├── next.config.ts
└── tsconfig.json
```

### 3.2 核心文件说明

#### 3.2.1 主页面 `app/page.tsx`（2793 行）

**职责**：游戏核心逻辑和 UI 的主文件

**包含内容**：
- 游戏状态机（`phase` state）：`auth` → `setup` → `settings` → `room_lobby` → `playing` → `win`
- 玩家状态管理（位置、回合、卡牌）
- 骰子动画和逻辑
- 棋盘渲染（`GameBoard`）
- 事件弹窗（`EventModal`）
- 房间管理 UI（`RoomLobby`）

**关键 State**：
```typescript
const [phase, setPhase] = useState<GamePhase>("auth");
const [players, setPlayers] = useState<Player[]>([]);
const [turn, setTurn] = useState(0);
const [diceValue, setDiceValue] = useState<number | null>(null);
const [diceResults, setDiceResults] = useState<number[]>([]);
const [boardTiles, setBoardTiles] = useState<BoardTile[]>([]);
const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
const [roomId, setRoomId] = useState<string | null>(null);
```

#### 3.2.2 Hooks

| 文件 | 职责 |
|------|------|
| **`usePartyRoom.ts`**（418 行） | Ably 实时同步：订阅 `game:{roomId}` 频道，处理 `dice_rolled`、`player_moved`、`turn_changed` 等消息 |
| **`useRoom.ts`**（577 行） | 房间管理：创建房间、加入房间、获取房间列表、Supabase Realtime 订阅 |
| **`useAuth.ts`** | 用户认证：Supabase Auth（登录/注册/登出） |
| **`useUserData.ts`** | 用户数据获取和管理 |
| **`useDeviceShake.ts`** | 移动端摇一摇掷骰 |
| **`useLanguage.ts`** | 多语言切换 |

#### 3.2.3 API Routes

| 文件 | 职责 |
|------|------|
| **`/api/ably/route.ts`**（541 行） | Ably 游戏动作处理：`start_game`、`roll_dice`、`move_done`、`end_turn`、`event_confirm`、`use_card`、`sync_state` |
| **`/api/rooms/route.ts`** | 房间 CRUD：创建房间、获取房间、更新房间状态 |
| **`/api/config/route.ts`** | 游戏配置获取 |
| **`/api/upload/route.ts`** | 文件上传 |

#### 3.2.4 工具库 `app/lib/`

| 文件 | 职责 |
|------|------|
| **`supabase.ts`** | Supabase 客户端初始化，使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **`ably.ts`** | Ably 客户端封装：`publishGameEvent()` 发布消息、`subscribeToGameEvents()` 订阅消息 |
| **`lskyPro.ts`** | 图片上传到 LskyPro 图床 |

#### 3.2.5 组件 `app/components/`

| 组件 | 职责 |
|------|------|
| `AuthScreen.tsx` | 登录/注册界面 |
| `GameBoard.tsx` | 棋盘渲染 |
| `GamePieces.tsx` | 玩家棋子渲染 |
| `DiceControl.tsx` | 骰子控制和动画 |
| `PlayerSidebar.tsx` | 玩家信息侧边栏 |
| `EventModal.tsx` | 事件弹窗 |
| `WinScreen.tsx` | 胜利结算画面 |
| `RoomLobby.tsx` | 房间大厅（等待玩家、开始游戏） |
| `RoomManager.tsx` | 房间管理（创建/加入） |
| `GameSettings.tsx` | 游戏设置界面 |
| `CardDrawer.tsx` | 卡牌抽屉 |
| `CardEditor.tsx` | 卡牌编辑器 |
| `EventEditor.tsx` | 事件编辑器 |
| `ConfigManager.tsx` | 配置管理器 |
| `GameLog.tsx` | 游戏日志 |
| `GameInfoSidebar.tsx` | 游戏信息侧边栏 |

---

## 四、数据流架构

### 4.1 多人游戏架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        玩家 A（浏览器）                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐   │
│  │ useRoom  │───→│ Supabase │←───│  Realtime 订阅        │   │
│  │          │    │  数据库   │    │  room_players, rooms  │   │
│  └────┬─────┘    └──────────┘    └──────────────────────┘   │
│       │                                                      │
│       │         ┌──────────────┐                            │
│       └────────→│  usePartyRoom │                            │
│                 │   (Ably)     │←─────────────────────────┐  │
│                 └──────┬───────┘                          │  │
│                        │ Ably Channel: game:{roomId}      │  │
└────────────────────────┼───────────────────────────────────┼──┘
                         │                                   │
                         │         ┌──────────────────────┐  │
                         └────────→│   /api/ably Route    │  │
                                   │   (Vercel Server)    │  │
                                   └──────────┬───────────┘  │
                                              │              │
                                   ┌──────────▼───────────┐  │
                                   │      Supabase        │  │
                                   │  (room_games 表)     │  │
                                   └──────────────────────┘  │
                                                                  │
                         ┌───────────────────────────────────┐  │
                         │           玩家 B（浏览器）           │  │
                         │  同上，通过 Ably 实时同步状态          │  │
                         └───────────────────────────────────┘  │
```

### 4.2 游戏动作流程（掷骰为例）

```
1. 玩家 A 点击"掷骰"按钮
   ↓
2. page.tsx 调用 partyRoom.rollDice(currentPlayerIndex, diceCount)
   ↓
3. usePartyRoom.ts 发送 POST /api/ably
   body: { action: "roll_dice", roomId, userId, payload: { diceCount } }
   ↓
4. /api/ably/route.ts 处理请求
   - 验证玩家权限（是否是该回合玩家）
   - 生成随机骰子结果
   - 更新 Supabase room_games 表（dice_value, dice_results, phase="moving"）
   - 通过 Ably.publish("dice_rolled", payload) 广播
   ↓
5. 玩家 A 和 B 的 usePartyRoom.ts 收到 Ably 消息
   - 更新本地 roomState.diceResults
   - React 状态更新 → UI 刷新显示骰子结果
```

### 4.3 状态同步策略

| 数据 | 存储 | 同步方式 |
|------|------|----------|
| 房间信息（rooms 表） | Supabase | Realtime 订阅 |
| 玩家信息（room_players 表） | Supabase | Realtime 订阅 |
| 游戏状态（room_games 表） | Supabase | API 更新 + Realtime 订阅 |
| 实时动作（骰子、位置） | Ably | WebSocket 广播 |
| 客户端 UI 状态 | React State | 本地管理 |

---

## 五、数据库 Schema（Supabase）

### 5.1 主要表

#### `rooms` - 房间表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| room_code | VARCHAR | 房间码（6 位） |
| creator_id | UUID | 创建者用户 ID |
| state | VARCHAR | waiting/playing |
| max_players | INT | 最大玩家数 |
| num_players | INT | 玩家数量 |
| laps_to_win | INT | 获胜所需圈数 |
| event_density | INT | 事件密度（0-100） |

#### `room_players` - 房间玩家表
| 字段 | 类型 | 说明 |
|------|------|------|
| room_id | UUID | 房间 ID |
| user_id | UUID | 用户 ID |
| player_index | INT | 玩家索引（0,1,2,3） |
| player_name | VARCHAR | 玩家名称 |
| color_index | INT | 颜色索引 |
| position | INT | 当前位置 |
| lap | INT | 已完成圈数 |
| avatar | VARCHAR | 头像 |

#### `room_games` - 游戏状态表
| 字段 | 类型 | 说明 |
|------|------|------|
| room_id | UUID | 房间 ID（主键） |
| turn | INT | 当前回合玩家索引 |
| phase | VARCHAR | 游戏阶段 |
| board_tiles | JSONB | 棋盘瓦片配置 |
| dice_value | INT | 当前骰子总值 |
| dice_results | JSONB | 骰子结果数组 |
| active_event | JSONB | 当前激活事件 |
| winner | INT | 获胜玩家索引 |

---

## 六、环境变量

| 变量名 | 用途 | 示例 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥（客户端用） | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色密钥（服务端用 bypass RLS） | `eyJ...` |
| `ABLY_API_KEY` | Ably API 密钥（服务端发布消息） | `xxxxxx` |
| `NEXT_PUBLIC_ABLY_API_KEY` | Ably 公钥（客户端订阅） | `xxxxxx` |

---

## 七、已知问题与待优化

### 7.1 当前问题

1. **`room_games` 表数据为空**：游戏开始时插入游戏状态失败
2. **骰子结果同步问题**：`diceResults` 有时为空数组
3. **Ably 连接不稳定**：WebSocket 断连后回退到 Supabase 轮询模式

### 7.2 待优化项

1. 错误处理增强（API 返回详细错误信息）
2. 断线重连逻辑
3. 房间过期清理
4. 部署配置文档化

---

## 八、开发命令

```bash
# 安装依赖
npm install

# 开发模式（Next.js）
npm run dev

# 开发模式（PartyKit，已弃用）
npm run dev:party

# 同时启动两个开发服务器
npm run dev:all

# 构建生产版本
npm run build

# 类型检查
npx tsc --noEmit
```
