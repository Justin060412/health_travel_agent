"""
collect_locations.py — 地理信息采集脚本

数据来源：
  1. OpenStreetMap Nominatim API（主要） — 坐标、行政区划、海拔（如有）
  2. 配置文件补充 — 经验证的海拔等基础数据

采集内容（每个目的地）：
  - name, province, city（行政区划）
  - latitude, longitude（WGS84 坐标）
  - altitude（海拔，米）
  - osm_id, osm_type（OSM 内部标识）

工程设计：
  - 优先读取 raw/geography/ 缓存
  - Nominatim API 限速 1 req/s（本脚本使用 1.5s 间隔）
  - 失败自动重试 3 次，指数退避
  - 单目的地失败不影响其他目的地
  - 支持重复运行（幂等）

OSM Nominatim 使用条款：
  - 必须设置 User-Agent
  - 最大 1 request/second
  - 禁止批量并发请求
  - 提供 attribution
  - https://operations.osmfoundation.org/policies/nominatim/
"""

import json
import sys
import os
from pathlib import Path

# 确保可以导入同目录的 collector_utils
sys.path.insert(0, str(Path(__file__).parent))

from collector_utils import (
    BASE_DIR, RAW_DIR, PROCESSED_DIR, LOGS_DIR,
    get_logger, create_session, safe_request,
    read_cache, write_cache, is_cached, cache_key,
    save_json, load_json, collect_with_fallback,
    CollectionReport,
)

logger = get_logger("collect_locations")


# ══════════════════════════════════════════════════════════════
# 配置
# ══════════════════════════════════════════════════════════════

# Nominatim API 端点（使用公开实例）
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# 请求间隔（秒）— OSM 要求不超过 1 req/s，我们使用 1.5s 安全余量
REQUEST_INTERVAL = 1.5

# 输出路径
OUTPUT_PATH = PROCESSED_DIR / "locations.json"


# ══════════════════════════════════════════════════════════════
# 数据采集
# ══════════════════════════════════════════════════════════════

def load_destinations_config():
    """加载目的地配置文件。"""
    config_path = Path(__file__).parent / "destinations_config.json"
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    return config["destinations"]


def query_nominatim(dest: dict, session) -> dict | None:
    """
    通过 OSM Nominatim API 查询单个目的地的地理信息。

    Args:
        dest: 目的地配置字典（含 query_osm, name 等）
        session: 共享的 requests.Session

    Returns:
        包含地理信息的 dict，失败返回 None
    """
    name = dest["name"]
    query = dest.get("query_osm", name)
    cache_name = f"nominatim_{name}"

    # 检查缓存
    if not is_cached("geography", cache_key(cache_name)):
        # 频率控制：仅在需要实际请求时 sleep
        import time
        time.sleep(REQUEST_INTERVAL)

    data = safe_request(
        logger=logger,
        url=NOMINATIM_URL,
        label=f"OSM Nominatim → {name}",
        subdir="geography",
        cache_name=cache_name,
        session=session,
        params={
            "q": query,
            "format": "json",
            "addressdetails": 1,
            "limit": 3,
            "accept-language": "zh",
        },
        timeout=30,
        sleep_seconds=0,  # safe_request 内部的 sleep，我们已在外层控制
    )

    return data


def parse_nominatim_result(raw_data: list | None, dest: dict) -> dict | None:
    """
    解析 Nominatim 返回的原始数据，提取结构化地理信息。

    Nominatim 返回格式示例：
    [{
        "place_id": ...,
        "lat": "24.14",
        "lon": "107.25",
        "display_name": "巴马瑶族自治县, 河池市, 广西壮族自治区, 中国",
        "address": {
            "county": "巴马瑶族自治县",
            "city": "河池市",
            "state": "广西壮族自治区",
            "country": "中国"
        },
        "type": "administrative",
        "importance": 0.5
    }]

    Args:
        raw_data: Nominatim API 原始返回
        dest: 目的地配置

    Returns:
        结构化的地理信息 dict，解析失败返回 None
    """
    if not raw_data or not isinstance(raw_data, list) or len(raw_data) == 0:
        logger.warning(f"[解析] {dest['name']} → Nominatim 返回空结果")
        return None

    # 取最佳匹配（第一个结果）
    best = raw_data[0]
    address = best.get("address", {})

    # 行政区划提取（兼容多种 Nominatim 地址格式）
    province = (
        address.get("state") or
        address.get("province") or
        address.get("region") or
        dest.get("province", "")
    )
    city = (
        address.get("city") or
        address.get("county") or
        address.get("town") or
        address.get("municipality") or
        dest.get("city", "")
    )

    # 坐标
    try:
        latitude = float(best.get("lat", 0))
        longitude = float(best.get("lon", 0))
    except (ValueError, TypeError):
        latitude = dest.get("latitude_approx", 0)
        longitude = dest.get("longitude_approx", 0)

    result = {
        "name": dest["name"],
        "province": province,
        "city": city,
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "altitude": dest.get("altitude_approx"),  # Nominatim 不保证返回海拔
        "osm_id": best.get("osm_id"),
        "osm_type": best.get("type"),
        "display_name": best.get("display_name", ""),
        "importance": best.get("importance", 0),
        "source": "OpenStreetMap Nominatim API (nominatim.openstreetmap.org)",
        "source_url": f"https://nominatim.openstreetmap.org/search?q={dest.get('query_osm', dest['name'])}&format=json",
    }

    return result


def collect_all_locations(destinations: list) -> list[dict]:
    """
    采集所有目的地的地理信息。

    Args:
        destinations: 目的地配置列表

    Returns:
        采集结果列表（仅包含成功的结果）
    """
    report = CollectionReport("collect_locations")
    session = create_session(retries=3, backoff_factor=2.0, timeout=30)
    results = []

    try:
        for i, dest in enumerate(destinations):
            name = dest["name"]
            logger.info(f"[{i+1}/{len(destinations)}] 采集地理信息: {name}")

            # 查询 Nominatim
            raw = query_nominatim(dest, session)
            if raw is None:
                report.record_failure(name, "Nominatim API 请求失败")
                # 使用配置中的近似坐标作为降级
                logger.warning(f"[降级] {name} → 使用配置文件中的近似坐标")
                fallback = {
                    "name": name,
                    "province": dest.get("province", ""),
                    "city": dest.get("city", ""),
                    "latitude": dest.get("latitude_approx", 0),
                    "longitude": dest.get("longitude_approx", 0),
                    "altitude": dest.get("altitude_approx"),
                    "osm_id": None,
                    "osm_type": None,
                    "display_name": "",
                    "importance": 0,
                    "source": "destinations_config.json (近似坐标，待 Nominatim 重试)",
                    "source_url": "",
                }
                results.append(fallback)
                continue

            # 解析结果
            parsed = parse_nominatim_result(raw, dest)
            if parsed is None:
                report.record_failure(name, "Nominatim 结果解析失败")
                continue

            results.append(parsed)
            report.record_success(name)
            logger.info(f"  → 坐标: ({parsed['latitude']}, {parsed['longitude']})")
            logger.info(f"  → 行政区: {parsed['province']} / {parsed['city']}")

    finally:
        session.close()

    # 保存结果
    save_json(results, OUTPUT_PATH, logger)

    # 打印报告
    report.print_summary(logger)

    # 保存报告到 logs
    save_json(report.summary(), LOGS_DIR / "collect_locations_report.json", logger)

    return results


# ══════════════════════════════════════════════════════════════
# 主入口
# ══════════════════════════════════════════════════════════════

def main():
    """主函数：采集全量目的地地理信息。"""
    logger.info("=" * 60)
    logger.info("collect_locations.py — 地理信息采集")
    logger.info(f"数据来源: OpenStreetMap Nominatim API")
    logger.info(f"请求间隔: {REQUEST_INTERVAL}s（遵守 OSM 速率限制）")
    logger.info("=" * 60)

    destinations = load_destinations_config()
    logger.info(f"待采集目的地: {len(destinations)} 个")
    for d in destinations:
        logger.info(f"  - {d['name']} ({d.get('province', '')})")

    results = collect_all_locations(destinations)
    logger.info(f"\n采集完成: {len(results)}/{len(destinations)} 个目的地地理信息已保存")
    logger.info(f"输出文件: {OUTPUT_PATH}")

    return results


if __name__ == "__main__":
    main()
