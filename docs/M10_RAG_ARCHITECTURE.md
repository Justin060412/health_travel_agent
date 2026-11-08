# M10 RAG 与向量数据库架构

更新时间：2026-08-20
状态：M10.1/M10.2 已实现；12 个目的地均有最小可信覆盖，资料深度与时效继续维护。

## 1. 产品边界

RAG 只处理政府报告、医院能力说明、交通政策、研究资料和规划文档等非结构化证据。经纬度、AQI 数值、路线距离、价格快照、POI 和用户路线版本继续由结构化数据库与 GIS 服务负责。任何没有授权、来源链接、核验时间和适用范围的文字不得进入向量索引。

## 2. 借鉴的开源项目

- [RAGFlow](https://github.com/infiniflow/ragflow)：借鉴规范化文档、分块、混合检索和元数据过滤思想；本项目没有引入其完整平台和复杂部署。
- [Qdrant](https://github.com/qdrant/qdrant)：采用 payload 元数据过滤、持久化向量集合和未来服务化迁移能力。
- [Qdrant Python Client](https://github.com/qdrant/qdrant-client)：开发阶段使用本地持久化模式，同一适配器未来可以切换独立 Qdrant 服务。
- [FastEmbed](https://github.com/qdrant/fastembed)：使用 `BAAI/bge-small-zh-v1.5` 生成 512 维中文语义向量。
- [Haystack](https://github.com/deepset-ai/haystack)：借鉴多路召回后使用 Reciprocal Rank Fusion 合并的做法；当前规模没有引入框架本身。
- [sqlite-vec](https://github.com/asg017/sqlite-vec)：完成评估但未采用。当前版本仍处于快速演进阶段，且复杂元数据预过滤存在限制；业务 SQLite 继续负责文档登记与 FTS5，向量交给 Qdrant。

## 3. 运行架构

```text
授权来源登记 JSON
  ↓ 契约、许可、状态检查
canonical source document
  ↓ 按标题和语义完整段落分块
SQLite source_documents + evidence_chunks
  ├─ FTS5 中文词项/双字词召回
  └─ Qdrant 512维 BGE 中文语义向量
          ↓
      RRF 混合排序
          ↓
目的地 / 主题 / 发布机构 / 有效期过滤
          ↓
证据段落 + 来源链接 + 核验状态
          ↓
本地提取回答或经用户明示授权的 DeepSeek 回答
          ↓
引用 ID 校验；无证据则拒答
```

## 4. 存储职责

SQLite schema v2：

- `source_documents`：来源、发布机构、授权、核验日期、有效期、主题和规范化原文登记。
- `evidence_chunks`：稳定分块、内容哈希、embedding provider 和 Qdrant point ID。
- `evidence_chunks_fts`：中文词项和双字词关键词检索。

Qdrant collection：`health_travel_evidence_v1`

- 向量：`BAAI/bge-small-zh-v1.5`，512 维 cosine。
- payload：`chunk_id`、`source_id`、`destination_key`、`publisher`、`topics`、状态与有效期。
- 本地目录：`data/qdrant/`，属于运行时索引，不提交 Git。

## 5. API

- `GET /api/evidence/status`：文档、分块、目的地覆盖和向量库状态。
- `POST /api/evidence/search`：返回混合检索证据段落和可点击来源。
- `POST /api/evidence/answer`：先检索后回答；默认本地，只有 `allow_external_ai=true` 才使用外部 AI。

所有响应区分 `grounded` 与 `insufficient_evidence`，并返回检索通道、embedding provider、缺失数据和索引状态。

前端产品入口：

- Act3 深度页提供“可信依据”工作台、常见问题和本地追问。
- PPT 结果页每个推荐目的地提供可关闭的证据抽屉。
- `frontend/js/api.js` 统一封装状态、检索和回答；浏览器请求固定 `allow_external_ai=false`。
- 引用显示原文段落、发布机构、核验时间和可点击原始页面；无证据时显示拒答而非空卡。

## 6. 安全与可信规则

1. `stale`、`conflict`、未授权来源不进入有效检索结果。
2. 来源内容作为不可信数据传给 LLM，禁止执行文档内指令。
3. LLM 只能引用当前命中的证据 ID；引用不合法即降级本地提取回答。
4. 外部 AI 需要每次请求明确授权；默认不发送用户问题。
5. 医疗证据只能说明公开能力和资料边界，不生成诊断或疗效。
6. Qdrant 不可用时可以如实降级关键词检索，但响应必须给出 `degraded_reason`。

## 7. 当前覆盖与维护边界

当前索引：26 份文档、55 个分块、覆盖全部 12 个目的地。大理有 4 份环境、生态和医院资料；其余 11 地各有 2 份目的地/环境背景与医疗可及性资料。较旧页面统一标记为 `reference_only`，回答中必须同时呈现时效和适用边界。

29 条评测全部通过，覆盖 26 条来源命中、无关问题拒答和提示注入拒答；专项测试还验证 `stale`、`conflict` 文档不能进入索引。语料覆盖代表“每个目的地可以查证”，不代表医疗、交通、价格或实时环境已经完整。

持续维护项：

- 按有效期复核历史医疗资料，并优先替换为更新的卫健委/医院官方页面。
- 继续补充交通政策、专项环境公报和康养研究，不使用旅游软文或 AI 生成内容填充。
- 生产部署改为独立 Qdrant 服务并配置认证、备份和监控；本地模式只用于开发与单机演示。
