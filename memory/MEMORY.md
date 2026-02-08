# Portfolio Admin 项目记忆

*最后更新: 2026-02-08 13:49*

## 项目概述

- **项目名称**: portfolio-admin
- **类型**: 个人作品集 CMS 管理后台
- **部署地址**: https://calicox.github.io/portfolio-admin/

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| UI 组件 | Radix UI + Lucide React |
| CMS | Contentful (Delivery + Management API) |
| 通知 | Sonner |
| 主题 | next-themes |

## 项目结构

```
src/
├── App.tsx           # 主应用，认证状态管理
├── main.tsx          # 入口文件
├── AdminPanel.tsx    # 管理面板主界面
├── LoginScreen.tsx   # 登录页面
├── index.css         # 全局样式
└── assets/           # 静态资源

lib/
├── adminAuth.ts          # Token 认证工具
├── contentful.ts         # Contentful Delivery API
├── contentfulManagement.ts  # Contentful Management API
├── totp.ts               # TOTP 验证
└── utils.ts              # 通用工具

components/ui/        # shadcn/ui 组件
├── avatar.tsx
├── badge.tsx
├── button.tsx
├── card.tsx
├── dialog.tsx
├── input.tsx
├── label.tsx
├── select.tsx
├── separator.tsx
├── sonner.tsx
├── switch.tsx
├── tabs.tsx
└── textarea.tsx
```

## 核心功能

### 1. 认证系统
- 基于 SHA-256 的 Token 认证
- 15 分钟 Token 过期时间
- 本地存储 key: `_as_t`
- 常量时间签名验证（防时序攻击）

### 2. 管理功能
- **照片管理**: 上传、编辑、删除照片
- **首页配置**: Hero 标题/副标题、个人简介、头像、CV 链接
- **Token 管理**: Contentful Management Token 输入和存储

### 3. Contentful 数据模型
- `portfolio` - 作品集项目
- `photo` - 摄影作品
- `index` - 首页配置
- `stat` - 统计数据
- `navigation` - 导航配置
- `blogPost` - 博客文章

## 环境变量

```bash
VITE_CONTENTFUL_SPACE_ID=xxx
VITE_CONTENTFUL_ACCESS_TOKEN=xxx      # Delivery API Token
VITE_ADMIN_PASSWORD_HASH=xxx          # 管理员密码 SHA-256 Hash
VITE_TOTP_SECRET=xxx                  # TOTP 密钥
```

## 关键文件引用

| 功能 | 文件路径 |
|------|----------|
| 认证逻辑 | [lib/adminAuth.ts](lib/adminAuth.ts) |
| Contentful 查询 | [lib/contentful.ts](lib/contentful.ts) |
| Contentful 管理 API | [lib/contentfulManagement.ts](lib/contentfulManagement.ts) |
| TOTP 验证 | [lib/totp.ts](lib/totp.ts) |
| 主应用 | [src/App.tsx](src/App.tsx) |
| 管理面板 | [src/AdminPanel.tsx](src/AdminPanel.tsx) |
| 登录页面 | [src/LoginScreen.tsx](src/LoginScreen.tsx) |

## 开发命令

```bash
npm run dev      # 开发模式
npm run build    # 构建（输出到 dist/）
npm run preview  # 预览构建
```

## 注意事项

1. **安全**: Token 存储在 localStorage，15 分钟后过期
2. **Contentful**: 需要 Management Token 才能进行写操作
3. **图片上传**: 通过 Management API 上传并自动发布
4. **部署**: GitHub Actions 自动部署到 GitHub Pages

## 📝 最近提交

| 时间 | 分支 | 提交 | 说明 |
|------|------|------|------|
| 2026-02-08 13:49 | `Home-Macmini` | `1c3133c` | feat: 设置自动更新 memory.md 的 git hooks |
| 2026-02-08 13:48 | `Home-Macmini` | `fe163cf` | feat: 设置自动更新 memory.md 的 git hooks |
| 2026-02-08 13:48 | `Home-Macmini` | `18bef09` | feat: 设置自动更新 memory.md 的 git hooks |
| 2026-02-08 13:47 | `Home-Macmini` | `bbdecdf` | feat: 设置自动更新 memory.md 的 git hooks |
| 2026-02-08 13:45 | `Home-Macmini` | `1ff598a` | feat: add memory.md and auto-update hook |
