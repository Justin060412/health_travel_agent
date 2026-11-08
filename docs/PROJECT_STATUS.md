# AI 康养旅居智能规划平台 — 项目状态

更新时间：2026-11-08

## 项目概况

- 当前版本：M11 iPhone App / 发布收口 v0.1 + GitHub Pages 静态展示
- 当前阶段：M11.0 SwiftUI 原生基础；GitHub Pages 已公开发布
- 下一阶段：iOS 模拟器验收；继续区分静态前端展示与后端服务发布
- 当前唯一项目路径：`/Users/juxtin/Documents/Codex/aipro/health- travel-aipro/health_travel_agent`

## 产品结构

### Act1：首页品牌入口

状态：已完成。

### Act2：AI 康养旅居数字探索

状态：核心体验已完成；Safari/Chrome 多视口人工回归仍为非阻塞项。

- Three.js 地球、12 个目的地、自动探索与 Fly-To
- 图片故事面板、上一站/下一站
- 当前地点进入定向 AI 分析
- API 优先、GeoJSON fallback、内容按名称校验合并
- 本地 Three 资源与图片 fallback 已补

### Act3：目的地深度体验

状态：12 目的地内容系统已接入；来源深度持续完善。

已完成：

- 大理深度叙事页面基础链路
- `destination-details-v2` 数据契约
- 事实、来源、证据、缺失与有效期状态
- 大理气候、年度空气环境、森林、海拔和医疗官方资料
- 8 条高德复核 POI，保留 GCJ-02/WGS84 与 OSM 次级来源
- 4 段高德步行道路路线、距离、时间和道路几何
- Act3 → questionnaire 传递同一事实与证据上下文
- 12 个目的地统一深度内容结构、稳定键与名称优先匹配
- 日常生活、季节、预算、适合条件、注意事项和缺失字段
- 11 个目的地开放许可实景图可追溯；苏马荡明确待补精确授权图

待完成：

- 商家或授权价格快照
- 现场坡度、台阶与轮椅通行核验
- Safari/Chrome 人工全链路记录
- 其余 11 地专项气候、医疗、价格和 POI 来源深化
- 苏马荡精确授权实景图

### Act4：AI 康养决策中心

状态：M3 PPT 式结果报告功能开发完成；人工多视口验收待补。

- 首屏最佳匹配，连续展示前 5 个推荐和最终比较页
- 键盘、触摸、自然过渡和 `prefers-reduced-motion`
- 本地 OpenLayers 常驻地图，随当前目的地平滑切换
- Act2 关注地点真实排名与直接跳转
- 每个推荐目的地可携带上下文进入康养线路入口
- 大理推荐可进入真实 M5 OpenLayers 路线工作台
- 空状态、加载状态和报告状态严格互斥，不再出现“先告诉 AI”叠在报告后方
- 结果页取消风景图展示，OpenLayers 常驻地图改为融合式空间背景
- 图片数据仍保留给 Act2 与 Act3，不影响目的地旅行叙事

### Act5：康养线路工作台

状态：大理二维手动路线、AI 引导规划、可审计 POI、三维空间概览和 M9 版本化保存均已完成；人工体验验收待补。

- 本地 OpenLayers 地图加载真实大理 POI 与高德道路快照
- 地图加点、搜索加点、地图拖动、列表拖动排序、删除和锁定节点
- 增加天数、按天查看、节点调整所属天数
- 步行/驾车道路重算；高德失败时以明确虚线显示非导航预览
- 距离、预计时间、活动强度和价格缺口同步计算
- WGS84 编辑、GCJ-02 供应商请求与 WGS84 渲染边界明确
- 撤销/重做、本地草稿保存恢复和统一 GeoJSON 输出
- 8 步 AI 引导覆盖天数、康养目标、活动上限、身体限制、医疗位置、预算、饮食、住宿、交通与节奏
- 生成前必须确认结构化需求卡；外部 DeepSeek 必须另行明示同意
- 未授权外部 AI 时使用本地可审计规则，手动路线能力始终保留
- DeepSeek 和本地规则都只能选择真实 POI；AI 不计算道路距离或补全价格
- 支持只改某一天、替换住宿/餐饮/活动、减少步行、调整预算和保留锁定节点
- 修改后复用 M5 高德道路重算，并显示修改前后距离、时间和预算缺口
- 公交仍明确标记为后续；独立三维空间概览已在 M8 接入
- POI 改为 `GET /api/destinations/{destination_key}/pois` 优先，本地快照在后端不可用时降级
- POI 查询支持分类、名称/地址搜索和核验状态过滤，单点详情暴露来源、有效期和缺失字段
- 授权价格使用独立快照契约；当前没有合规记录，因此所有金额继续为空而非 AI 推测
- 节点详情展示营业时间、停留建议、强度、无障碍、当前需求理由、下一段道路和数据日期
- OpenLayers 与 Three.js 读取同一 `route-plan` 模型，不保存第二份三维业务状态
- 二维编辑、AI 改线和道路重算立即同步三维；三维节点选择反向同步二维列表和详情
- 支持按当前天查看与克制的节点顺序播放，住宿/餐饮/活动/医疗使用分类色
- 没有高程来源时明确采用平面空间概览，不显示坡度或虚假地形
- 显式保存优先写入 SQLite；首次创建 v1，后续保存递增版本并保留历史
- 每条路线使用独立访问令牌，数据库只保存令牌哈希，不提供公开路线列表
- `expected_version` 防止旧页面覆盖新版本；后端不可用或冲突时保留本机草稿并如实提示

### M10：可信证据与 RAG

状态：功能阶段完成；12 地均可检索，资料深度按有效期持续维护。

- 规范化来源文档登记，强制来源、授权、核验时间、有效期和适用目的地
- SQLite `source_documents`、`evidence_chunks` 与 FTS5 关键词索引
- Qdrant 本地持久化向量数据库，`BAAI/bge-small-zh-v1.5` 512 维中文嵌入
- 目的地、主题、发布机构和有效期过滤，RRF 融合关键词与语义向量
- 检索返回原始来源链接、证据段落、状态、通道和置信度
- 默认本地证据回答；外部 DeepSeek 必须明示授权且引用必须通过校验
- 无证据、过期、冲突或未授权资料一律拒答，不补写旅游或医疗结论
- Act3 提供可信依据工作台，PPT 结果页为每个推荐地点提供证据抽屉
- 前端证据追问固定使用本地 RAG，不把健康问题发送给外部 AI
- 当前 26 份来源文档、55 个分块、覆盖 12 个目的地
- 29 条来源命中与拒答评测全部通过；旧医疗资料明确标记为参考并提示复核

### M11：iPhone App 与发布收口

状态：M11.0 开发中。

GitHub 静态展示：仓库已公开，Pages 来源为 GitHub Actions；工作流重跑成功并发布 `frontend/`。公开 URL 为 `https://justin060412.github.io/health_travel_agent/`，首页和主要 CSS/JS、Three.js/OpenLayers、本地目的地 GeoJSON、详情与路线页面均返回 HTTP 200。静态页不托管 FastAPI，因此 AI、在线 POI/道路、个性化结果、路线保存和 RAG 不可在线运行。

- 采用 SwiftUI 原生主应用，不做纯 WebView 套壳
- 原生接入目的地列表、详情、MapKit 地图、本机收藏和服务状态
- Three.js 地球保留为可选沉浸式子体验
- Xcode 26.6 / Swift 6.3.3 开发环境已确认
- iOS Simulator SDK 编译与 App Bundle 构建成功
- 待安装 iOS 26.5 Simulator Runtime，随后完成视觉验收、真机签名、正式 HTTPS、隐私政策和 TestFlight

## 数据架构

```text
/api/destinations
  ↓ 失败时
destinations.geojson
  ↓ 名称校验与内容合并
destination-content.json
  ↓ Act3 深度事实
destination-details.json (V2 contract)
  + 12 destinations (Dali verified sample + 11 reference-only)
  + dali-poi.json (Amap primary + OSM secondary)
  + dali-route.json (Amap walking route snapshot)
  ↓ M5 路线编辑
/api/routes/plan (server-side Amap key, walking/driving)
  + OpenLayers EPSG:3857 render
  + WGS84 route draft / GeoJSON
  ↓ M6 AI 选点与修改
/api/routes/ai/plan + /api/routes/ai/revise
  + explicit external-AI consent
  + DeepSeek constrained selection / local rule fallback
  + traceable POI IDs only
  ↓ M7 数据服务
/api/destinations/{destination_key}/pois
  + provider POI ID / source / verification / validity
  + poi-price-snapshots.json (authorized records only; currently empty)
  + API-first frontend / local verified snapshot fallback
  ↓ M8 共用路线模型
route-plan.schema.json
  + OpenLayers precise editing
  + Three.js spatial overview
  + shared active day / selected node / route geometry
  + elevation.status=unavailable until verified data exists
  ↓ M9 版本化持久化
/api/routes + /api/routes/{id} + /api/routes/{id}/versions
  + route_plans / route_versions / route_nodes / user_constraints
  + per-route token hash / optimistic version check
  + local draft fallback without silent overwrite
  ↓ M10 可信证据检索
SQLite source_documents + evidence_chunks + FTS5
  + Qdrant health_travel_evidence_v1
  + BAAI/bge-small-zh-v1.5 (512 dimensions)
  + RRF hybrid retrieval / metadata filters / citation validation
  ↓
analysis_evidence + questionnaire context
```

关键原则：

- `destination_key` 和标准名称承担跨来源稳定匹配；数字 ID 仅作运行上下文。
- 政府/机构来源证明环境和医疗事实；地图平台只证明空间事实。
- 价格、实时 AQI、道路时间缺失时保持 `null`，AI 不得自行补全。
- 高德是国内 POI/道路首选供应商，但 Key 必须由后端持有。

## 本轮新增关键文件

- `docs/DATA_CONTRACT.md`
- `schemas/destination-details.schema.json`
- `schemas/analysis-evidence.schema.json`
- `schemas/poi.schema.json`
- `scripts/validate_data_contract.py`
- `scripts/build_dali_m2_snapshot.py`
- `frontend/data/dali-poi.json`
- `frontend/data/dali-route.json`
- `schemas/route-snapshot.schema.json`
- `backend/gis/amap.py`
- `tests/test_m1_data_contract.py`
- `tests/test_m2_dali_sample.py`
- `frontend/js/results-deck.js`
- `frontend/css/results-deck.css`
- `frontend/vendor/ol.js`
- `frontend/vendor/ol.css`
- `frontend/route-planner.html`
- `frontend/js/route-planner.js`
- `frontend/css/route-planner.css`
- `tests/test_m5_route_api.py`
- `tests/test_m5_route_workspace.py`
- `backend/route_engine/ai_planner.py`
- `frontend/js/route-ai.js`
- `tests/test_m6_route_ai.py`
- `tests/test_m6_route_ai_workspace.py`
- `backend/gis/poi_repository.py`
- `schemas/price-snapshot.schema.json`
- `frontend/data/poi-price-snapshots.json`
- `tests/test_m7_poi_data_system.py`
- `tests/test_m7_poi_workspace.py`
- `frontend/js/route-3d.js`
- `schemas/route-plan.schema.json`
- `tests/test_m8_route_3d_sync.py`
- `backend/route_engine/route_repository.py`
- `scripts/migrate_m9_route_storage.py`
- `tests/test_m9_route_storage.py`
- `tests/test_m9_route_workspace.py`
- `backend/retrieval/`
- `schemas/source-document.schema.json`
- `data/evidence/source-documents.json`
- `data/evidence/retrieval-evaluation.json`
- `scripts/build_m10_evidence_index.py`
- `scripts/evaluate_m10_retrieval.py`
- `scripts/migrate_m10_evidence_storage.py`
- `tests/test_m10_rag_system.py`
- `docs/M10_RAG_ARCHITECTURE.md`
- `scripts/build_m4_destination_details.py`
- `tests/test_m3_results_deck.py`
- `tests/test_m4_destination_details.py`

## 验证命令

```bash
python3 scripts/validate_data_contract.py
python3 scripts/validate_data_contract.py --require-dali-sample
python3 scripts/validate_data_contract.py --require-dali-complete
python3 scripts/validate_data_contract.py --require-all-destinations
venv/bin/python -m unittest discover -s tests -v
node tests/test_frontend_data_layer.mjs
```

基础、M2 样板和 M4 全量校验应通过；当前 Python 测试为 113 项通过、1 项真实推荐 AI 测试按规则跳过。M10 检索评测 29/29 通过；26 份文档和 55 个分块覆盖 12 个目的地，较旧资料仍按参考状态展示。

## 下一次启动入口

1. 阅读 `docs/AI_CONTEXT.md`、本文件、`docs/开发日志.md` 最新记录和 `docs/完整产品开发路线图.md`。
2. 运行 `git status`，保护所有未提交和未跟踪工作。
3. 为 Act3/结果报告设计克制的“查看依据/继续追问”入口，不把证据做成新技术展示页。
4. 逐地扩充其余 11 个目的地的政府、医院与交通证据，并同步增加正例与拒答评测。
5. 生产部署前把 Qdrant 从本地模式迁移为带认证、备份和监控的独立服务。
