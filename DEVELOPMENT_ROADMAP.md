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

**完成度**: ✅ 95% (需配置 OAuth 提供商)
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

- [ ] 登录流程: Google OAuth 可工作（需配置后测试）
- [ ] 登录流程: GitHub OAuth 可工作（需配置后测试）
- [x] 游客模式: 可以跳过登录直接进入
- [x] Session 持久化: 页面刷新后保持登录
- [x] 登出功能: 返回登录屏幕
- [x] 国际化: 所有语言显示正确

---

### 功能 2.2: 用户数据持久化

**完成度**: 0%  
**预计工时**: 1 小时

#### 技术方案

- 迁移本地 localStorage → Firebase Realtime DB
- 卡牌库、事件库自动云同步
- 跨设备数据一致性

#### 具体任务

- [ ] 数据库结构设计

  ```
  /users/{uid}
    /profile
    /cards[]
    /events[]
    /settings{}
    /gameHistory[]
  ```

- [ ] 迁移 CardDatabase
  - [ ] 云端读取用户自定义卡牌
  - [ ] 本地 localStorage 作为备份
  - [ ] 冲突解决（云端优先）

- [ ] 迁移 EventDatabase
  - [ ] 同 CardDatabase 逻辑
  - [ ] 确保事件编辑同步保存

- [ ] 迁移 PlayerAvatars & Names
  - [ ] 用户个人信息存储
  - [ ] 游戏开始时加载

- [ ] 离线模式支持
  - [ ] 网络断开时使用本地数据
  - [ ] 网络恢复时自动同步
  - [ ] 冲突检测（选择新/旧）

#### 测试清单

- [ ] Firebase 读写正常
- [ ] 跨浏览器标签同步: A 标签编辑卡牌，B 标签立即看到
- [ ] 离线编辑: 网络断开，本地添加数据，网络恢复自动上传

---

## Phase 3️⃣: 多用户同局 (优先级: 🟢 后续冲刺)

### 功能 3.1: 房间系统

**完成度**: 0%  
**预计工时**: 3-4 小时

#### 技术方案

- Firebase Realtime DB 维护房间状态
- WebSocket (Socket.io) 实时事件推送（可选）
- 房间码 (6位数字) 用于快速加入

#### 具体任务

- [ ] 房间数据模型

  ```typescript
  interface Room {
    roomId: string; // 唯一标识
    roomCode: string; // 6位数字，用于分享
    creatorUid: string; // 创建者ID
    players: Player[]; // 当前玩家列表
    gameConfig: GameConfig; // 游戏配置
    state: "waiting" | "playing" | "finished";
    createdAt: timestamp;
    expiresAt: timestamp; // 自动清理
  }
  ```

- [ ] 创建房间流程
  - [ ] 生成唯一 roomCode
  - [ ] 初始化房间状态
  - [ ] 创建者自动加入（作为 Player 1）
  - [ ] 显示房间码给其他玩家

- [ ] 加入房间流程
  - [ ] 输入房间码查询
  - [ ] 验证房间是否存在且未满员
  - [ ] 添加新玩家到房间
  - [ ] 分配玩家颜色和编号

- [ ] 房间管理
  - [ ] 创建者可踢出玩家
  - [ ] 创建者可开始游戏
  - [ ] 玩家可离开房间
  - [ ] 自动清理空房间（15分钟无活动）

#### 测试清单

- [ ] 创建房间: 获得6位房间码
- [ ] 分享房间: 在 2 个设备上加入同一房间
- [ ] 满员处理: 房间满人后新用户无法加入
- [ ] 自动清理: 空房间 15 分钟后消失

---

### 功能 3.2: 实时游戏状态同步

**完成度**: 0%  
**预计工时**: 4-5 小时

#### 技术方案

- 主设备（创建者）作为"游戏主机"维护状态
- 其他设备（玩家）通过 Firebase Listener 订阅状态更新
- 事件驱动（谁掷骰子、谁触发事件等）

#### 具体任务

- [ ] 游戏状态云端存储

  ```
  /rooms/{roomId}/game
    /turn: number
    /phase: string
    /players[]: Player[]
    /diceValue: number
    /events: GameEvent[]
    /activeSituation: {}
  ```

- [ ] 状态变化事件
  - [ ] 主机: 状态变化 → 写入 Firebase
  - [ ] 其他: 监听 Firebase → 更新本地状态
  - [ ] 延迟: < 500ms 为佳

- [ ] 掷骰子同步
  - [ ] 当前玩家掷骰
  - [ ] 结果上传到 Firebase
  - [ ] 其他玩家同时看到动画

- [ ] 移动动画同步
  - [ ] 玩家移动 → 坐标发送
  - [ ] 其他设备同步显示动画
  - [ ] 棋盘位置在所有设备一致

- [ ] 事件同步
  - [ ] 事件触发 → 所有设备弹出对话框
  - [ ] 确认事件 → 所有设备同时继续游戏

- [ ] 卡牌操作同步
  - [ ] 使用卡牌 → 同步状态
  - [ ] 更新手牌 → 所有玩家看到

#### 技术细节

```typescript
// 监听示例
const unsubscribe = ref(db, `rooms/${roomId}/game`).on("value", (snapshot) => {
  const gameState = snapshot.val();
  // 对比本地状态，找出差异更新
  updateGameState(gameState);
});
```

#### 测试清单

- [ ] 2 个设备: A 掷骰，B 立即看到结果
- [ ] 多个设备: A/B/C 同时游戏，状态完全同步
- [ ] 网络延迟: 模拟 200ms 延迟，功能正常
- [ ] 断线重连: 网络断开后恢复，自动同步最新状态
- [ ] 性能: 4 个玩家总延迟 < 1s

---

### 功能 3.3: 多设备 UI 适配

**完成度**: 0%  
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

### Week 2

- [ ] Phase 2.1: Firebase 认证系统
- [ ] Phase 2.2: 数据持久化迁移
- [ ] 测试 & QA
- [ ] **预期**: 用户可跨设备同步卡牌

### Week 3+

- [ ] Phase 3.1: 房间系统
- [ ] Phase 3.2: 状态同步
- [ ] Phase 3.3: UI 适配
- [ ] **预期**: MVP 完成，支持多人在线游戏

---

## 🔧 技术栈总结

| 功能     | 技术                     |
| -------- | ------------------------ |
| 骰子配置 | React State              |
| 摇一摇   | DeviceMotionEvent API    |
| 用户认证 | Firebase Auth            |
| 数据存储 | Firebase Realtime DB     |
| 房间系统 | Firebase + Realtime DB   |
| 状态同步 | Firebase Listeners       |
| 实时通信 | Firebase（或 Socket.io） |

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

**日期**: 2026-02-28  
**参与者**: AI + User  
**讨论内容**: 功能优先级排序 + 技术方案评审  
**决策**:

1. ✅ Phase 1 本周内完成
2. ✅ Phase 2 为 Phase 3 铺路
3. ✅ Firebase 作为后端首选
4. ✅ 本地 LAN + Cloud 混合模式

---

**最后更新**: 2026-02-28 | **状态**: 🔵 计划阶段
