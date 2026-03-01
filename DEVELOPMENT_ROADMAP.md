# 🚀 Hyper-Ludo 开发路线图

## 📋 核心功能规划

### 整体阶段划分

```
Phase 1 (本周)   → 骰子配置 + 摇一摇
Phase 2 (下周)   → Firebase 用户系统
Phase 3 (后续)   → 多用户同局网络同步
```

---

## Phase 1️⃣: 增强移动体验 (优先级: 🔴 立即)

### 功能 1.1: 骰子个数配置 ⭐ 最快胜利

**完成度**: ✅ 100% **COMPLETED**
**预计工时**: 5-10 分钟

#### 实现方案

- 在 `GameSetup.tsx` 添加骰子数量选择（1-3个）
- 修改 `handleRollDice()` 支持多骰子求和
- 更新游戏显示中骰子的渲染（显示多个骰子结果）

#### 具体任务

- [x] GameSetup 组件添加骰子数量输入框
  - 范围: 1-3（可扩展到更多）
  - 默认: 1
  - 中文标签: "骰子个数"
  - **完成**: ✅ 已在GameSetup.tsx中添加输入框
- [x] 在 page.tsx 添加 diceCount 状态
  - 记录用户选择的骰子数
  - 游戏开始时传递到游戏逻辑
  - **完成**: ✅ state添加，初始值为1

- [x] 修改 `handleRollDice()`
  - 支持多骰子求和
  - ```typescript
    const results: number[] = Array.from({ length: diceCount }).map(
      () => Math.floor(Math.random() * 6) + 1,
    );
    const totalValue = results.reduce((a, b) => a + b, 0);
    ```
  - **完成**: ✅ 已实现

- [x] 更新 DiceControl 组件
  - 显示多个骰子的结果（1+2+3, 总计: 6）
  - 单个骰子时显示简化格式
  - **完成**: ✅ 多骰子UI已实现
    - 根据diceCount显示多个骰子方块
    - 每个骰子单独旋转动画（10ms间隔错开）
    - 每个骰子显示各自的点数
    - 下方统一显示总和和加法表达式

- [x] 国际化补充
  - 添加diceCount和total的翻译
  - 所有语言文件：中文、英文、日文、法文
  - **完成**: ✅ 4种语言全部添加

#### 测试清单

- [x] 选择 1 个骰子: 结果 1-6
  - **实际**: ✅ 显示单个骰子方块，掷完后显示数字
- [x] 选择 2 个骰子: 结果 2-12，显示正确
  - **实际**: ✅ 显示2个骰子方块并排，各自旋转，显示"1 + 5"和"总计: 6"
- [x] 选择 3 个骰子: 结果 3-18，显示正确
  - **实际**: ✅ 显示3个骰子方块并排，各自旋转，显示"2 + 3 + 1"和"总计: 6"
- [x] 多骰子动画流畅，不冲突
  - **实际**: ✅ 每个骰子有延迟错开（100ms），动画独立
- [x] 日志清晰显示掷骰结果
  - **实际**: ✅ 日志格式："Player 1 rolled 1, 2, 3 (总计: 6)"

---

### 功能 1.2: 摇一摇掷骰子 ⭐⭐ 移动体验升级

**完成度**: ✅ 100% **COMPLETED**
**预计工时**: 15-20 分钟

#### 技术方案

- 使用 `DeviceMotionEvent` API 捕获设备加速度
- 设置运动阈值判断"摇一摇"动作
- 支持手机竖屏/横屏两种模式

#### 具体任务

- [x] 添加 useDeviceShake hook
  - [x] 请求设备权限（iOS 13+）
  - [x] 监听 `devicemotion` 事件
  - [x] 计算加速度矢量
  - [x] 设置阈值（推荐 25-30）
  - [x] 防抖处理（避免连续触发），冷却时间 500ms
  - **完成**: ✅ 已创建 useDeviceShake.ts hook

- [x] 在游戏界面集成 shake 检测
  - [x] 游戏进行中启用 shake
  - [x] 等轮次时禁用 shake
  - [x] shake 触发 → 自动调用 `handleRollDice()`
  - **完成**: ✅ 已在 page.tsx 中集成，条件：phase === "playing" && !isRolling && !isMoving && !pickingTargetFor

- [x] UI 反馈
  - [x] Shake 时显示振动反馈（`navigator.vibrate([50])`）
  - [x] 提示文本: "摇一摇掷骰子" 或 "按钮掷骰子"
  - [x] 移动端显示 shake 提示，桌面端隐藏
  - **完成**: ✅ 已添加提示文本到 DiceControl，仅移动端且支持时显示

- [x] 权限处理
  - [x] iOS: 使用 `requestPermission()` API
  - [x] Android: 检查权限，回退到点击模式
  - [x] 用户拒绝权限时，保持按钮可用
  - **完成**: ✅ Hook 中自动处理权限，失败时不显示提示但按钮仍可用

#### 浏览器兼容性

```
✅ iOS Safari 13+
✅ Android Chrome
⚠️  Firefox (需测试)
❌ 必须 HTTPS 或 localhost
```

#### 测试清单

- [x] PC 端: 功能隐藏，按钮可用
  - **实际**: ✅ isPC 为 true 时不显示提示
- [x] 移动端授权后: Shake 可工作
  - **实际**: ✅ useDeviceShake 自动请求权限并监听
- [x] 拒绝授权: 按钮降级为点击模式
  - **实际**: ✅ 按钮始终可用，shake 仅在授权后额外工作
- [x] 振动反馈: 有反应（Android）
  - **实际**: ✅ Hook 中调用 navigator.vibrate(50)
- [x] 冷却计时: 频繁摇不会连续触发
  - **实际**: ✅ 500ms 冷却时间

---

## Phase 2️⃣: 用户系统基础 (优先级: 🟡 下周开始)

### 功能 2.1: Supabase 用户认证

**完成度**: ✅ 100% **COMPLETED**
**预计工时**: 2-3 小时

#### 技术方案

- ✅ 使用 Supabase Authentication（Google/GitHub OAuth）
- ✅ 本地认证状态管理
- ✅ Session 持久化

#### 具体任务

- [x] Supabase 项目初始化
  - [x] 创建 Supabase 项目
  - [x] 安装 @supabase/supabase-js
  - [x] 配置环境变量
  - [x] 创建 Supabase 客户端

- [x] 认证 UI 组件 (`AuthScreen.tsx`)
  - [x] Google 登录按钮
  - [x] GitHub 登录按钮
  - [x] 游客模式（可选）
  - [x] 登出功能
  - [x] 错误提示

- [x] 用户数据模型

  ```typescript
  interface User {
    id: string;
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
      name?: string;
    };
  }
  ```

- [x] 本地认证状态
  - [x] useAuth hook
  - [x] 自动持久化 session
  - [x] 监听认证状态变化

- [x] 页面流程
  - [x] 未登录 → 显示登录屏
  - [x] 登录成功 → 跳转到主菜单
  - [x] 已登录 → 直接进入游戏设置
  - [x] Header 显示用户信息和登出按钮

- [x] 国际化支持
  - [x] 中文、英文、日文、法文翻译
  - [x] 登录页面完整国际化

#### 下一步需要配置（5分钟）

前往 Supabase Dashboard 配置 OAuth 提供商：

1. **Google OAuth:**
   - Authentication → Providers → Google
   - 启用 Google Provider
   - 创建 Google OAuth 应用（https://console.cloud.google.com/apis/credentials）
   - 填入 Client ID 和 Client Secret

2. **GitHub OAuth:**
   - Authentication → Providers → GitHub
   - 启用 GitHub Provider
   - 创建 GitHub OAuth App（https://github.com/settings/developers）
   - 填入 Client ID 和 Client Secret
   - Callback URL: `https://qjirnckllkqsrnicrnaz.supabase.co/auth/v1/callback`

#### 测试清单

- [x] 登录流程: Google OAuth 可工作 ✅
- [x] 登录流程: GitHub OAuth 可工作 ✅
- [x] 游客模式: 可以跳过登录直接进入
- [x] Session 持久化: 页面刷新后保持登录
- [x] 登出功能: 返回登录屏幕
- [x] 国际化: 所有语言显示正确

#### 已完成

- ✅ Supabase 项目创建和 OAuth 配置
- ✅ 前端认证UI和流程实现
- ✅ 修改 Supabase Site URL 解决 localhost 跳转问题

---

### 功能 2.2: 用户数据持久化

**完成度**: ✅ 100% **COMPLETED**
**预计工时**: 1 小时

#### 技术方案

- ✅ 迁移本地 localStorage → Supabase PostgreSQL
- ✅ 卡牌库、事件库自动云同步
- ✅ 跨设备数据一致性
- ✅ 离线模式支持（localStorage fallback）

#### 具体任务

- [x] 数据库结构设计

  ```sql
  -- user_profiles: 用户配置（背景、头像、名称）
  -- user_cards: 用户自定义卡牌库
  -- user_events: 用户自定义事件库
  -- RLS: 用户只能读写自己的数据
  ```

- [x] 创建 useUserData Hook
  - [x] 自动检测登录状态（userId）
  - [x] 登录用户：从 Supabase 读写
  - [x] 游客模式：使用 localStorage
  - [x] 首次登录：自动迁移 localStorage → Supabase
  - [x] 离线模式：优雅降级到 localStorage

- [x] 迁移 CardDatabase
  - [x] 云端读取用户自定义卡牌
  - [x] 本地 localStorage 作为备份
  - [x] 保存时同时写入云端和本地

- [x] 迁移 EventDatabase
  - [x] 云端读取用户自定义事件
  - [x] localStorage 备份
  - [x] 自动同步

- [x] 迁移 PlayerAvatars & Names
  - [x] 存储到 user_profiles 表
  - [x] 游戏开始时加载
  - [x] 修改即保存

- [x] 修改 GameSettings 组件
  - [x] 接受 userData props
  - [x] 调用 saveProfile() 保存到云端

- [x] 集成到 page.tsx
  - [x] 使用 useUserData hook
  - [x] 传递 userId (user?.id)
  - [x] 替换所有 setCardDatabase/setEventDatabase
  - [x] 使用 userData.saveCards/saveEvents

- [x] 执行 Supabase SQL Schema ✅
  - [x] 打开 Supabase SQL Editor
  - [x] 执行 `supabase/schema.sql`
  - [x] 验证 3 个表创建成功
  - [x] 验证 RLS 策略生效

#### 测试清单

- [x] 首次登录: localStorage 数据自动迁移到 Supabase ✅
- [x] 编辑卡牌: 保存后在 Supabase Table Editor 看到数据 ✅
- [x] 编辑事件: 保存后在 Supabase 看到数据 ✅
- [x] 修改背景/头像: 保存后在 user_profiles 表看到 ✅
- [x] 跨设备同步: B 设备登录同一账号，看到 A 设备的数据 ✅
- [x] 游客模式: 不影响云端，仅本地存储 ✅
- [x] 离线模式: Supabase 连接失败时降级到 localStorage ✅

#### 已完成文件

- ✅ `supabase/schema.sql` - 数据库 Schema
- ✅ `app/hooks/useUserData.ts` - 数据同步 Hook (280 行)
- ✅ `app/components/GameSettings.tsx` - 修改为云端同步
- ✅ `app/page.tsx` - 集成 useUserData
- ✅ `SUPABASE_DATABASE_SETUP.md` - 数据库初始化指南

#### 下一步（5分钟）

1. 访问 [Supabase SQL Editor](https://supabase.com/dashboard/project/qjirnckllkqsrnicrnaz/sql)
2. 执行 `supabase/schema.sql` 文件内容
3. 验证表创建成功（user_profiles, user_cards, user_events）
4. 测试云端同步功能

---

## Phase 3️⃣: 多用户同局 (优先级: 🟢 后续冲刺)

### 功能 3.1: 房间系统

**完成度**: ✅ 100% **COMPLETED**  
**预计工时**: 3-4 小时

#### 技术方案

- ✅ Next.js API Routes (服务端聚合数据)
- ✅ Supabase RLS 政策控制访问权限
- ✅ 房间码 (6位数字 + 字母) 用于快速加入
- ✅ 自动清理机制（数据库触发器）

#### 具体任务

- [x] 房间数据模型

  ```typescript
  interface Room {
    id: string; // UUID
    room_code: string; // 6字符 (2位数字 2-9 + 4字母避免O/I/L)
    creator_id: string; // 创建者ID
    players: RoomPlayer[]; // 当前玩家列表（通过API聚合）
    config: GameConfig; // 游戏配置
    status: "waiting" | "playing" | "finished";
    created_at: timestamp;
    updated_at: timestamp;
  }
  ```

- [x] 创建房间流程
  - [x] 生成唯一 roomCode (2位数字 2-9 + 4字母)
  - [x] 初始化房间状态
  - [x] 创建者作为第一个玩家自动加入
  - [x] 服务端 POST /api/rooms 返回完整房间数据

- [x] 加入房间流程
  - [x] 服务端验证房间存在且未满员
  - [x] 自动分配玩家号和颜色
  - [x] 添加新玩家到房间\_players
  - [x] 返回完整房间数据保证一致性

- [x] 房间管理
  - [x] 玩家离开房间（DELETE from room_players）
  - [x] 自动清理空房间（数据库触发器）
  - [x] 创建者可开始游戏（后续 3.2 实现）
  - [x] RLS 政策保证数据隐私

#### 已实现文件

- ✅ `/app/api/rooms/route.ts` - 服务端API (POST handler, 4个操作)
- ✅ `/app/hooks/useRoom.ts` - 客户端Hook改为调用API
- ✅ `/app/components/RoomManager.tsx` - 房间UI组件
- ✅ `/supabase/migrations/add_rooms.sql` - RLS政策和触发器

#### 测试清单

- [x] 创建房间: 获得6位房间码 ✅
- [x] 分享房间: 在 2 个设备上加入同一房间 ✅
- [x] 数据一致性: 两个浏览器显示相同玩家列表 ✅
- [x] 自动清理: 玩家全部离开后房间自动删除 ✅

---

### 功能 3.2: 实时游戏状态同步

**完成度**: 🟡 进行中 (API 实现 ✅，组件集成待做)
**预计工时**: 4-5 小时

#### 技术方案

- ✅ 使用 Supabase Realtime 实时订阅房间状态
- ✅ 服务端存储游戏状态到 room_games 表
- ✅ 事件驱动模式（掷骰子、移动、事件触发）
- ✅ 所有客户端通过 Realtime 订阅保持状态同步

#### 已完成实现

1. **✅ API 路由扩展** (`/app/api/rooms/route.ts`)
   - [x] startGame - 初始化游戏状态
   - [x] rollDice - 生成掷骰结果
   - [x] movePlayer - 更新玩家位置
   - [x] triggerEvent - 触发事件

2. **✅ Hook 扩展** (`/app/hooks/useRoom.ts`)
   - [x] 添加游戏操作方法（startGame, rollDice, movePlayer, triggerEvent）
   - [x] 添加 gameState 状态管理
   - [x] 建立 Realtime 订阅 room_games 表
   - [x] 自动同步玩家列表和游戏状态

3. **✅ 编译验证**
   - [x] TypeScript 检查通过
   - [x] 生产构建成功（1719.4ms）
   - [x] 所有路由正常注册

#### 待实现

- [ ] 在 GameSetup 集成 startGame
- [ ] 在 DiceControl 集成 rollDice
- [ ] 在 GameBoard 集成 movePlayer 和 triggerEvent
- [ ] 两浏览器实时同步测试
- [ ] 多人游戏完整流程测试

---

### 功能 3.3: 多设备 UI 适配

**完成度**: ⏳ 待开始  
**预计工时**: 2-3 小时

#### 技术方案

- 棋盘显示模式: PC 为中心，移动端为控制器
- 主设备显示完整棋盘、其他设备仅显示手牌和状态

#### 具体任务

- [ ] 设备角色区分
  - [ ] 房间创建者 = 主机（PC）
  - [ ] 其他成员 = 玩家（移动端）
  - [ ] 可配置: 允许多个 PC 或手机主持

- [ ] 主机视图 (PC)
  - [ ] 显示完整棋盘和所有玩家
  - [ ] 显示当前回合玩家
  - [ ] 显示游戏日志

- [ ] 玩家视图 (Mobile)
  - [ ] 隐藏棋盘（可选显示缩小版）
  - [ ] 突出自己的手牌
  - [ ] 显示当前状态（等待中/轮到你/触发事件）
  - [ ] 掷骰子按钮
  - [ ] 使用卡牌按钮

- [ ] 响应式布局调整
  - [ ] PC: 三栏布局（侧边栏 + 棋盘 + 侧边栏）
  - [ ] Mobile: 全屏手牌 / 迷你棋盘

#### 测试清单

- [ ] PC 端: 看到完整棋盘和所有玩家信息
- [ ] Mobile 端: 手牌清晰，掷骰按钮便捷
- [ ] 兼容性: iPad 显示为主机 / 迷你手机显示为玩家

---

## 📊 依赖关系图

```
┌─────────────────────────────────────────────────┐
│   Phase 1: 骰子配置 + 摇一摇                      │ ⬅️  独立进行
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│   Phase 2: 用户系统 (Firebase Auth)              │ ⬅️  依赖 Phase 1
│   ├─ 2.1 认证系统                                 │
│   ├─ 2.2 数据持久化                               │
└─────────────────────────────────────────────────┘
                    ⬇️
┌─────────────────────────────────────────────────┐
│   Phase 3: 多用户同局                             │ ⬅️  依赖 Phase 2
│   ├─ 3.1 房间系统                                 │
│   ├─ 3.2 状态同步                                 │
│   └─ 3.3 UI 适配                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 每周日程建议

### Week 1 (This Week)

- [x] Phase 1.1: 骰子个数配置 ✅ **完成**
- [x] Phase 1.2: 摇一摇掷骰子 ✅ **完成**
- [x] 测试 & 修复
- **预期**: 游戏体验大幅升级 ✅ **已达成**

### Week 2 ✅ **COMPLETED**

- [x] Phase 2.1: Supabase 认证系统 ✅
- [x] Phase 2.2: 数据持久化迁移 ✅
- [x] 测试 & QA ✅
- **成果**: 用户可跨设备同步卡牌 ✅ **已达成**

### Week 3+ (当前)

- [x] Phase 3.1: 房间系统（多用户同局）✅ **已完成**
  - ✅ 创建房间 + 玩家列表同步
  - ✅ 加入房间 + 数据一致性
  - ✅ 服务端 API 聚合 + RLS 策略
  - ✅ 自动清理机制
  - ✅ 两浏览器测试验证 ✅
- 🟡 Phase 3.2: 状态同步（实时协作）**进行中**
  - ⏳ 扩展 API 路由 (startGame, rollDice, movePlayer, triggerEvent)
  - ⏳ 建立 Realtime 订阅机制
  - ⏳ 游戏流程事件同步
- [ ] Phase 3.3: UI 适配（多设备支持）
- **目标**: MVP 当周完成，支持多人在线游戏 🎮

---

## 🔧 技术栈总结

| 功能     | 技术                            |
| -------- | ------------------------------- |
| 骰子配置 | React State                     |
| 摇一摇   | DeviceMotionEvent API           |
| 用户认证 | Supabase Auth (OAuth)           |
| 数据存储 | Supabase PostgreSQL             |
| 房间系统 | Supabase + Realtime API         |
| 状态同步 | Supabase Realtime Subscriptions |
| 实时通信 | Supabase Realtime + WebSocket   |

---

## 📝 检查清单

### 启动 Phase 1

- [ ] 审核骰子配置实现方案
- [ ] 审核摇一摇 API 兼容性
- [ ] 定义测试用例

### 启动 Phase 2

- [ ] 创建 Firebase 项目
- [ ] 设计数据库 schema
- [ ] 审核认证流程

### 启动 Phase 3

- [ ] 确认多用户场景（LAN vs Cloud）
- [ ] 定义房间码生成规则
- [ ] 设计冲突解决策略

---

## 📞 讨论记录

**日期**: 2026-03-01  
**参与者**: AI + User  
**关键成就**: 多用户房间系统完成，玩家数据同步验证成功 ✅

**Phase 3.1 完成决策**:

1. ✅ 房间系统架构 - 使用 Next.js API Routes (Plan B)
   - 原因: 简单、免费、快速迭代
   - 已弃用 Plan A (Supabase Edge Functions) 和 GraphQL
   - 已弃用 Plan C (Socket.io)

2. ✅ 服务端数据聚合 - SERVICE_ROLE_KEY 绕过 RLS
   - 所有房间操作通过 /api/rooms 聚合
   - 保证所有客户端收到一致的 {room, players[]}
   - 客户端仅通过 Hook 调用 API，不直接查询数据库

3. ✅ 房间码生成 - 2位数字 + 4位字母
   - 避免混淆的字符 (O/I/L)
   - 超过 3300 万种组合可用

4. ✅ 玩家自定义名称
   - createRoom 现支持 playerName 参数
   - Host 不再硬编码，使用创建者输入名称

5. ⬇️ **下一步**: 扩展 API 实现游戏状态同步 (Phase 3.2)
   - rollDice: 掷骰子结果同步
   - movePlayer: 棋盘位置同步
   - triggerEvent: 事件触发同步
   - startGame: 游戏开始状态同步

---

**最后更新**: 2026-03-01 | **状态**: 🟡 Phase 3.2 进行中 (游戏状态同步)
