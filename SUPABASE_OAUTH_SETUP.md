# Supabase OAuth 配置指南

## 📝 配置步骤

### 1️⃣ Google OAuth

1. **创建 Google OAuth 应用：**
   - 访问 https://console.cloud.google.com/apis/credentials
   - 点击 "创建凭据" → "OAuth 客户端 ID"
   - 应用类型选择 "Web 应用"
   - 已授权的重定向 URI 添加：
     ```
     https://qjirnckllkqsrnicrnaz.supabase.co/auth/v1/callback
     ```

2. **配置 Supabase：**
   - 进入 Supabase Dashboard: https://supabase.com/dashboard/project/qjirnckllkqsrnicrnaz
   - Authentication → Providers → Google
   - 启用 Google
   - 粘贴 Client ID 和 Client Secret
   - 保存

### 2️⃣ GitHub OAuth

1. **创建 GitHub OAuth App：**
   - 访问 https://github.com/settings/developers
   - 点击 "New OAuth App"
   - 填写信息：
     - Application name: `Hyper Ludo`
     - Homepage URL: `https://your-domain.vercel.app` (或本地 `http://localhost:3000`)
     - Authorization callback URL:
       ```
       https://qjirnckllkqsrnicrnaz.supabase.co/auth/v1/callback
       ```

2. **配置 Supabase：**
   - Authentication → Providers → GitHub
   - 启用 GitHub
   - 粘贴 Client ID 和 Client Secret
   - 保存

## 🧪 本地测试

```bash
npm run dev
```

访问 `http://localhost:3000`，应该看到登录页面：

- ✅ 点击 "使用 Google 登录" → 跳转 Google 授权
- ✅ 点击 "使用 GitHub 登录" → 跳转 GitHub 授权
- ✅ 点击 "游客模式继续" → 直接进入游戏

## 🚀 部署到 Vercel

### 必须配置 Supabase Site URL

部署后，必须修改 Supabase 的 Site URL，否则登录后会跳转到 localhost:3000。

**操作步骤：**

1. 访问 [Supabase Settings - Authentication](https://supabase.com/dashboard/project/qjirnckllkqsrnicrnaz/settings/auth)

2. **修改 Site URL**（必须）：
   - 将 `http://localhost:3000` 改为你的 Vercel 域名
   - 例如：`https://hyper-ludo.vercel.app`
   - 点击 Save

3. **添加 Redirect URLs**：
   - 添加生产环境：`https://hyper-ludo.vercel.app/**`
   - 保留开发环境：`http://localhost:3000/**`

4. 环境变量已自动同步，无需额外配置。

## ⚠️ 注意事项

### 常见问题：登录后跳转到 localhost:3000

**症状：** Vercel 部署后，Google/GitHub 登录成功后跳转到 `http://localhost:3000`

**原因：** Supabase Site URL 还是默认的 localhost:3000

**解决：** 按照上面"部署到 Vercel"部分修改 Site URL 为实际域名

---

1. **开发环境（localhost）：**
   - Supabase Redirect URLs 需包含：`http://localhost:3000/**`
   - 本地测试时 Site URL 可以设为 localhost

2. **生产环境：**
   - Supabase Site URL 必须设为 Vercel 域名
   - Supabase Redirect URLs 需包含：`https://your-domain.vercel.app/**`

3. **Redirect URI 必须完全匹配：**
   - Supabase Callback: `https://qjirnckllkqsrnicrnaz.supabase.co/auth/v1/callback`
   - 这个回调 URL 不需要修改，在所有环境通用
   - 不要漏掉 `/auth/v1/callback`

## 📊 当前状态

- ✅ **Supabase 项目已创建**
- ✅ **代码实现完成**
- ⏳ **等待配置 OAuth 提供商**
