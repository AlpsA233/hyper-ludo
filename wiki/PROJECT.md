# Hyper-Ludo 项目档册

## 基本信息

| 项目 | 内容 |
|------|------|
| 名称 | Hyper-Ludo |
| 类型 | 多人在线飞行棋游戏 |
| 技术栈 | Next.js + Supabase |
| 代码目录 | /home/alps/Documents/develop/hyper-ludo |
| 工作目录 | /home/alps/Documents/develop/hyper-ludo/wiki |

## 项目结构

```
hyper-ludo/
├── app/              # Next.js 应用代码
├── supabase/         # Supabase 配置
├── public/           # 静态资源
├── wiki/             # 工作目录（不提交 git）
├── *.md              # 开发文档
└── package.json
```

## 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 骰子配置 + 摇一摇 | ✅ 已完成 |
| Phase 2 | Firebase 用户系统 | 🔨 进行中 |
| Phase 3 | 多用户同局网络同步 | 📋 规划中 |

## 核心文档

- `DEVELOPMENT_ROADMAP.md` - 开发路线图
- `DICE_IMPLEMENTATION_COMPLETE.md` - 骰子实现文档
- `MULTIPLAYER_GAMEPLAY_DESIGN.md` - 多人游戏设计
- `GAME_STATE_SYNC_GUIDE.md` - 游戏状态同步指南
- `SUPABASE_DATABASE_SETUP.md` - 数据库设置

## 技术要点

- 骰子数量可配置（1-3个）
- 支持摇一摇掷骰（移动端）
- 多语言支持（中/英/日/法）
- Supabase 用于数据存储和实时同步
