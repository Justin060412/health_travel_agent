# AI 康养旅居智能规划平台

> 大学生创新创业项目 — v2.0 Product-grade
>
> 上海师范大学 环境与地理科学学院 · 苏马荡山地候鸟式康养旅居供需匹配研究

## 项目简介

基于 AI 的康养旅居目的地推荐平台。用户填写个人信息与偏好后，AI 智能推荐最适合的康养旅居地点，并在地图上可视化展示。

项目源自上海师范大学大创项目《苏马荡山地候鸟式康养旅居供需匹配研究》。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML + CSS + JavaScript + Leaflet.js |
| 后端 | Python FastAPI |
| 数据库 | SQLite |
| AI | LLM API（DeepSeek / 通义千问） |
| 地图 | Leaflet.js（免费开源） |
| 设计 | Design Guideline v1.0（Apple/Linear 风格） |

> **环境要求**: Python 3.12+（推荐 3.12.5）

## 快速启动

### 1. 环境配置（仅首次）

```bash
# 复制环境变量模板并填入真实 API Key
cp .env.example .env
# 编辑 .env，将 API_KEY 替换为你的真实 DeepSeek API Key
```

### 2. 安装依赖（仅首次）

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**macOS / Linux (Bash/Zsh):**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 启动后端

> 必须在项目根目录执行（不是 `backend/` 目录）

**Windows (PowerShell):**
```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

**macOS / Linux (Bash/Zsh):**
```bash
source venv/bin/activate
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

后端运行在 `http://localhost:8000`

### 4. 打开前端

使用 Live Server 打开 `frontend/index.html`（推荐 VS Code Live Server 插件，地址为 `http://127.0.0.1:5500`）。

> ⚠️ 不要用 `file://` 协议打开，会导致 sessionStorage 跨页面失效。

## 项目结构

```
health_travel_agent/
├── README.md
├── DESIGN_GUIDELINE.md            # 品牌设计规范 v1.0
├── requirements.txt
├── .gitignore
├── .env                           # DeepSeek API Key（需自行配置）
├── docs/
│   ├── 开发日志.md                 # 完整开发过程记录
│   └── Sprint5_Final_Report.md     # v1.0 验收报告
├── data/
│   └── health_travel.db            # SQLite（12 个目的地 × 25 字段）
├── backend/                        # Python FastAPI 后端
│   ├── main.py                     # 入口（3 个路由 + CORS + lifespan）
│   ├── config.py                   # DB 路径 + .env 加载
│   ├── database.py                 # SQLite 连接 + 建表
│   ├── models.py                   # Pydantic 数据模型（31 字段）
│   ├── schemas.py                  # 请求/响应 Schema
│   ├── seed_data.py                # 12 个种子目的地（仅首次初始化）
│   └── ai_engine/
│       ├── provider.py             # LLM API 封装（OpenAI 兼容）
│       └── recommender.py          # 推荐引擎（数据驱动 Prompt + 规则降级）
├── frontend/                       # 前端（模块化 CSS 13文件 + JS 11文件）
│   ├── index.html                  # 🆕 5 章节日式首页（Hero → Platform → Earth → Story → Ending）
│   ├── questionnaire.html          # 6 步 API 同步 AI 分析动画
│   ├── results.html                 # AI 结果页 + Brand Marker 地图双向联动
│   ├── css/                        # 13 个模块化 CSS 文件
│   ├── js/                         # 11 个模块化 JS 文件
│   └── data/
│       └── destinations.geojson    # 12 个目的地 GeoJSON
└── health_travel_data/             # 外部数据仓库（137 文件）
```

## 功能矩阵

| 功能 | 说明 |
|------|------|
| **AI 推荐引擎** | DeepSeek 大模型基于 18 个环境数据字段深度推理，失败时自动规则降级 |
| **数据驱动首页** | Hero Glass Panel 实时数据、8 磁贴平台概览、精选卡片、预览地图 |
| **AI 分析动画** | 6 步 API 同步动画（非假 Loading），真实反映 AI 分析过程 |
| **推荐结果页** | 三段式推荐理由（核心优势 + 注意事项 + 数据依据）、数据溯源 Source |
| **GIS 地图** | Brand SVG Marker + Glass Popup + 卡片↔地图双向联动 + Marker Pulse |
| **品牌设计** | Apple Glass 质感（Noise + Edge Highlight + Reflection）、Mouse Parallax |
| **UX 引擎** | View Transition、Magnetic Button、Skeleton Loading、Blur-Up、Page Progress |
| **响应式** | 6 断点（1440/1280/1024/768/430/390）+ Safe Area + Touch-friendly |
| **无障碍** | prefers-reduced-motion、focus-visible、forced-colors、keyboard nav |

## 开发进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| Task 0~2 | 项目初始化 + FastAPI + 环境 | ✅ |
| Task 3~5 | 数据库 + API + AI 推荐引擎 | ✅ |
| Task 6~8 | 前端三页面（首页/问卷/结果） | ✅ |
| Sprint 1 | 代码审查 + Bug 修复 | ✅ |
| Sprint 2 | 产品打磨（动画/可信标识/重构） | ✅ |
| Sprint 3 | GIS 地图可视化（Leaflet + GeoJSON） | ✅ |
| Sprint 4 | 首页 AI 产品感增强 | ✅ |
| Sprint 5A | 数据仓库建设（7 维度 × 12 目的地） | ✅ |
| Sprint 5B | 真实数据接入 + 全链路验收 → v1.0 RC | ✅ |
| Sprint 6 P1 | UI/UX 升级：模块化重构 + Hero + Nav + Glass | ✅ |
| Sprint 6 P2 | Brand Identity：Design Guideline v1.0 | ✅ |
| Sprint 6 P3 | UI 重构：P0 视觉优化（Glass/Parallax/字体/Marker/Overlay/Icons） | ✅ |
| Sprint 6 P4 | Brand Experience & Premium UX | ✅ |
| Sprint 7 Act 1 | 首页体验重构：章节系统 + Hero CTA + 5 章节日式架构 | ✅ |
| Sprint 7 Act 2 | World Explorer：5 层交互地球探索空间 + 轨道 Portal + 鼠标物理引擎 | ✅ |
| Sprint 7 Act 3~6 | Earth Journey / Deep Story / AI Ending | 📋 |

> 📊 品牌设计规范：[DESIGN_GUIDELINE.md](DESIGN_GUIDELINE.md)
>
> 📝 完整开发过程见：[docs/开发日志.md](docs/开发日志.md)

## 开发团队

- 陈鸿岚、娄金麟、王奕飞、谢和隽
- 指导教师：卢松 教授
- 上海师范大学 环境与地理科学学院
