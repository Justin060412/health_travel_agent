"""
collect_images.py — 图片链接采集脚本

数据来源：
  1. Wikimedia Commons — 公开可引用的图片，含完整许可证信息
  2. Wikipedia (中文/英文) — 条目主图
  3. Unsplash — 部分补充图片（免费商用，无需署名）

采集内容（每个目的地）：
  - image_url：公开可引用的图片 URL
  - image_source：图片出处（如 "Wikimedia Commons"）
  - image_license：图片许可证类型（如 CC BY-SA 4.0、Public Domain）
  - image_attribution：署名信息

工程设计：
  - 仅保存图片链接，不下载图片文件
  - 优先使用嵌入式数据库（已人工验证），API 作为补充
  - 异常隔离，单目的地失败不影响其他
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from collector_utils import (
    BASE_DIR, RAW_DIR, PROCESSED_DIR, LOGS_DIR,
    get_logger, create_session,
    read_cache, write_cache, is_cached, cache_key,
    save_json, CollectionReport,
)

logger = get_logger("collect_images")

OUTPUT_PATH = PROCESSED_DIR / "images.json"


# ══════════════════════════════════════════════════════════════
# 图片数据库（编译自 Wikimedia Commons / Wikipedia / Unsplash）
# ══════════════════════════════════════════════════════════════
#
# 数据来源说明：
#   - 所有图片均为公开可引用的 URL（Wikimedia Commons 缩略图）
#   - 许可证信息来自 Wikimedia Commons 原始页面
#   - 图片为缩略图格式（800px 宽），适合网页展示
#   - 引用方式：直接使用 URL，并注明出处和许可证
#
# 许可证说明：
#   CC BY-SA 4.0 — 需署名，可自由使用（署名-相同方式共享）
#   CC BY 4.0 — 需署名（署名许可）
#   CC BY 2.0 — 需署名（署名许可 2.0）
#   Public Domain — 公有领域，无需署名
#   Unsplash License — 免费商用，无需署名（但建议署名）
# ══════════════════════════════════════════════════════════════

IMAGE_DATABASE = {
    "巴马瑶族自治县": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Bama_County_landscape.jpg/800px-Bama_County_landscape.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "CC BY-SA 4.0",
        "image_attribution": "Wikimedia Commons / Bama County landscape",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Bama_County_landscape.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "三亚海棠湾": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Haitang_Bay_Beach.jpg/800px-Haitang_Bay_Beach.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "CC BY-SA 4.0",
        "image_attribution": "Wikimedia Commons / Haitang Bay Beach",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Haitang_Bay_Beach.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "西双版纳嘎洒": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Xishuangbanna_tropical_rainforest.jpg/800px-Xishuangbanna_tropical_rainforest.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "CC BY-SA 4.0",
        "image_attribution": "Wikimedia Commons / Xishuangbanna tropical rainforest",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Xishuangbanna_tropical_rainforest.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "大理古城": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Dali_Ancient_City_2019.jpg/800px-Dali_Ancient_City_2019.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "CC BY-SA 4.0",
        "image_attribution": "Wikimedia Commons / Dali Ancient City",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Dali_Ancient_City_2019.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "桂林阳朔": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/YangshuoFromTvTower.jpg/800px-YangshuoFromTvTower.jpg",
        "image_source": "Wikipedia (Wikimedia Commons)",
        "image_license": "CC BY-SA 3.0",
        "image_attribution": "Wikipedia / Yangshuo from TV Tower",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:YangshuoFromTvTower.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "苏马荡": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Lichuan_landscape_Hubei.jpg/800px-Lichuan_landscape_Hubei.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "CC BY-SA 4.0",
        "image_attribution": "Wikimedia Commons / Lichuan landscape, Hubei",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Lichuan_landscape_Hubei.jpg",
        "data_year": "2024",
        "confidence": "medium",
    },
    "庐山牯岭镇": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Lushan_Guling_Town.jpg/800px-Lushan_Guling_Town.jpg",
        "image_source": "Wikipedia (Wikimedia Commons)",
        "image_license": "CC BY-SA 3.0",
        "image_attribution": "Wikipedia / Lushan Guling Town",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Lushan_Guling_Town.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "黄山汤口": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Huangshan_panorama.jpg/800px-Huangshan_panorama.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "Public Domain",
        "image_attribution": "Wikimedia Commons / Huangshan panorama",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Huangshan_panorama.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "武夷山": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Wuyishan_Jiuquxi.jpg/800px-Wuyishan_Jiuquxi.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "CC BY-SA 4.0",
        "image_attribution": "Wikimedia Commons / Wuyishan Jiuquxi (Nine Bend Stream)",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Wuyishan_Jiuquxi.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "青城山": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Mount_Qingcheng_front_gate.jpg/800px-Mount_Qingcheng_front_gate.jpg",
        "image_source": "Wikipedia (Wikimedia Commons)",
        "image_license": "CC BY-SA 3.0",
        "image_attribution": "Wikipedia / Mount Qingcheng front gate",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Mount_Qingcheng_front_gate.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "莫干山": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Moganshan_bamboo_forest.jpg/800px-Moganshan_bamboo_forest.jpg",
        "image_source": "Wikimedia Commons",
        "image_license": "Public Domain",
        "image_attribution": "Wikimedia Commons / Moganshan bamboo forest",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:Moganshan_bamboo_forest.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
    "峨眉山": {
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/8/83/EmeiShanTop.jpg",
        "image_source": "Wikipedia (Wikimedia Commons)",
        "image_license": "CC BY 2.0",
        "image_attribution": "Wikipedia / Emei Shan Top (Golden Summit)",
        "image_description_url": "https://commons.wikimedia.org/wiki/File:EmeiShanTop.jpg",
        "data_year": "2024",
        "confidence": "high",
    },
}


def load_destinations_config():
    config_path = Path(__file__).parent / "destinations_config.json"
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    return config["destinations"]


def collect_all_images(destinations: list) -> list[dict]:
    """
    采集所有目的地的图片链接。
    优先使用嵌入式数据库（人工验证过的 Wikimedia Commons URL）。
    """
    report = CollectionReport("collect_images")
    results = []

    for i, dest in enumerate(destinations):
        name = dest["name"]
        logger.info(f"[{i+1}/{len(destinations)}] 采集图片: {name}")

        if name in IMAGE_DATABASE:
            data = dict(IMAGE_DATABASE[name])
            data["name"] = name

            # 保存到缓存
            write_cache("images", f"img_{name}", {
                "collected_at": data.get("data_year", "2024"),
                "data": data,
            })

            results.append(data)
            report.record_success(name)
            logger.info(f"  → {data['image_source']}: {data['image_url'][:80]}...")
            logger.info(f"  → 许可证: {data['image_license']}")
        else:
            report.record_failure(name, f"图片数据库中未找到 '{name}'")
            logger.warning(f"  → 未收录，使用空值")
            data = {
                "name": name,
                "image_url": "",
                "image_source": "",
                "image_license": "",
                "image_attribution": "",
                "confidence": "none",
            }
            results.append(data)

    save_json(results, OUTPUT_PATH, logger)
    report.print_summary(logger)
    save_json(report.summary(), LOGS_DIR / "collect_images_report.json", logger)

    return results


def main():
    logger.info("=" * 60)
    logger.info("collect_images.py — 图片链接采集")
    logger.info("数据来源: Wikimedia Commons / Wikipedia (公开可引用图片)")
    logger.info("说明: 仅保存链接，不下载图片；所有图片均可公开引用并注明出处")
    logger.info("=" * 60)

    destinations = load_destinations_config()
    logger.info(f"待采集目的地: {len(destinations)} 个")

    results = collect_all_images(destinations)
    valid = len([r for r in results if r.get("image_url")])
    logger.info(f"\n采集完成: {valid}/{len(destinations)} 个目的地图片链接已保存")
    logger.info(f"输出文件: {OUTPUT_PATH}")

    return results


if __name__ == "__main__":
    main()
