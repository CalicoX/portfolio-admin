# Portfolio Admin - 项目记忆文档

## 📋 项目概述
- **项目名称**: portfolio-admin
- **类型**: React + TypeScript + Vite 后台管理系统
- **部署地址**: https://calicox.github.io/portfolio-admin/
- **用途**: 管理 portfolio-website 的内容（通过 Contentful CMS）

## 🛠 技术栈
| 类别 | 技术 |
|------|------|
| 框架 | React 19.2.0 |
| 构建工具 | Vite 7.2.4 |
| 语言 | TypeScript 5.9.3 |
| 样式 | Tailwind CSS 4.1.18 |
| UI 组件 | shadcn/ui (@radix-ui) |
| 图标 | lucide-react |
| CMS | Contentful (Delivery + Management API) |
| 认证 | SHA-256 + TOTP (2FA) |

## 📁 项目结构
```
src/
├── App.tsx              # 主应用，管理认证状态
├── AdminPanel.tsx       # 管理员面板（核心功能，~900行）
├── LoginScreen.tsx      # 登录界面
├── main.tsx             # React 入口
├── index.css            # 全局样式 + Tailwind 主题
├── assets/              # 静态资源
lib/
├── adminAuth.ts         # 认证工具（Token生成/验证）
├── contentful.ts        # Contentful Delivery API
├── contentfulManagement.ts  # Contentful Management API (CRUD)
├── totp.ts              # TOTP 双因素认证实现
└── utils.ts             # 工具函数（cn合并类名）
components/ui/           # shadcn/ui 组件库
├── button.tsx
├── card.tsx
├── input.tsx
├── dialog.tsx
├── tabs.tsx
└── ... (14个组件)
```

## 🔐 认证系统

### 登录流程
1. 密码验证 → SHA-256 哈希比对
2. 如果启用 TOTP → 输入 6 位验证码
3. 生成带签名的 Session Token (15分钟有效期)

### Token 结构
```
{timestamp}.{random}.{signature}
```
- 时间戳 + 随机数 + HMAC-SHA256 签名
- 存储在 localStorage (key: `_as_t`)

### 2FA (TOTP)
- 算法: HMAC-SHA1, 6位数字, 30秒窗口
- 密钥: `VITE_TOTP_SECRET` (Base32)
- 支持验证当前/前一/后一时间窗口（容错）

## 🗄 Contentful 集成

### Content Models
| Model | 描述 | 状态 |
|-------|------|------|
| index | 主页设置（Hero/个人资料）| ✅ 已实现 |
| photo | 照片画廊 | ✅ 已实现 |
| navigation | 导航菜单 | 🚧 待实现 |
| portfolio | UI/Graphic 项目 | 🚧 待实现 |
| stat | 统计数据 | 🚧 待实现 |
| settings | 管理配置 | ✅ 已实现(2FA设置) |

### API 双客户端
1. **Delivery API** (`contentful.ts`) - 只读，用于前端展示
2. **Management API** (`contentfulManagement.ts`) - CRUD，用于管理后台

### 已实现的 CRUD 操作
- ✅ Photo: 创建、更新、删除、列表
- ✅ Index: 读取、更新
- ✅ Asset: 上传图片、处理、发布

## 🎨 UI 设计系统

### 主题
- **主色调**: 蓝色 (hsl 217 91% 60%)
- **基础色**: Zinc 暗色主题
- **圆角**: 1rem (现代卡片风格)
- **模式**: 仅暗色模式

### 关键组件样式
```css
/* 玻璃态卡片 */
.card-glass {
  background: hsl(var(--card) / 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid hsl(var(--border) / 0.5);
}
```

### 动画
- `animate-slide-up-fade` - 内容滑入
- `animate-scale-in` - 弹窗缩放
- `animate-fade-in` - 淡入

## 🔧 环境变量
```bash
# Contentful
VITE_CONTENTFUL_SPACE_ID=51kof2zghp55
VITE_CONTENTFUL_ACCESS_TOKEN=...
VITE_CONTENTFUL_MANAGEMENT_TOKEN=CFPAT-...

# 认证
VITE_ADMIN_PASSWORD_HASH=240be518...  # SHA-256 of 'admin123'
VITE_TOTP_SECRET=SX4EMSNYQR57NQ7YYYQSOCD5ZICDQK2H
```

## 🚀 开发命令
```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run preview  # 预览构建
```

## ⚠️ 重要注意
1. **Management Token** 需要用户手动输入存储在 localStorage
2. 密码哈希需要预先计算 SHA-256
3. TOTP Secret 需要配合 Authenticator App 使用
4. 项目仅支持暗色模式

## 🔗 相关项目
- 前端展示站点: https://calicox.github.io/portfolio-website

## 📝 最近提交

| 时间 | 分支 | 提交 | 说明 |
|------|------|------|------|

---
*最后更新: 2026-02-08*
