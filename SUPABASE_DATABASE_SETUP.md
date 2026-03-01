# Supabase 数据库初始化指南

## 📝 操作步骤

### 1️⃣ 访问 Supabase SQL Editor

1. 登录 Supabase Dashboard: https://supabase.com/dashboard/project/qjirnckllkqsrnicrnaz
2. 点击左侧菜单 **SQL Editor**
3. 点击 **New Query** 按钮

### 2️⃣ 执行 Schema SQL

1. 打开项目中的文件: `supabase/schema.sql`
2. **复制全部内容**（约 120 行）
3. 粘贴到 SQL Editor 中
4. 点击右下角 **Run** 按钮（或按 `Ctrl+Enter` / `Cmd+Enter`）

### 3️⃣ 验证表创建成功

执行完成后，应该看到以下信息：

```
Success. No rows returned
```

然后在左侧菜单点击 **Table Editor**，应该能看到 3 个新表：

- ✅ `user_profiles` - 用户配置表
- ✅ `user_cards` - 用户自定义卡牌表
- ✅ `user_events` - 用户自定义事件表

### 4️⃣ 确认 RLS 策略

点击 **Authentication → Policies**，应该看到：

**user_profiles:**

- ✅ Users can view their own profile (SELECT)
- ✅ Users can insert their own profile (INSERT)
- ✅ Users can update their own profile (UPDATE)

**user_cards:**

- ✅ Users can view their own cards (SELECT)
- ✅ Users can insert their own cards (INSERT)
- ✅ Users can update their own cards (UPDATE)

**user_events:**

- ✅ Users can view their own events (SELECT)
- ✅ Users can insert their own events (INSERT)
- ✅ Users can update their own events (UPDATE)

## ⚙️ Schema 说明

### 表结构

#### user_profiles

存储用户的个人设置：

```sql
- id: UUID (主键，关联 auth.users)
- background_type: TEXT (背景类型: color/image)
- background_value: TEXT (背景值: 颜色代码或图片URL)
- player_avatars: JSONB (玩家头像数组，默认8个👤)
- player_names: JSONB (玩家名称数组)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### user_cards

存储用户自定义卡牌库：

```sql
- id: BIGSERIAL (主键)
- user_id: UUID (关联 auth.users)
- cards: JSONB (卡牌数组)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
UNIQUE(user_id) - 每个用户只有一条记录
```

#### user_events

存储用户自定义事件库：

```sql
- id: BIGSERIAL (主键)
- user_id: UUID (关联 auth.users)
- events: JSONB (事件数组)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
UNIQUE(user_id) - 每个用户只有一条记录
```

### RLS（Row Level Security）

所有表都启用了行级安全策略，确保：

- ✅ 用户只能查看自己的数据
- ✅ 用户只能修改自己的数据
- ✅ 无法访问其他用户的数据

### 自动更新时间戳

每个表都有 `updated_at` 触发器：

- 每次 UPDATE 操作自动更新 `updated_at` 字段为当前时间
- 无需手动维护

## 🔄 工作原理

### 首次登录

1. 用户登录后，系统检查 Supabase 是否存在数据
2. 如果不存在，自动从 `localStorage` 迁移数据到云端
3. 创建 `user_profiles`, `user_cards`, `user_events` 记录

### 后续使用

1. **登录用户**: 数据自动从 Supabase 加载
2. **游客模式**: 继续使用 localStorage（不会上传到云端）
3. **跨设备同步**: 同一账号在不同设备上自动同步

### 离线模式

即使 Supabase 连接失败：

- ✅ 数据仍保存到 localStorage
- ✅ 游戏正常工作
- ⚠️ 数据不会同步到云端
- 🔄 网络恢复后，下次保存会自动同步

## 🧪 测试云端同步

### 测试步骤

1. **登录账号**（Google 或 GitHub）
2. **编辑卡牌**：游戏设置 → 自定义卡牌 → 添加新卡牌 → 保存
3. **在 Supabase Dashboard 验证**：
   - Table Editor → user_cards
   - 应该能看到你的 `user_id` 和 `cards` 数据

4. **编辑事件**：游戏设置 → 自定义事件 → 添加新事件 → 保存
5. **修改背景和头像**：游戏设置 → 外观设置 → 保存

6. **跨设备测试**：
   - 在另一台电脑或浏览器登录同一账号
   - 应该自动加载你的卡牌、事件和设置

7. **退出登录测试**：
   - 退出账号 → 以游客模式进入
   - 应该使用本地 localStorage 数据（空数据或旧数据）
   - 重新登录 → 应该恢复云端数据

## ⚠️ 注意事项

1. **游客模式数据**
   - 游客模式的数据仅存储在 localStorage
   - 不会上传到云端
   - 清除浏览器缓存会丢失游客数据

2. **数据迁移**
   - 首次登录时，会自动迁移 localStorage 数据到云端
   - 迁移后，localStorage 作为备份继续保留
   - 云端数据优先级更高

3. **冲突解决**
   - 目前策略：**云端优先**
   - 如果云端和本地数据不同，使用云端数据
   - 未来可以添加"选择版本"功能

## 📊 当前状态

- ✅ **Schema 设计完成**
- ✅ **useUserData Hook 实现完成**
- ✅ **前端集成完成**
- ⏳ **等待执行 SQL 创建表**
- ⏳ **等待测试云端同步**

---

**下一步**: 在 Supabase SQL Editor 中执行 `supabase/schema.sql` 文件内容
