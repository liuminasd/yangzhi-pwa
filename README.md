# 仰止 💬

> 高山仰止，景行行止 ——《诗经·小雅》

一个**移动优先**的 AI 聊天应用，具备长期记忆能力。既是你的 AI 伙伴，也是沟通辅助工具。

## ✨ 核心功能

### 🤖 仰止
- 有温度、有记忆的自然对话
- 记住你的个人信息、偏好、重要事件
- 类微信的聊天体验，支持流式逐字回复

### 🧠 长期记忆（三层架构）
1. **对话存储** — 所有聊天记录持久保存
2. **自动提取** — AI 自动从对话中学习关于你的事实
3. **记忆注入** — 新对话时自动注入相关记忆

### 🧰 技能系统（9个内置技能）
| 技能 | 功能 |
|---|---|
| ✨ 改写润色 | 优化文字表达 |
| 🌐 翻译 | 中英互译 |
| 🎭 语气调整 | 友好/专业/幽默/委婉 |
| 💛 共情倾听 | AI 共情式回应 |
| 🎯 狗头军师 | 恋爱关系顾问 |
| 📊 对话分析 | 分析沟通模式 |
| 🧠 记忆召回 | 搜索AI记住的信息 |
| 📝 摘要总结 | 总结对话要点 |
| 💡 头脑风暴 | 创意发散和解决方案 |

### 📱 PWA 支持
- 可安装到手机/桌面
- 离线可用（Service Worker）
- 响应式设计（手机 + 桌面）

## 🚀 部署到 GitHub Pages

1. Fork 或推送此仓库到 GitHub
2. 进入仓库 Settings → Pages
3. Source 选择 **GitHub Actions**
4. 推送代码到 `main` 分支，自动部署

## 🔧 本地使用

**方式一：直接打开**
浏览器打开 `index.html`。

**方式二：本地服务器（推荐）**
```bash
# Windows 双击 start.bat
# 或手动：
npx serve .
```

首次使用需要在**设置**页面配置 DeepSeek API Key（[获取地址](https://platform.deepseek.com/api_keys)）。

## 🛡️ 安全说明

- API Key 仅存储在浏览器 localStorage 中
- 所有数据存储在浏览器 IndexedDB 中
- 不会上传任何数据到第三方服务器
- 支持加密导出数据

## 📂 项目结构

```
├── index.html          # 主入口
├── start.bat           # Windows 快速启动
├── manifest.json       # PWA
├── sw.js               # Service Worker
├── css/                # 样式
├── js/
│   ├── app.js          # 入口
│   ├── api.js          # API 层
│   ├── config.js       # 配置
│   ├── memory/         # 记忆系统
│   ├── skills/         # 技能模块
│   ├── ui/             # 界面组件
│   └── utils/          # 工具函数
└── .github/workflows/  # 自动部署
```

## 📄 License

MIT
