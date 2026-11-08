# AI 康养旅居智能规划平台

> **AI + GIS + 康养决策体验**：从目的地探索、个人适配分析，到可编辑的康养旅居路线。
>
> 项目源自上海师范大学环境与地理科学学院大学生创新项目。当前处于产品原型与 iPhone 原生 App 开发阶段，**不是线上运营服务，也不提供医疗建议**。

## 在线浏览

启用 GitHub Pages 后，访客可通过下面的链接直接浏览前端页面：

**[打开网页预览](https://justin060412.github.io/health_travel_agent/)**

这是一份 GitHub Pages 静态预览：Act1/Act2 的首页与目的地探索、静态目的地资料和页面视觉可浏览；FastAPI、AI 分析、个性化结果、在线 POI/道路服务和路线保存需要后端，**不会在 GitHub Pages 上运行**。页面会显示静态预览提示。GitHub Pages 不支持运行 Python/FastAPI 服务。

仓库当前为私有；Pages 能否从私有仓库发布取决于 GitHub 套餐。发布网页不要求把源代码仓库改为公开。

## 你可以在产品中看到什么

### 目的地探索

- Three.js 数字地球与 12 个康养旅居目的地
- 自动探索、地点选择、Fly-To、上一站/下一站
- 图片、地点故事、康养标签、最佳季节和适合人群
- API 优先、GeoJSON 静态资料兜底的数据结构

### 目的地深度体验

- 以大理为首个深度样板，介绍季节、生活节奏、环境、医疗与预算
- 事实和证据按来源、核验时间与缺失状态组织
- 其余目的地的资料深度不完全相同；参考资料不会伪装成已核验结论

### AI 康养决策报告

- 多步健康与旅居偏好问卷
- PPT 式连续推荐报告，首屏展示匹配度最高的目的地
- OpenLayers 地图与证据入口
- 个性化推荐、证据检索依赖后端 API，静态网页不能生成真实个人分析

### 康养线路工作台

- OpenLayers 二维路线编辑与 Three.js 空间概览
- POI 节点、路线调整、AI 引导规划和数据来源说明
- POI/道路、AI 规划与版本化保存依赖 FastAPI 和配置好的服务
- 价格或高程资料缺失时保持空缺，不由 AI 猜测

## 浏览路径

1. 打开网页预览，选择“开始探索”进入 Act2。
2. 探索目的地故事；本地静态数据可在无后端情况下提供目的地浏览。
3. 继续打开“目的地深度体验”“AI 分析”“推荐报告”和“线路工作台”页面，查看各模块的界面与产品流程。
4. AI 结果、在线路线服务、保存等功能需要服务端；静态预览中的这些入口仅展示前端，不会返回真实计算结果。

## 产品路线与开发记录

- [完整产品开发路线图](docs/完整产品开发路线图.md) — M0–M11 阶段、验收标准与当前路线
- [开发日志](docs/开发日志.md) — 每阶段完成内容、测试结果和后续建议
- [当前项目状态](docs/PROJECT_STATUS.md)
- [产品宪章与 AI 接手说明](docs/AI_CONTEXT.md)
- [数据契约](docs/DATA_CONTRACT.md)
- [M10 RAG 架构](docs/M10_RAG_ARCHITECTURE.md)
- [iPhone App 计划](docs/IOS_APP_PLAN.md)

## 技术架构

| 层 | 技术 | 职责 |
|---|---|---|
| Web 前端 | HTML、CSS、原生 JavaScript | Act1–Act5 产品页面 |
| 地球 / 空间预览 | Three.js | Act2 地球与路线空间概览 |
| 二维地图 | OpenLayers | 推荐结果地图与路线编辑 |
| API | Python FastAPI | 目的地、推荐、POI、路线、证据接口 |
| 结构化存储 | SQLite | 目的地、路线版本、来源与证据元数据 |
| 证据检索 | SQLite FTS5 + Qdrant + BGE | 有来源约束的混合检索与引用 |
| iPhone 原生端 | SwiftUI + MapKit | 原生目的地浏览与地图体验 |

## 本地运行完整版本

完整体验需在本地配置后端与环境变量。请勿把 `.env`、API Key、数据库或访问令牌提交到 GitHub。

```bash
cp .env.example .env
# 在本地 .env 配置所需服务密钥
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

另开终端：

```bash
cd frontend
python3 -m http.server 5500 --bind 127.0.0.1
```

访问 `http://127.0.0.1:5500/index.html`。AI 与地图服务仍需配置有效凭据和可用网络。

## GitHub Pages 发布说明

仓库包含 `.github/workflows/deploy-pages.yml`：将 `frontend/` 发布为静态站点，不包含 `backend/`、数据库、`.env` 或密钥。启用后，推送到 `main` 会触发 Pages 部署。

如果首次部署未启动，请在仓库 **Settings → Pages** 将 Build and deployment 的 Source 设为 **GitHub Actions**，并确认当前套餐允许私有仓库发布 Pages。网页访问权限应设为公开，源代码仓库仍可保持私有。工作流状态可在 **Actions → Deploy GitHub Pages** 查看。

### 静态预览边界

- 可浏览：目的地探索与静态数据、各页面结构、静态地图/路线资料（取决于相应页面是否需要服务端初始化）。
- 不可用：AI 问卷分析、个性化推荐、在线 POI/道路请求、AI 路线生成、后端持久化、RAG 在线检索。
- 不收集健康问卷，不请求外部 AI；静态预览不会把缺少后端包装成“AI 已完成”。
- GitHub Pages 的网络可达性取决于访问者所在地区与网络环境。

## 当前开发阶段

- 产品主线：M11.0 iPhone 原生基础与发布收口。
- M0–M10：核心功能阶段已完成；浏览器多视口人工验收与数据持续维护仍在进行。
- iPhone App：SwiftUI 基础与目的地浏览已构建；模拟器视觉验收、原生决策闭环、正式 HTTPS、签名和 TestFlight 未完成。
- GitHub Pages：本工作流用于只读前端展示，不代表后端产品已发布。

## 许可与数据

目的地事实、图片、地图 POI 和证据材料遵循各自来源和使用许可。地图 POI 不等于价格、医疗能力或康养效果证明；数据缺失时明确标注，不以 AI 推测填补。
