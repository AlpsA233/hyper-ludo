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

环境变量已自动同步，无需额外配置。

## ⚠️ 注意事项

1. **开发环境（localhost）：**
   - 需要在 Google/GitHub OAuth 应用中添加 `http://localhost:3000` 到授权 URL

2. **生产环境：**
   - 更新 OAuth 应用的授权 URL 为实际域名
   - 例如：`https://hyper-ludo.vercel.app`

3. **Redirect URI 必须完全匹配：**
   - Supabase Callback: `https://qjirnckllkqsrnicrnaz.supabase.co/auth/v1/callback`
   - 不要漏掉 `/auth/v1/callback`

## 📊 当前状态

- ✅ **Supabase 项目已创建**
- ✅ **代码实现完成**
- ⏳ **等待配置 OAuth 提供商**
