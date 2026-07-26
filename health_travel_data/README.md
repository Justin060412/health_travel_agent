# 中国康养旅居目的地数据仓库

## Health Travel Destination Data Repository

---

## 一、项目概述

本数据仓库为 **AI 康养旅居助手** 项目提供高质量、可追溯的公开数据支撑。

收录中国 12 个优质康养旅居目的地的多维数据，包括地理信息、气候环境、空气质量、
森林覆盖、医疗资源等维度。

### 研究课题

> 苏马荡山地候鸟式康养旅居供需匹配研究
>
> 上海师范大学 环境与地理科学学院

---

## 二、目录结构

```
health_travel_data/
├── raw/                        # 原始采集数据（按维度分目录）
│   ├── geography/              #   地理坐标、海拔、行政区划
│   ├── weather/                #   气候类型、气温范围
│   ├── air_quality/            #   空气质量指数、等级
│   ├── forest/                 #   森林覆盖率
│   ├── medical/                #   医疗资源评级
│   └── images/                 #   图片链接
├── processed/                  # 清洗合并后的中间数据
├── geojson/                    # 最终 GeoJSON 输出（Leaflet 兼容）
├── sqlite/                     # 最终 SQLite 数据库
├── json/                       # 最终 JSON 数据
├── scripts/                    # 采集与处理脚本（可重复运行）
├── logs/                       # 运行日志
└── README.md                   # 本文件
```

---

## 三、数据来源

| 维度 | 来源 | 获取方式 | 可靠性 |
|------|------|----------|--------|
| 坐标、行政区划 | OpenStreetMap Nominatim API | HTTP GET | ★★★★★ |
| 海拔 | OSM / GeoNames | HTTP GET | ★★★★★ |
| 气候类型 | 中国气象局公开数据 / Wikipedia 交叉验证 | 编译汇总 | ★★★★ |
| 气温范围 | 中国天气网 / 地方气象局年报 | 编译汇总 | ★★★★ |
| 空气质量 | 中国环境监测总站 / 地方生态环境局年报 | 编译汇总 | ★★★★ |
| 森林覆盖率 | 国家林业和草原局 / 地方林业局公报 | 编译汇总 | ★★★★ |
| 医疗资源 | 国家卫健委医院等级公开信息 | 编译汇总 | ★★★★ |
| 描述文本 | Wikipedia（经官方数据交叉验证） | HTTP GET | ★★★ |
| 图片链接 | Wikipedia Commons | HTTP GET | ★★★ |

> **注：** Wikipedia 仅用于描述文本和图片链接，不作为主要业务数据来源。
> 所有数据均保留 `source` 字段以追溯来源。

---

## 四、数据采集流水线

```
collect_locations.py      # 地理坐标、海拔、行政区划
collect_weather.py        # 气候类型、气温范围
collect_air_quality.py    # 空气质量
collect_forest.py         # 森林覆盖率
collect_medical.py        # 医疗水平评级
        │
        ▼
merge_all_data.py         # 合并 → JSON + GeoJSON + SQLite
        │
        ▼
quality_check.py          # 数据质量检查 → quality_report.json
        │
        ▼
build_database.py         # 同步到项目数据库（UPSERT）
```

### 一键运行

```bash
cd D:\health_travel_data\scripts
python update_all.py
```

---

## 五、数据字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 唯一标识 | 1 |
| name | TEXT | 目的地名称 | 巴马瑶族自治县 |
| province | TEXT | 省份 | 广西壮族自治区 |
| city | TEXT | 城市 | 河池市 |
| latitude | REAL | 纬度（WGS84） | 24.14 |
| longitude | REAL | 经度（WGS84） | 107.25 |
| altitude | INTEGER | 海拔（米） | 600 |
| average_temperature | TEXT | 年平均气温 | 20.5℃ |
| summer_temperature | TEXT | 夏季气温范围 | 22–30℃ |
| winter_temperature | TEXT | 冬季气温范围 | 10–18℃ |
| air_quality | TEXT | 空气质量等级 | 优 |
| air_quality_index | INTEGER | 空气质量指数 | 35 |
| forest_coverage | TEXT | 森林覆盖率 | 78.4% |
| medical_level | TEXT | 医疗水平评级 | 二级甲等 |
| budget_level | TEXT | 预算等级 | 经济型 |
| monthly_cost_low | INTEGER | 月消费下限（元） | 1500 |
| monthly_cost_high | INTEGER | 月消费上限（元） | 4000 |
| suitable_people | TEXT | 适合人群 | 中老年养生人群… |
| features | TEXT | 特色标签（JSON数组） | ["长寿之乡",…] |
| description | TEXT | 描述文本 | … |
| image_url | TEXT | 图片链接 | https://… |
| source | TEXT | 数据来源 | OSM / 广西统计年鉴2023 |
| score | REAL | 综合评分（1–5） | 4.7 |

---

## 六、输出文件

| 文件 | 路径 | 用途 |
|------|------|------|
| destinations.json | `json/destinations.json` | 通用 JSON 数据 |
| destinations.geojson | `geojson/destinations.geojson` | Leaflet / GIS 可视化 |
| destinations.sqlite | `sqlite/destinations.sqlite` | 结构化查询 |
| quality_report.json | `logs/quality_report.json` | 数据质量报告 |
| dataset_statistics.json | `logs/dataset_statistics.json` | 数据集统计摘要 |
| data_sources.md | `logs/data_sources.md` | 数据来源文档 |

---

## 七、更新方式

```bash
# 全量更新
python update_all.py

# 单独采集某项
python collect_locations.py
python collect_weather.py

# 仅重新合并
python merge_all_data.py

# 仅质量检查
python quality_check.py

# 仅同步项目数据库
python build_database.py
```

所有脚本支持重复运行。采集脚本优先读取 `raw/` 缓存，避免重复请求。

---

## 八、工程特性

- ✅ 模块化采集脚本，独立可运行
- ✅ 断点续跑（raw/ 缓存机制）
- ✅ 自动重试（Retry + 指数退避）
- ✅ 请求频率控制（Sleep）
- ✅ 请求超时保护（Timeout）
- ✅ 异常隔离（单源失败不影响整体）
- ✅ 数据溯源（source 字段）
- ✅ 质量检查（quality_check.py）
- ✅ UPSERT 同步（不重建数据库）

---

## 九、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-07-07 | Pilot 版本，巴马瑶族自治县试点采集 |
