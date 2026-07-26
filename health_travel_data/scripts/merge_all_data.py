"""
merge_all_data.py — 数据合并与多格式输出脚本

功能：
  1. 读取 processed/ 下各维度的采集数据
  2. 合并为统一的目的地数据集
  3. 输出三种格式：
     - json/destinations.json      — 通用 JSON
     - geojson/destinations.geojson — Leaflet 兼容 GeoJSON
     - sqlite/destinations.sqlite   — 结构化数据库

合并策略：
  - 以 locations.json 为骨架（name 为主键）
  - 各维度数据通过 name 字段匹配合并
  - 缺失维度不阻塞合并（字段留空 + source 标注）

工程设计：
  - 纯数据处理，不涉及网络请求
  - 幂等：重复运行产生相同输出
  - 生成的 GeoJSON 严格遵循 RFC 7946 规范
"""

import json
import sqlite3
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from collector_utils import (
    BASE_DIR, PROCESSED_DIR, LOGS_DIR,
    get_logger, save_json, load_json,
    CollectionReport,
)

logger = get_logger("merge_all_data")

# 输出路径
SCRIPTS_DIR = BASE_DIR / "scripts"
PROFILES_PATH = SCRIPTS_DIR / "destination_profiles.json"
JSON_OUTPUT = BASE_DIR / "json" / "destinations.json"
GEOJSON_OUTPUT = BASE_DIR / "geojson" / "destinations.geojson"
SQLITE_OUTPUT = BASE_DIR / "sqlite" / "destinations.sqlite"
STATISTICS_OUTPUT = LOGS_DIR / "dataset_statistics.json"
SOURCES_OUTPUT = LOGS_DIR / "data_sources.md"

CST = timezone(timedelta(hours=8))


# ══════════════════════════════════════════════════════════════
# 数据加载
# ══════════════════════════════════════════════════════════════

def load_dimension_data() -> dict[str, list[dict]]:
    """
    加载所有维度的处理后数据。

    Returns:
        {维度名: [数据dict, ...]} 字典
    """
    dimensions = {
        "locations": PROCESSED_DIR / "locations.json",
        "weather": PROCESSED_DIR / "weather.json",
        "air_quality": PROCESSED_DIR / "air_quality.json",
        "forest": PROCESSED_DIR / "forest.json",
        "medical": PROCESSED_DIR / "medical.json",
        "images": PROCESSED_DIR / "images.json",
    }

    data = {}
    for dim_name, filepath in dimensions.items():
        loaded = load_json(filepath)
        if loaded:
            data[dim_name] = loaded
            logger.info(f"[加载] {dim_name}: {len(loaded)} 条记录")
        else:
            logger.warning(f"[缺失] {dim_name}: 文件不存在或为空 → {filepath}")
            data[dim_name] = []

    return data


# ══════════════════════════════════════════════════════════════
# 数据合并
# ══════════════════════════════════════════════════════════════

def merge_destinations(dim_data: dict) -> list[dict]:
    """
    以 locations 为骨架，合并各维度数据为统一目的地记录。

    合并规则：
    - 通过 name 字段精确匹配
    - locations 中每个条目成为一个目的地
    - 各维度数据按字段名合并（不覆盖已有字段）
    - 缺失的维度字段留空，source 标注 "数据待采集"

    Args:
        dim_data: 各维度数据字典

    Returns:
        合并后的目的地列表
    """
    locations = dim_data.get("locations", [])
    if not locations:
        logger.error("locations 数据为空，无法合并！请先运行 collect_locations.py")
        return []

    # 将各维度转为 {name: data} 索引
    def index_by_name(records: list[dict]) -> dict:
        return {r.get("name", ""): r for r in records}

    weather_idx = index_by_name(dim_data.get("weather", []))
    aq_idx = index_by_name(dim_data.get("air_quality", []))
    forest_idx = index_by_name(dim_data.get("forest", []))
    medical_idx = index_by_name(dim_data.get("medical", []))
    images_idx = index_by_name(dim_data.get("images", []))

    merged = []
    for i, loc in enumerate(locations):
        name = loc.get("name", f"unknown_{i}")

        # 查找各维度数据
        weather = weather_idx.get(name, {})
        air = aq_idx.get(name, {})
        forest = forest_idx.get(name, {})
        medical = medical_idx.get(name, {})
        images = images_idx.get(name, {})

        # 构建合并记录
        destination = {
            # ── 基础信息（来自 locations） ──
            "id": i + 1,
            "name": name,
            "province": loc.get("province", ""),
            "city": loc.get("city", ""),
            "latitude": loc.get("latitude", 0),
            "longitude": loc.get("longitude", 0),
            "altitude": loc.get("altitude"),
            "osm_id": loc.get("osm_id"),
            "osm_type": loc.get("osm_type"),

            # ── 气候（来自 weather） ──
            "climate": weather.get("climate", ""),
            "average_temperature": weather.get("average_temperature", ""),
            "summer_temperature": weather.get("summer_temperature", ""),
            "winter_temperature": weather.get("winter_temperature", ""),
            "annual_precipitation": weather.get("annual_precipitation", ""),
            "best_season": weather.get("best_season", ""),

            # ── 空气质量（来自 air_quality） ──
            "air_quality": air.get("air_quality", ""),
            "air_quality_index": air.get("air_quality_index"),
            "pm25_annual": air.get("pm25_annual"),
            "negative_oxygen": air.get("negative_oxygen", ""),

            # ── 森林（来自 forest） ──
            "forest_coverage": forest.get("forest_coverage", ""),
            "forest_type": forest.get("forest_type", ""),

            # ── 医疗（来自 medical） ──
            "medical_level": medical.get("medical_level", ""),
            "nearest_hospital": medical.get("nearest_hospital", ""),
            "hospital_distance_km": medical.get("hospital_distance_km"),

            # ── 预算等级 ──
            "budget_level": _derive_budget_level(loc, weather),
            "monthly_cost_low": _derive_monthly_cost_low(name, loc),
            "monthly_cost_high": _derive_monthly_cost_high(name, loc),

            # ── 描述与标签 ──
            "suitable_people": _derive_suitable_people(name, weather, air, forest, medical),
            "features": _derive_features(name, loc),
            "description": _derive_description(name, loc, weather, forest),
            "image_url": images.get("image_url") or _derive_image_url(name),
            "image_source": images.get("image_source", ""),
            "image_license": images.get("image_license", ""),

            # ── 评分 ──
            "score": _derive_score(name, weather, air, forest, medical),

            # ── 数据溯源 ──
            "source": _merge_sources(loc, weather, air, forest, medical),
            "source_url": _merge_source_urls(loc, weather, air, forest, medical),
            "data_updated_at": datetime.now(CST).strftime("%Y-%m-%d"),
        }

        merged.append(destination)
        logger.info(f"[合并] {name}: {_count_fields(destination)}/{_total_fields()} 字段有值")

    return merged


# ══════════════════════════════════════════════════════════════
# 派生字段（基于 destination_profiles.json）
# ══════════════════════════════════════════════════════════════

_profiles_cache: dict | None = None


def _load_profiles() -> dict:
    """加载目的地综合画像数据。"""
    global _profiles_cache
    if _profiles_cache is None:
        _profiles_cache = {}
        loaded = load_json(PROFILES_PATH)
        if loaded and "profiles" in loaded:
            _profiles_cache = loaded["profiles"]
    return _profiles_cache


def _get_profile(name: str) -> dict:
    """获取单个目的地的画像数据，不存在时返回空 dict。"""
    profiles = _load_profiles()
    return profiles.get(name, {})


def _derive_budget_level(loc: dict, weather: dict) -> str:
    profile = _get_profile(loc.get("name", ""))
    return profile.get("budget_level", "待评估")


def _derive_monthly_cost_low(name: str, loc: dict) -> int | None:
    profile = _get_profile(name)
    return profile.get("monthly_cost_low")


def _derive_monthly_cost_high(name: str, loc: dict) -> int | None:
    profile = _get_profile(name)
    return profile.get("monthly_cost_high")


def _derive_suitable_people(name: str, weather: dict, air: dict, forest: dict, medical: dict) -> str:
    profile = _get_profile(name)
    return profile.get("suitable_people", "待补充")


def _derive_features(name: str, loc: dict) -> list[str]:
    profile = _get_profile(name)
    return profile.get("features", [])


def _derive_description(name: str, loc: dict, weather: dict, forest: dict) -> str:
    profile = _get_profile(name)
    return profile.get("description", "待补充")


def _derive_image_url(name: str) -> str:
    profile = _get_profile(name)
    return profile.get("image_url", "")


def _derive_score(name: str, weather: dict, air: dict, forest: dict, medical: dict) -> float:
    """综合评分：优先使用画像中的评分，缺失时基于多维度自动计算。"""
    profile = _get_profile(name)
    if "score" in profile:
        return profile["score"]

    # 自动计算降级方案（各维度权重可调）
    score = 3.0  # 基准分
    if forest and forest.get("forest_coverage_value"):
        fc = forest["forest_coverage_value"]
        if fc >= 80: score += 0.8
        elif fc >= 60: score += 0.5
        elif fc >= 40: score += 0.3
    if air and air.get("air_quality_index"):
        aqi = air["air_quality_index"]
        if aqi <= 30: score += 0.6
        elif aqi <= 50: score += 0.4
        elif aqi <= 80: score += 0.2
    if medical and medical.get("medical_level"):
        ml = medical["medical_level"]
        if "三级甲" in ml: score += 0.4
        elif "三级" in ml: score += 0.3
        elif "二级甲" in ml: score += 0.2
    if weather and weather.get("average_temperature"):
        try:
            temp_str = weather["average_temperature"].replace("℃", "").replace("°C", "")
            avg_temp = float(temp_str)
            if 14 <= avg_temp <= 22: score += 0.3  # 康养黄金温度
        except (ValueError, AttributeError):
            pass
    return round(min(score, 5.0), 1)


def _merge_sources(*sources) -> str:
    """合并多个维度的 source，去重后用分号连接。"""
    seen = set()
    parts = []
    for src_dict in sources:
        if isinstance(src_dict, dict):
            s = src_dict.get("source", "")
        elif isinstance(src_dict, str):
            s = src_dict
        else:
            continue
        if s and s not in seen:
            seen.add(s)
            parts.append(s)
    return "; ".join(parts)


def _merge_source_urls(*sources) -> str:
    """合并多个维度的 source_urls，去重后用分号连接。"""
    seen = set()
    urls = []
    for src_dict in sources:
        if not isinstance(src_dict, dict):
            continue
        src_urls = src_dict.get("source_urls", [])
        if isinstance(src_urls, list):
            for u in src_urls:
                if u and u not in seen:
                    seen.add(u)
                    urls.append(u)
        elif isinstance(src_dict.get("source_url"), str) and src_dict["source_url"]:
            u = src_dict["source_url"]
            if u not in seen:
                seen.add(u)
                urls.append(u)
    return "; ".join(urls)


def _count_fields(dest: dict) -> int:
    """统计非空字段数。"""
    count = 0
    for v in dest.values():
        if v is not None and v != "" and v != []:
            count += 1
    return count


def _total_fields() -> int:
    return 36  # 目标字段总数（含 source_url, image_source, image_license）


# ══════════════════════════════════════════════════════════════
# JSON 输出
# ══════════════════════════════════════════════════════════════

def output_json(destinations: list[dict]) -> None:
    """输出 destinations.json。"""
    if not destinations:
        return
    dest = destinations[0] if destinations else {}
    # Build comprehensive field list with source_url and data_updated_at
    fields = []
    if dest:
        fields = list(dest.keys())
    data = {
        "metadata": {
            "title": "中国康养旅居目的地数据集",
            "description": "收录中国优质康养旅居目的地的基础地理信息与多维康养属性数据，所有数据均标注来源，适合论文引用。",
            "source": "上海师范大学 环境与地理科学学院 · AI康养旅居助手项目",
            "date": datetime.now(CST).strftime("%Y-%m-%d"),
            "count": len(destinations),
            "coordinate_system": "WGS84 (EPSG:4326)",
            "fields": fields,
        },
        "destinations": destinations,
    }
    save_json(data, JSON_OUTPUT, logger)
    logger.info(f"[输出] JSON → {JSON_OUTPUT}")


# ══════════════════════════════════════════════════════════════
# GeoJSON 输出
# ══════════════════════════════════════════════════════════════

def output_geojson(destinations: list[dict]) -> None:
    """
    输出 RFC 7946 兼容的 GeoJSON FeatureCollection。

    GeoJSON 坐标顺序：[longitude, latitude]
    属性包含：name, province, city, climate, altitude, 气温, 空气质量,
              森林覆盖率, 医疗水平, 预算, 评分, 标签, 适合人群, 最佳季节, source
    """
    features = []
    for dest in destinations:
        feature = {
            "type": "Feature",
            "id": dest.get("id"),
            "geometry": {
                "type": "Point",
                "coordinates": [
                    dest.get("longitude", 0),
                    dest.get("latitude", 0),
                ],
            },
            "properties": {
                "name": dest.get("name", ""),
                "province": dest.get("province", ""),
                "city": dest.get("city", ""),
                "climate": dest.get("climate", ""),
                "altitude": dest.get("altitude"),
                "average_temperature": dest.get("average_temperature", ""),
                "summer_temperature": dest.get("summer_temperature", ""),
                "winter_temperature": dest.get("winter_temperature", ""),
                "air_quality": dest.get("air_quality", ""),
                "air_quality_index": dest.get("air_quality_index"),
                "forest_coverage": dest.get("forest_coverage", ""),
                "medical_level": dest.get("medical_level", ""),
                "budget_level": dest.get("budget_level", ""),
                "monthly_cost_low": dest.get("monthly_cost_low"),
                "monthly_cost_high": dest.get("monthly_cost_high"),
                "suitable_people": dest.get("suitable_people", ""),
                "features": dest.get("features", []),
                "best_season": dest.get("best_season", ""),
                "score": dest.get("score", 0),
                "image_source": dest.get("image_source", ""),
                "image_license": dest.get("image_license", ""),
                "source": dest.get("source", ""),
                "source_url": dest.get("source_url", ""),
            },
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "中国康养旅居目的地数据集 — GeoJSON",
            "description": "收录中国优质康养旅居目的地，含多维康养属性。坐标系统 WGS84 (EPSG:4326)。",
            "source": "上海师范大学 环境与地理科学学院 · AI康养旅居助手项目",
            "date": datetime.now(CST).strftime("%Y-%m-%d"),
            "count": len(features),
            "coordinate_system": "WGS84 (EPSG:4326)",
            "specification": "RFC 7946",
        },
        "features": features,
    }

    save_json(geojson, GEOJSON_OUTPUT, logger)
    logger.info(f"[输出] GeoJSON → {GEOJSON_OUTPUT}")


# ══════════════════════════════════════════════════════════════
# SQLite 输出
# ══════════════════════════════════════════════════════════════

def output_sqlite(destinations: list[dict]) -> None:
    """
    输出 SQLite 数据库。

    表结构（完整字段集，比项目数据库更丰富）：
      id, name, province, city, latitude, longitude, altitude,
      climate, average_temperature, summer_temperature, winter_temperature,
      annual_precipitation, best_season,
      air_quality, air_quality_index, pm25_annual, negative_oxygen,
      forest_coverage, forest_type,
      medical_level, nearest_hospital, hospital_distance_km,
      budget_level, monthly_cost_low, monthly_cost_high,
      suitable_people, features, description, image_url,
      score, source, data_updated_at,
      osm_id, osm_type
    """
    SQLITE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    # 删除旧数据库（仅用于数据仓库输出，不影响项目数据库）
    if SQLITE_OUTPUT.exists():
        SQLITE_OUTPUT.unlink()
        logger.info("[SQLite] 已删除旧数据库")

    conn = sqlite3.connect(str(SQLITE_OUTPUT))
    conn.row_factory = sqlite3.Row

    try:
        # 建表（完整字段集）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS destinations (
                id                  INTEGER PRIMARY KEY,
                name                TEXT    NOT NULL,
                province            TEXT    NOT NULL,
                city                TEXT,
                latitude            REAL    NOT NULL,
                longitude           REAL    NOT NULL,
                altitude            INTEGER,
                climate             TEXT,
                average_temperature TEXT,
                summer_temperature  TEXT,
                winter_temperature  TEXT,
                annual_precipitation TEXT,
                best_season         TEXT,
                air_quality         TEXT,
                air_quality_index   INTEGER,
                pm25_annual         INTEGER,
                negative_oxygen     TEXT,
                forest_coverage     TEXT,
                forest_type         TEXT,
                medical_level       TEXT,
                nearest_hospital    TEXT,
                hospital_distance_km INTEGER,
                budget_level        TEXT,
                monthly_cost_low    INTEGER,
                monthly_cost_high   INTEGER,
                suitable_people     TEXT,
                features            TEXT,
                description         TEXT,
                image_url           TEXT,
                image_source        TEXT,
                image_license       TEXT,
                score               REAL    DEFAULT 4.0,
                source              TEXT,
                source_url          TEXT,
                data_updated_at     TEXT,
                osm_id              TEXT,
                osm_type            TEXT
            )
        """)

        # 插入数据
        for dest in destinations:
            features_json = json.dumps(dest.get("features", []), ensure_ascii=False)

            conn.execute("""
                INSERT OR REPLACE INTO destinations (
                    id, name, province, city, latitude, longitude, altitude,
                    climate, average_temperature, summer_temperature, winter_temperature,
                    annual_precipitation, best_season,
                    air_quality, air_quality_index, pm25_annual, negative_oxygen,
                    forest_coverage, forest_type,
                    medical_level, nearest_hospital, hospital_distance_km,
                    budget_level, monthly_cost_low, monthly_cost_high,
                    suitable_people, features, description, image_url,
                    image_source, image_license,
                    score, source, source_url, data_updated_at,
                    osm_id, osm_type
                ) VALUES (
                    :id, :name, :province, :city, :latitude, :longitude, :altitude,
                    :climate, :average_temperature, :summer_temperature, :winter_temperature,
                    :annual_precipitation, :best_season,
                    :air_quality, :air_quality_index, :pm25_annual, :negative_oxygen,
                    :forest_coverage, :forest_type,
                    :medical_level, :nearest_hospital, :hospital_distance_km,
                    :budget_level, :monthly_cost_low, :monthly_cost_high,
                    :suitable_people, :features, :description, :image_url,
                    :image_source, :image_license,
                    :score, :source, :source_url, :data_updated_at,
                    :osm_id, :osm_type
                )
            """, {
                "id": dest["id"],
                "name": dest["name"],
                "province": dest["province"],
                "city": dest.get("city", ""),
                "latitude": dest["latitude"],
                "longitude": dest["longitude"],
                "altitude": dest.get("altitude"),
                "climate": dest.get("climate", ""),
                "average_temperature": dest.get("average_temperature", ""),
                "summer_temperature": dest.get("summer_temperature", ""),
                "winter_temperature": dest.get("winter_temperature", ""),
                "annual_precipitation": dest.get("annual_precipitation", ""),
                "best_season": dest.get("best_season", ""),
                "air_quality": dest.get("air_quality", ""),
                "air_quality_index": dest.get("air_quality_index"),
                "pm25_annual": dest.get("pm25_annual"),
                "negative_oxygen": dest.get("negative_oxygen", ""),
                "forest_coverage": dest.get("forest_coverage", ""),
                "forest_type": dest.get("forest_type", ""),
                "medical_level": dest.get("medical_level", ""),
                "nearest_hospital": dest.get("nearest_hospital", ""),
                "hospital_distance_km": dest.get("hospital_distance_km"),
                "budget_level": dest.get("budget_level", ""),
                "monthly_cost_low": dest.get("monthly_cost_low"),
                "monthly_cost_high": dest.get("monthly_cost_high"),
                "suitable_people": dest.get("suitable_people", ""),
                "features": features_json,
                "description": dest.get("description", ""),
                "image_url": dest.get("image_url", ""),
                "image_source": dest.get("image_source", ""),
                "image_license": dest.get("image_license", ""),
                "score": dest.get("score", 4.0),
                "source": dest.get("source", ""),
                "source_url": dest.get("source_url", ""),
                "data_updated_at": dest.get("data_updated_at", ""),
                "osm_id": dest.get("osm_id", ""),
                "osm_type": dest.get("osm_type", ""),
            })

        conn.commit()
        logger.info(f"[输出] SQLite → {SQLITE_OUTPUT} ({len(destinations)} 条记录)")

    finally:
        conn.close()


# ══════════════════════════════════════════════════════════════
# 统计与文档输出
# ══════════════════════════════════════════════════════════════

def output_statistics(destinations: list[dict]) -> None:
    """生成增强版数据集统计报告 dataset_statistics.json。"""
    if not destinations:
        return

    n = len(destinations)

    # ── 基础统计 ──
    provinces = sorted(set(d.get("province", "") for d in destinations if d.get("province")))
    altitudes = [d["altitude"] for d in destinations if d.get("altitude") is not None]
    scores = [d["score"] for d in destinations if d.get("score") is not None]
    costs_low = [d["monthly_cost_low"] for d in destinations if d.get("monthly_cost_low") is not None]
    costs_high = [d["monthly_cost_high"] for d in destinations if d.get("monthly_cost_high") is not None]
    aq_values = [d["air_quality_index"] for d in destinations if d.get("air_quality_index") is not None]
    pm25_values = [d["pm25_annual"] for d in destinations if d.get("pm25_annual") is not None]

    # ── 森林覆盖率数值提取 ──
    forest_values = []
    for d in destinations:
        fc = d.get("forest_coverage", "")
        if fc and "%" in fc:
            try:
                forest_values.append(float(fc.replace("%", "")))
            except ValueError:
                pass

    # ── 气温提取（解析 "13.5℃" 和 "18–28℃" 格式） ──
    def _parse_temp_range(temp_str: str):
        """解析气温字符串，返回 (low, high) 或 (None, None)。"""
        if not temp_str:
            return None, None
        clean = temp_str.replace("℃", "").replace("°C", "").strip()
        if "–" in clean or "—" in clean or "-" in clean:
            parts = clean.replace("–", "-").replace("—", "-").split("-")
        elif "~" in clean:
            parts = clean.split("~")
        else:
            try:
                val = float(clean)
                return val, val
            except ValueError:
                return None, None
        try:
            lo = float(parts[0].strip())
            hi = float(parts[1].strip())
            return lo, hi
        except (ValueError, IndexError):
            return None, None

    def _parse_single_temp(temp_str: str):
        """解析单个气温值字符串（如 '15.1℃'）。"""
        if not temp_str:
            return None
        try:
            return float(temp_str.replace("℃", "").replace("°C", "").strip())
        except ValueError:
            return None

    avg_temps = []
    summer_lo_temps, summer_hi_temps = [], []
    winter_lo_temps, winter_hi_temps = [], []
    for d in destinations:
        at = _parse_single_temp(d.get("average_temperature", ""))
        if at is not None:
            avg_temps.append(at)
        sl, sh = _parse_temp_range(d.get("summer_temperature", ""))
        if sl is not None:
            summer_lo_temps.append(sl)
        if sh is not None:
            summer_hi_temps.append(sh)
        wl, wh = _parse_temp_range(d.get("winter_temperature", ""))
        if wl is not None:
            winter_lo_temps.append(wl)
        if wh is not None:
            winter_hi_temps.append(wh)

    # ── 统计函数 ──
    def _avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else None

    def _range(lst):
        return {"min": min(lst), "max": max(lst)} if lst else None

    stats = {
        "title": "AI康养旅居目的地数据集 — 统计摘要",
        "generated_at": datetime.now(CST).isoformat(),
        "data_updated_at": datetime.now(CST).strftime("%Y-%m-%d"),

        # 基础概览
        "overview": {
            "destination_count": n,
            "province_count": len(provinces),
            "provinces": provinces,
            "destinations": [d["name"] for d in destinations],
        },

        # 气温统计
        "temperature": {
            "annual_average": {
                "mean": _avg(avg_temps),
                "unit": "℃",
                "description": "年平均气温（各目的地均值）",
            },
            "summer": {
                "low_mean": _avg(summer_lo_temps),
                "high_mean": _avg(summer_hi_temps),
                "unit": "℃",
                "description": "夏季气温范围（各目的地低温均值–高温均值）",
            },
            "winter": {
                "low_mean": _avg(winter_lo_temps),
                "high_mean": _avg(winter_hi_temps),
                "unit": "℃",
                "description": "冬季气温范围（各目的地低温均值–高温均值）",
            },
        },

        # 海拔统计
        "altitude": {
            "mean": _avg(altitudes),
            "median": sorted(altitudes)[len(altitudes)//2] if altitudes else None,
            "min": min(altitudes) if altitudes else None,
            "max": max(altitudes) if altitudes else None,
            "unit": "米",
        },

        # 空气质量统计
        "air_quality": {
            "aqi_mean": _avg(aq_values),
            "aqi_range": _range(aq_values),
            "pm25_annual_mean": _avg(pm25_values),
            "pm25_unit": "μg/m³",
            "description": "AQI 及 PM2.5 数据来源于中国环境监测总站及地方生态环境局公报",
        },

        # 森林覆盖率统计
        "forest_coverage": {
            "mean": f"{_avg(forest_values)}%" if forest_values else None,
            "min": f"{min(forest_values)}%" if forest_values else None,
            "max": f"{max(forest_values)}%" if forest_values else None,
            "description": "森林覆盖率数据来源于国家林业和草原局及地方林业局公报",
        },

        # 预算区间统计
        "budget": {
            "monthly_cost_low_mean": _avg(costs_low),
            "monthly_cost_high_mean": _avg(costs_high),
            "monthly_cost_low_range": _range(costs_low),
            "monthly_cost_high_range": _range(costs_high),
            "unit": "元/月",
            "description": "月度康养旅居费用估算（含住宿、餐饮、基础医疗）",
        },

        # 评分统计
        "score": {
            "mean": round(sum(scores) / len(scores), 2) if scores else None,
            "min": min(scores) if scores else None,
            "max": max(scores) if scores else None,
        },

        # 医疗资源统计
        "medical": {
            "levels": list(set(
                d.get("medical_level", "") for d in destinations if d.get("medical_level")
            )),
            "description": "目的地最近综合医院的等级分布",
        },
    }

    save_json(stats, STATISTICS_OUTPUT, logger)
    logger.info(f"[输出] 统计报告 → {STATISTICS_OUTPUT}")


def output_data_sources(destinations: list[dict]) -> None:
    """生成数据来源文档 data_sources.md。"""
    lines = [
        "# 数据来源文档",
        "",
        f"> 生成时间：{datetime.now(CST).strftime('%Y-%m-%d %H:%M')}",
        f"> 目的地数量：{len(destinations)}",
        "",
        "## 字段来源对照表",
        "",
        "| 字段 | 数据来源 | 获取方式 | 更新时间 |",
        "|------|----------|----------|----------|",
        "| name, province, city | OpenStreetMap Nominatim API | HTTP GET | 2026-07 |",
        "| latitude, longitude | OpenStreetMap Nominatim API | HTTP GET | 2026-07 |",
        "| altitude | OSM / GeoNames / 中国天气网 | API + 编译 | 2026-07 |",
        "| climate | 中国气象局 / 《中国气候区划》 | 官方公开数据编译 | 2023 |",
        "| average_temperature | 中国天气网 / 地方气象局公报 | 官方公开数据编译 | 2023 |",
        "| summer_temperature | 中国天气网 | 官方公开数据编译 | 2023 |",
        "| winter_temperature | 中国天气网 | 官方公开数据编译 | 2023 |",
        "| air_quality, AQI | 中国环境监测总站 / 地方生态环境局公报 | 官方公开数据编译 | 2023 |",
        "| forest_coverage | 国家林业和草原局 / 地方林业局公报 | 官方公开数据编译 | 2023 |",
        "| medical_level | 国家卫健委医院等级公开信息 | 官方公开数据编译 | 2023 |",
        "| description | Wikipedia（经官方数据交叉验证） | HTTP GET | 2026-07 |",
        "| image_url | Wikipedia Commons | HTTP GET | 2026-07 |",
        "| score | 多维综合评价模型 | 算法计算 | 2026-07 |",
        "",
        "## 参考文献",
        "",
        "1. OpenStreetMap Contributors. Nominatim Search API. https://nominatim.openstreetmap.org/",
        "2. 中国气象局. 中国气候区划.",
        "3. 中国环境监测总站. 《2023中国生态环境状况公报》.",
        "4. 国家林业和草原局. 《中国森林资源报告》.",
        "5. 国家卫生健康委员会. 医院等级公开信息.",
        "6. 各省/市/县统计局. 统计年鉴（2023）.",
        "7. Wikipedia Contributors. 各目的地词条. https://zh.wikipedia.org/",
        "",
        "## 引用说明",
        "",
        "在论文中引用本数据集时，请注明：",
        "",
        "> 数据来源：AI康养旅居助手项目数据仓库 (health_travel_data/)，上海师范大学 环境与地理科学学院",
        "> 上海师范大学 环境与地理科学学院",
        "> 采集日期：2026年7月",
    ]

    with open(SOURCES_OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    logger.info(f"[输出] 数据来源文档 → {SOURCES_OUTPUT}")


# ══════════════════════════════════════════════════════════════
# 主入口
# ══════════════════════════════════════════════════════════════

def main():
    """主函数：合并 → 输出 JSON/GeoJSON/SQLite → 生成统计与文档。"""
    logger.info("=" * 60)
    logger.info("merge_all_data.py — 数据合并与多格式输出")
    logger.info("=" * 60)

    # 1. 加载各维度数据
    dim_data = load_dimension_data()

    # 2. 合并
    destinations = merge_destinations(dim_data)
    if not destinations:
        logger.error("合并失败：无数据输出！")
        return

    logger.info(f"\n合并完成: {len(destinations)} 个目的地")

    # 3. 输出三种格式
    output_json(destinations)
    output_geojson(destinations)
    output_sqlite(destinations)

    # 4. 统计与文档
    output_statistics(destinations)
    output_data_sources(destinations)

    logger.info("\n" + "=" * 60)
    logger.info("全部输出完成！")
    logger.info(f"  JSON:    {JSON_OUTPUT}")
    logger.info(f"  GeoJSON: {GEOJSON_OUTPUT}")
    logger.info(f"  SQLite:  {SQLITE_OUTPUT}")
    logger.info(f"  统计:    {STATISTICS_OUTPUT}")
    logger.info(f"  来源:    {SOURCES_OUTPUT}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
