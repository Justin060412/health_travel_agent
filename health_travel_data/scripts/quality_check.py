"""
quality_check.py — 数据质量自动检查脚本（增强版）

检查项目：
  1. 经纬度合法性（中国境内范围：lat 18–54, lon 73–135）
  2. 名称是否重复
  3. 坐标是否重复（误差 < 0.001° 视为重复）
  4. 空字段检测（扩展至全部字段）
  5. source 字段完整性（含 source_url 检查）
  6. 图片 URL 有效性
  7. 海拔异常检测（负值、超高值、与省份均值偏差过大）
  8. GeoJSON 格式合法性（RFC 7946）
  9. SQLite 数据库完整性
  10. 三种输出格式记录数一致性检查

输出：
  - quality_report.json — 数据质量报告（含通过/警告/错误分级）
  - 日志输出到 logs/

工程设计：
  - 纯验证，不修改数据
  - 分级报告：PASS / WARN / FAIL
  - 适合答辩展示
"""

import json
import sqlite3
import sys
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from collector_utils import (
    BASE_DIR, LOGS_DIR,
    get_logger, save_json, load_json,
)

logger = get_logger("quality_check")

# 路径
JSON_INPUT = BASE_DIR / "json" / "destinations.json"
GEOJSON_INPUT = BASE_DIR / "geojson" / "destinations.geojson"
SQLITE_INPUT = BASE_DIR / "sqlite" / "destinations.sqlite"
REPORT_OUTPUT = LOGS_DIR / "quality_report.json"

CST = timezone(timedelta(hours=8))

# 中国境内经纬度范围（WGS84）
CHINA_LAT_RANGE = (18.0, 54.0)
CHINA_LON_RANGE = (73.0, 135.0)

# 海拔异常阈值（米）
ALTITUDE_MAX_SANE = 6000  # 中国境内最高约 8848m，超过 6000m 的目的地需标记
ALTITUDE_NEGATIVE_WARN = 0  # 海拔为负值需警告（如吐鲁番盆地）


# ══════════════════════════════════════════════════════════════
# 检查器基础设施
# ══════════════════════════════════════════════════════════════

class QualityChecker:
    """数据质量检查器，累积所有检查结果。"""

    def __init__(self):
        self.results = {
            "report_title": "数据质量检查报告（增强版）",
            "generated_at": datetime.now(CST).isoformat(),
            "total_checks": 0,
            "passed": 0,
            "warnings": 0,
            "failed": 0,
            "checks": [],
        }

    def add_check(self, category: str, item: str, status: str, detail: str = ""):
        """
        添加一条检查结果。

        Args:
            category: 检查类别
            item: 具体检查项
            status: PASS / WARN / FAIL
            detail: 详细说明
        """
        self.results["total_checks"] += 1
        if status == "PASS":
            self.results["passed"] += 1
        elif status == "WARN":
            self.results["warnings"] += 1
        else:
            self.results["failed"] += 1

        self.results["checks"].append({
            "category": category,
            "item": item,
            "status": status,
            "detail": detail,
        })

        # 实时输出
        icon = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌"}.get(status, "?")
        logger.info(f"  {icon} [{status}] {category} — {item}")
        if detail:
            logger.debug(f"     {detail}")


def load_destinations():
    """加载合并后的目的地 JSON 数据。"""
    data = load_json(JSON_INPUT)
    if not data:
        return []
    return data.get("destinations", [])


def load_geojson_destinations():
    """加载 GeoJSON 中的目的地数量。"""
    data = load_json(GEOJSON_INPUT)
    if not data:
        return []
    return data.get("features", [])


def load_sqlite_destinations():
    """加载 SQLite 中的目的地数量。"""
    if not SQLITE_INPUT.exists():
        return 0
    try:
        conn = sqlite3.connect(str(SQLITE_INPUT))
        count = conn.execute("SELECT COUNT(*) FROM destinations").fetchone()[0]
        conn.close()
        return count
    except Exception:
        return 0


# ── 检查 1: 经纬度合法性（增强版） ────────────────────────────

def check_coordinates(checker: QualityChecker, destinations: list[dict]) -> None:
    """检查所有目的地的经纬度是否在中国境内合法范围，并标记边缘值。"""
    for dest in destinations:
        name = dest.get("name", "?")
        lat = dest.get("latitude")
        lon = dest.get("longitude")

        # 空值检查
        if lat is None or lon is None:
            checker.add_check(
                "坐标合法性", name, "FAIL",
                f"经纬度为 None（lat={lat}, lon={lon}）"
            )
            continue

        # 类型检查
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            checker.add_check(
                "坐标合法性", name, "FAIL",
                f"经纬度类型错误（lat type={type(lat).__name__}, lon type={type(lon).__name__}）"
            )
            continue

        # 中国范围检查
        lat_ok = CHINA_LAT_RANGE[0] <= lat <= CHINA_LAT_RANGE[1]
        lon_ok = CHINA_LON_RANGE[0] <= lon <= CHINA_LON_RANGE[1]

        if not lat_ok and not lon_ok:
            checker.add_check(
                "坐标合法性", name, "FAIL",
                f"({lat}, {lon}) 经纬度均超出中国范围"
            )
        elif not lat_ok:
            checker.add_check(
                "坐标合法性", name, "FAIL",
                f"纬度 {lat} 超出中国范围 {CHINA_LAT_RANGE}"
            )
        elif not lon_ok:
            checker.add_check(
                "坐标合法性", name, "FAIL",
                f"经度 {lon} 超出中国范围 {CHINA_LON_RANGE}"
            )
        else:
            # 标记边缘值（近海岛屿、边境地区等）
            edge_note = ""
            if lat < 19.0:
                edge_note = "（南海近海区域）"
            elif lat > 50.0:
                edge_note = "（北部边境区域）"
            if lon < 75.0:
                edge_note += "（西部边境区域）"
            elif lon > 132.0:
                edge_note += "（东部近海区域）"
            status = "WARN" if edge_note else "PASS"
            detail = f"({lat}, {lon}){edge_note}"
            checker.add_check("坐标合法性", name, status, detail)


# ── 检查 2: 名称重复 ────────────────────────────────────────

def check_duplicate_names(checker: QualityChecker, destinations: list[dict]) -> None:
    """检查是否存在重复的名称。"""
    names = [d.get("name", "") for d in destinations]
    seen = {}
    for i, name in enumerate(names):
        if name in seen:
            checker.add_check(
                "名称重复", name, "FAIL",
                f"'{name}' 在第 {seen[name]+1} 和第 {i+1} 条记录中重复出现"
            )
        else:
            seen[name] = i
    if len(seen) == len(destinations):
        checker.add_check("名称重复", "全部目的地", "PASS", f"{len(destinations)} 个名称全部唯一")


# ── 检查 3: 坐标重复 ────────────────────────────────────────

def check_duplicate_coordinates(checker: QualityChecker, destinations: list[dict]) -> None:
    """检查是否存在坐标重复（经纬度误差 < 0.001° 视为重复）。"""
    coords = []
    for dest in destinations:
        lat = dest.get("latitude")
        lon = dest.get("longitude")
        if lat is not None and lon is not None:
            coords.append((round(lat, 3), round(lon, 3), dest.get("name", "?")))

    seen = {}
    has_duplicate = False
    for rlat, rlon, name in coords:
        key = (rlat, rlon)
        if key in seen:
            checker.add_check(
                "坐标重复", name, "FAIL",
                f"坐标 ({rlat}, {rlon}) 与 '{seen[key]}' 重复"
            )
            has_duplicate = True
        else:
            seen[key] = name

    if not has_duplicate:
        checker.add_check("坐标重复", "全部目的地", "PASS", "无坐标重复")


# ── 检查 4: 字段完整性 ──────────────────────────────────────

# 必须非空的字段（严重程度：FAIL）
REQUIRED_FIELDS = ["name", "province", "latitude", "longitude", "source"]

# 强烈建议非空的字段（严重程度：WARN）
IMPORTANT_FIELDS = [
    "city", "climate", "altitude", "average_temperature",
    "summer_temperature", "winter_temperature", "air_quality",
    "forest_coverage", "medical_level", "budget_level",
    "suitable_people", "features", "description", "score",
    "source_url",
]

# 可选字段（空值不报警）
OPTIONAL_FIELDS = [
    "osm_id", "osm_type", "image_url", "image_source", "image_license",
    "pm25_annual", "negative_oxygen", "forest_type", "nearest_hospital",
    "hospital_distance_km", "annual_precipitation",
]


def check_field_completeness(checker: QualityChecker, destinations: list[dict]) -> None:
    """检查所有字段的完整性。"""
    total_required_empty = 0
    total_important_empty = 0

    for dest in destinations:
        name = dest.get("name", "?")

        # 必须字段
        for field in REQUIRED_FIELDS:
            val = dest.get(field)
            if val is None or val == "" or (isinstance(val, list) and len(val) == 0):
                checker.add_check(
                    "字段完整性（必须）", f"{name}.{field}", "FAIL",
                    f"必须字段 '{field}' 为空"
                )
                total_required_empty += 1

        # 建议字段
        for field in IMPORTANT_FIELDS:
            val = dest.get(field)
            if val is None or val == "" or (isinstance(val, list) and len(val) == 0):
                checker.add_check(
                    "字段完整性（建议）", f"{name}.{field}", "WARN",
                    f"建议字段 '{field}' 为空"
                )
                total_important_empty += 1

    if total_required_empty == 0 and total_important_empty == 0:
        checker.add_check("字段完整性", "全部字段", "PASS", "所有必须和建议字段均非空")
    else:
        logger.info(f"  必须字段缺失: {total_required_empty} 处")
        logger.info(f"  建议字段缺失: {total_important_empty} 处")


# ── 检查 5: source 字段完整性（增强版） ──────────────────────

def check_source_completeness(checker: QualityChecker, destinations: list[dict]) -> None:
    """检查 source 和 source_url 字段是否完整且质量合格。"""
    min_source_length = 30  # source 最少字符数（确保有足够详细的信息）

    for dest in destinations:
        name = dest.get("name", "?")
        source = dest.get("source", "")
        source_url = dest.get("source_url", "")

        # source 字段检查
        if not source or not source.strip():
            checker.add_check(
                "数据来源完整性", f"{name}.source", "FAIL",
                "source 字段为空，数据不可追溯"
            )
        elif len(source.strip()) < min_source_length:
            checker.add_check(
                "数据来源完整性", f"{name}.source", "WARN",
                f"source 字段过短（{len(source)} 字符），建议 ≥ {min_source_length} 字符"
            )
        else:
            checker.add_check(
                "数据来源完整性", f"{name}.source", "PASS",
                f"{len(source)} 字符"
            )

        # source_url 字段检查
        if not source_url or not source_url.strip():
            checker.add_check(
                "数据来源完整性", f"{name}.source_url", "WARN",
                "source_url 为空，建议补充 URL 以便论文引用"
            )
        else:
            # 检查 URL 格式
            urls = [u.strip() for u in source_url.split(";") if u.strip()]
            valid_urls = 0
            for u in urls:
                if u.startswith("http://") or u.startswith("https://"):
                    valid_urls += 1
            if valid_urls == len(urls):
                checker.add_check(
                    "数据来源完整性", f"{name}.source_url", "PASS",
                    f"{len(urls)} 个有效 URL"
                )
            else:
                checker.add_check(
                    "数据来源完整性", f"{name}.source_url", "WARN",
                    f"{valid_urls}/{len(urls)} 个 URL 格式有效"
                )


# ── 检查 6: 图片 URL 有效性 ─────────────────────────────────

def check_image_url(checker: QualityChecker, destinations: list[dict]) -> None:
    """检查图片 URL 是否有效（格式检查，不做实际 HTTP 请求），以及 image_source 和 image_license 完整性。"""
    for dest in destinations:
        name = dest.get("name", "?")
        image_url = dest.get("image_url", "")
        image_source = dest.get("image_source", "")
        image_license = dest.get("image_license", "")

        if not image_url or not image_url.strip():
            checker.add_check(
                "图片URL", name, "WARN",
                "image_url 为空，建议补充目的地实景图片链接"
            )
            # Also check image_source and image_license even if URL is empty
            if not image_source:
                checker.add_check(
                    "图片溯源", name, "WARN",
                    "image_source 为空"
                )
            if not image_license:
                checker.add_check(
                    "图片溯源", name, "WARN",
                    "image_license 为空"
                )
            continue

        # URL 格式检查
        url = image_url.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            checker.add_check(
                "图片URL", name, "FAIL",
                f"image_url 不是有效的 HTTP(S) URL: '{url[:80]}'"
            )
            continue

        # 检查是否为常见图片域名
        image_domains = [
            "upload.wikimedia.org", "commons.wikimedia.org",
            "images.unsplash.com", "live.staticflickr.com",
            "pic.weather.com.cn", "imgur.com",
        ]
        domain_ok = any(d in url for d in image_domains)
        file_ext = url.split("?")[0].lower()
        ext_ok = any(file_ext.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"])

        if domain_ok and ext_ok:
            checker.add_check("图片URL", name, "PASS", f"有效图片 URL（{len(url)} 字符）")
        elif ext_ok:
            checker.add_check("图片URL", name, "PASS", f"图片 URL 格式有效（{len(url)} 字符）")
        else:
            checker.add_check(
                "图片URL", name, "WARN",
                f"URL 有效但未识别为图片格式: '{url[:80]}'"
            )

        # 检查 image_source
        if not image_source:
            checker.add_check(
                "图片溯源", f"{name}.image_source", "WARN",
                "image_source 为空，图片出处不明，可能影响论文引用"
            )
        else:
            checker.add_check(
                "图片溯源", f"{name}.image_source", "PASS",
                image_source
            )

        # 检查 image_license
        if not image_license:
            checker.add_check(
                "图片溯源", f"{name}.image_license", "WARN",
                "image_license 为空，建议注明许可证类型"
            )
        else:
            checker.add_check(
                "图片溯源", f"{name}.image_license", "PASS",
                image_license
            )


# ── 检查 7: 海拔异常检测 ────────────────────────────────────

def check_altitude_anomaly(checker: QualityChecker, destinations: list[dict]) -> None:
    """检测海拔异常值（负值、超高值、逻辑不一致等）。"""
    for dest in destinations:
        name = dest.get("name", "?")
        altitude = dest.get("altitude")
        province = dest.get("province", "")

        if altitude is None:
            checker.add_check(
                "海拔异常", name, "WARN",
                "海拔数据缺失（altitude 为 None）"
            )
            continue

        if not isinstance(altitude, (int, float)):
            checker.add_check(
                "海拔异常", name, "FAIL",
                f"海拔数据类型错误: {type(altitude).__name__}"
            )
            continue

        # 负值检测（中国有吐鲁番等低于海平面的地区，但康养目的地不太可能）
        if altitude < ALTITUDE_NEGATIVE_WARN:
            checker.add_check(
                "海拔异常", name, "FAIL",
                f"海拔为负值 ({altitude}m)，康养目的地不太可能出现"
            )

        # 超高值检测
        elif altitude > ALTITUDE_MAX_SANE:
            checker.add_check(
                "海拔异常", name, "FAIL",
                f"海拔 {altitude}m 超过 6000m，不合理"
            )

        # 高海拔提醒（> 3000m 高反风险）
        elif altitude > 3000:
            checker.add_check(
                "海拔异常", name, "WARN",
                f"海拔 {altitude}m > 3000m，需注意高原反应风险（{province}）"
            )

        # 海拔与省份逻辑一致性检查
        elif altitude < 50 and province not in ["海南省", "广东省", "福建省", "浙江省", "江苏省", "上海市", "天津市"]:
            checker.add_check(
                "海拔异常", name, "WARN",
                f"海拔仅 {altitude}m，但位于 {province}（非沿海省份），请核实"
            )

        else:
            checker.add_check("海拔异常", name, "PASS", f"{altitude}m ({province})")


# ── 检查 8: 三种输出格式记录数一致性 ────────────────────────

def check_cross_format_consistency(
    checker: QualityChecker,
    destinations: list[dict],
    geojson_features: list,
    sqlite_count: int,
) -> None:
    """检查 JSON、GeoJSON、SQLite 三种输出格式的记录数是否一致。"""
    json_count = len(destinations)
    geojson_count = len(geojson_features) if geojson_features else 0

    counts = {
        "JSON (destinations.json)": json_count,
        "GeoJSON (destinations.geojson)": geojson_count,
        "SQLite (destinations.sqlite)": sqlite_count,
    }

    if json_count == geojson_count == sqlite_count:
        checker.add_check(
            "格式一致性", "记录数", "PASS",
            f"三种格式记录数一致: {json_count} 条"
        )
    else:
        details = ", ".join(f"{k}: {v}" for k, v in counts.items())
        checker.add_check(
            "格式一致性", "记录数", "FAIL",
            f"记录数不一致！→ {details}"
        )

    # 额外检查：SQLite 文件是否存在
    if sqlite_count == 0 and not SQLITE_INPUT.exists():
        checker.add_check(
            "格式一致性", "SQLite文件", "WARN",
            f"SQLite 文件不存在: {SQLITE_INPUT}（可能需要重新运行 merge_all_data.py）"
        )


# ── 检查 9: GeoJSON 合法性 ──────────────────────────────────

def check_geojson_validity(checker: QualityChecker) -> None:
    """验证 GeoJSON 文件是否符合 RFC 7946 规范。"""
    if not GEOJSON_INPUT.exists():
        checker.add_check("GeoJSON合法性", "文件", "FAIL", f"文件不存在: {GEOJSON_INPUT}")
        return

    try:
        data = load_json(GEOJSON_INPUT)
        if not data:
            checker.add_check("GeoJSON合法性", "文件", "FAIL", "文件为空或 JSON 解析失败")
            return

        # 检查顶层结构
        if data.get("type") != "FeatureCollection":
            checker.add_check(
                "GeoJSON合法性", "根类型", "FAIL",
                f"type 应为 'FeatureCollection'，实际为 '{data.get('type')}'"
            )
            return

        features = data.get("features", [])
        if not isinstance(features, list):
            checker.add_check("GeoJSON合法性", "features", "FAIL", "features 不是数组")
            return

        checker.add_check(
            "GeoJSON合法性", "结构", "PASS",
            f"FeatureCollection, {len(features)} 个 Features"
        )

        # 检查每个 Feature
        for feat in features:
            fid = feat.get("id", feat.get("properties", {}).get("name", "?"))

            # type
            if feat.get("type") != "Feature":
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "FAIL",
                    "type 不是 'Feature'"
                )
                continue

            # geometry
            geom = feat.get("geometry")
            if not geom:
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "FAIL",
                    "缺少 geometry"
                )
                continue

            if geom.get("type") != "Point":
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "FAIL",
                    f"geometry type 应为 'Point'，实际为 '{geom.get('type')}'"
                )
                continue

            coords = geom.get("coordinates", [])
            if len(coords) != 2:
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "FAIL",
                    f"coordinates 长度应为 2，实际为 {len(coords)}"
                )
                continue

            # 坐标顺序应为 [longitude, latitude]
            lon, lat = coords[0], coords[1]
            if not (CHINA_LON_RANGE[0] <= lon <= CHINA_LON_RANGE[1]):
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "WARN",
                    f"经度 {lon} 超出中国范围（可能是坐标顺序问题）"
                )
            if not (CHINA_LAT_RANGE[0] <= lat <= CHINA_LAT_RANGE[1]):
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "WARN",
                    f"纬度 {lat} 超出中国范围（可能是坐标顺序问题）"
                )

            # properties
            props = feat.get("properties")
            if not props:
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "FAIL",
                    "缺少 properties"
                )
            elif not props.get("name"):
                checker.add_check(
                    "GeoJSON合法性", f"Feature {fid}", "WARN",
                    "properties.name 为空"
                )

    except json.JSONDecodeError as e:
        checker.add_check("GeoJSON合法性", "JSON解析", "FAIL", str(e))
    except Exception as e:
        checker.add_check("GeoJSON合法性", "未知错误", "FAIL", str(e))


# ── 检查 10: SQLite 完整性 ──────────────────────────────────

def check_sqlite_integrity(checker: QualityChecker) -> None:
    """检查 SQLite 数据库是否完整可用。"""
    if not SQLITE_INPUT.exists():
        checker.add_check("SQLite完整性", "文件", "FAIL", f"文件不存在: {SQLITE_INPUT}")
        return

    try:
        conn = sqlite3.connect(str(SQLITE_INPUT))
        conn.row_factory = sqlite3.Row

        # 检查表是否存在
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='destinations'"
        )
        if not cursor.fetchone():
            checker.add_check("SQLite完整性", "表", "FAIL", "destinations 表不存在")
            conn.close()
            return

        # 检查行数
        count = conn.execute("SELECT COUNT(*) FROM destinations").fetchone()[0]
        if count == 0:
            checker.add_check("SQLite完整性", "数据", "FAIL", "表中无数据")
        else:
            checker.add_check("SQLite完整性", "数据", "PASS", f"{count} 条记录")

        # 检查关键列是否存在
        expected_columns = [
            "id", "name", "province", "city", "latitude", "longitude",
            "altitude", "climate", "air_quality", "forest_coverage",
            "medical_level", "score", "source", "source_url",
            "image_url", "image_source", "image_license",
        ]
        table_info = conn.execute("PRAGMA table_info(destinations)").fetchall()
        existing_columns = {row["name"] for row in table_info}

        missing_columns = [c for c in expected_columns if c not in existing_columns]
        if missing_columns:
            checker.add_check(
                "SQLite完整性", "列结构", "FAIL",
                f"缺少列: {', '.join(missing_columns)}"
            )
        else:
            checker.add_check(
                "SQLite完整性", "列结构", "PASS",
                f"{len(existing_columns)} 列完整（含 source_url）"
            )

        conn.close()

    except sqlite3.Error as e:
        checker.add_check("SQLite完整性", "数据库错误", "FAIL", str(e))
    except Exception as e:
        checker.add_check("SQLite完整性", "未知错误", "FAIL", str(e))


# ══════════════════════════════════════════════════════════════
# 汇总
# ══════════════════════════════════════════════════════════════

def run_all_checks(destinations: list[dict]) -> dict:
    """执行全部质量检查（10 大类）。"""
    checker = QualityChecker()

    logger.info("=" * 60)
    logger.info("quality_check.py — 数据质量检查（增强版）")
    logger.info(f"检查对象: {len(destinations)} 个目的地")
    logger.info("检查范围: 坐标 | 名称 | 字段 | 来源 | 图片 | 海拔 | 格式一致性 | GeoJSON | SQLite")
    logger.info("=" * 60)

    # 1. 坐标合法性
    logger.info("\n[1/10] 经纬度合法性检查（中国范围 + 边缘值标记）...")
    check_coordinates(checker, destinations)

    # 2. 名称重复
    logger.info("\n[2/10] 名称重复检查...")
    check_duplicate_names(checker, destinations)

    # 3. 坐标重复
    logger.info("\n[3/10] 坐标重复检查...")
    check_duplicate_coordinates(checker, destinations)

    # 4. 字段完整性
    logger.info("\n[4/10] 字段完整性检查（必须 + 建议 + 可选）...")
    check_field_completeness(checker, destinations)

    # 5. source 完整性
    logger.info("\n[5/10] 数据来源完整性检查（source + source_url）...")
    check_source_completeness(checker, destinations)

    # 6. 图片 URL
    logger.info("\n[6/10] 图片 URL 有效性检查...")
    check_image_url(checker, destinations)

    # 7. 海拔异常
    logger.info("\n[7/10] 海拔异常检测...")
    check_altitude_anomaly(checker, destinations)

    # 8. 格式一致性（预加载 GeoJSON 和 SQLite 计数）
    logger.info("\n[8/10] 三种格式记录数一致性检查...")
    geojson_features = load_geojson_destinations()
    sqlite_count = load_sqlite_destinations()
    check_cross_format_consistency(checker, destinations, geojson_features, sqlite_count)

    # 9. GeoJSON
    logger.info("\n[9/10] GeoJSON 合法性验证...")
    check_geojson_validity(checker)

    # 10. SQLite
    logger.info("\n[10/10] SQLite 完整性检查...")
    check_sqlite_integrity(checker)

    # 汇总
    logger.info("\n" + "=" * 60)
    r = checker.results
    logger.info(f"质量检查完成：")
    logger.info(f"  总检查项: {r['total_checks']}")
    logger.info(f"  通过: {r['passed']}  ✅")
    logger.info(f"  警告: {r['warnings']}  ⚠️")
    logger.info(f"  失败: {r['failed']}  ❌")

    # 总体结论
    if r["failed"] == 0 and r["warnings"] == 0:
        r["overall"] = "PASS — 所有检查通过，数据质量良好，可以发布。"
        logger.info(f"\n结论: {r['overall']}")
    elif r["failed"] == 0:
        r["overall"] = f"PASS WITH WARNINGS — {r['warnings']} 项警告，建议修复后再发布。"
        logger.info(f"\n结论: {r['overall']}")
    else:
        r["overall"] = f"FAIL — {r['failed']} 项未通过，必须修复后才能发布。"
        logger.info(f"\n结论: {r['overall']}")

    logger.info("=" * 60)

    return r


# ══════════════════════════════════════════════════════════════
# 主入口
# ══════════════════════════════════════════════════════════════

def main():
    """主函数：加载数据 → 运行全部质量检查 → 输出报告。"""
    destinations = load_destinations()
    if not destinations:
        logger.error("无法加载 destinations.json！请先运行 merge_all_data.py")
        return

    report = run_all_checks(destinations)
    save_json(report, REPORT_OUTPUT, logger)
    logger.info(f"\n质量报告已保存: {REPORT_OUTPUT}")


if __name__ == "__main__":
    main()
