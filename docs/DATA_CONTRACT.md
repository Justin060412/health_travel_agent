# 目的地数据契约 V2

> 契约版本：2.0.0
> 生效日期：2026-08-17
> 适用范围：Act2、Act3、AI 推荐证据、OpenLayers 与后续路线规划

## 1. 数据职责

| 数据层 | 负责 | 不负责 |
|---|---|---|
| `/api/destinations` | 运行时 ID、标准名称、基础预算、基础环境字段 | 深度故事、外部 POI、长文证据 |
| `destinations.geojson` | WGS84 目的地坐标、API 缺失字段的静态补充 | 实时数据、商家价格、医疗能力结论 |
| `destination-content.json` | 图片、故事、标签、许可与文字来源 | 数值事实和路线事实 |
| `destination-details.json` | Act3 深度内容、版本化事实、来源、核验状态和分析证据 | 实时天气、实时价格和道路计算 |
| `*-poi.json` | POI 候选、原始供应商 ID、坐标系、采集与核验状态 | AI 自行创造的地点或价格 |
| `*-route.json` | 供应商道路路线、距离、时间、步骤和几何快照 | 实时交通承诺、现场无障碍结论 |

业务代码只能消费标准化结构。跨来源匹配使用 `name` 校验和 `destination_key`，数字 ID 只作为当前运行上下文。

## 2. 稳定键

- `destination_key`：平台稳定键，格式建议为 `cn-省-城市-地点` 的小写 ASCII slug。
- `name`：面向用户的标准中文名，也是当前跨旧数据源的校验键。
- `id`：允许因 API、GeoJSON 和内容文件而不同，不得单独用于跨来源合并。

## 3. 字段状态

所有决策事实必须使用以下状态之一：

- `verified`：来源、范围和核验日期明确。
- `verified_with_gaps`：主体已核验，但仍有明确缺口。
- `reference_only`：可作背景参考，不能作为确定结论。
- `pending`：已有字段位置，但尚未完成核验。
- `stale`：超过有效期，不继续作为当前结论。
- `conflict`：存在未解决的多来源冲突。
- `unknown`：目前没有可靠数据。

`pending`、`stale`、`conflict` 和 `unknown` 不得由 AI 自动补值。

## 4. 来源等级

从高到低定义为：

1. `government`：政府、气象、生态环境、卫健等官方来源。
2. `institution`：医院、科研机构、行业组织官方资料。
3. `academic`：可识别作者与出版信息的研究资料。
4. `map_provider`：高德、OpenStreetMap 等位置与路线供应商。
5. `merchant`：商家或授权预订渠道公开信息。
6. `editorial`：平台编辑整理，只能解释，不能单独证明高风险事实。

医疗等级优先使用政府或医院来源；地图平台只证明名称、位置、地址等空间事实。价格必须记录观察时间，动态价格不得表达为成交承诺。

## 5. 来源最小字段

每条来源至少包含：

- `source_id`
- `title`
- `publisher`
- `source_level`
- `url`
- `scope`
- `collected_at`
- `verified_at`
- `valid_until`
- `verification_status`
- `license_scope`

不知道发布时间时允许 `published_at` 为 `null`，但不能省略核验时间和适用范围。

## 6. 决策事实

`facts` 内每个事实必须包含：

- `value`，或在范围型事实中使用 `value_low`/`value_high`
- `unit`
- `scope`
- `status`
- `source_ids`
- `observed_at`
- `verified_at`
- `valid_until`
- `notes`

区域级数据必须在 `scope` 中注明，不能把“大理州空气质量”伪装成“大理古城实时 AQI”。

## 7. 冲突与缺失规则

1. 同一范围、同一时间口径优先采用更高等级和更新的来源。
2. 不同空间范围的数据同时保留，并在 UI 中标注范围，不强行合并。
3. 无法解释的冲突标记 `conflict`，停止用于 AI 确定性结论。
4. 缺失值保留 `null` 和缺失原因，不使用“行业常识”补齐。
5. 过期事实标记 `stale`，只能作为历史参考。

## 8. 分析证据

每条 AI/规则结论使用 `analysis_evidence` 记录：

- `evidence_id`
- `dimension`
- `conclusion`
- `destination_fields`
- `profile_fields`
- `source_ids`
- `verified_at`
- `confidence`
- `missing_data`
- `rule_version`

证据只引用当前目的地已存在的来源 ID。`confidence` 仅允许 `high`、`medium`、`low`。

## 9. GIS/POI 供应商协议

首个国内实现优先采用高德 Web 服务；业务层不得直接依赖高德响应 JSON。统一 POI 至少保留：

- 平台 `id` 与 `destination_key`
- `provider`、`provider_poi_id`
- `coordinate_system`
- 原始与 WGS84 坐标（转换发生时）
- `fetched_at`、`verified_at`、`verification_status`
- `license_scope`
- `source_url`、`source_publisher`

高德 Key 只能由后端读取，不能写入前端。没有 Key 时可以录入官方/OSM 候选，但必须标记供应商和待高德复核状态。

## 10. 自动校验

运行：

```bash
python3 scripts/validate_data_contract.py
python3 scripts/validate_data_contract.py --require-dali-sample
python3 scripts/validate_data_contract.py --require-dali-complete
python3 scripts/validate_data_contract.py --require-all-destinations
python3 scripts/build_dali_m2_snapshot.py  # 需要后端 AMAP_API_KEY
```

第一条是 M1 契约校验；第二条验证 M2 大理样板的结构、事实和 POI 候选是否齐备；第三条是 M2 最终验收门槛，还要求道路路线、带观察时间的授权价格、高德复核和人工全链路记录。任何错误均返回非零退出码。
