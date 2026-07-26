"""
update_all.py — 一键全流程数据更新

流水线：
  collect_locations.py     # 1. 地理信息采集
  collect_weather.py       # 2. 气候数据采集
  collect_air_quality.py   # 3. 空气质量采集
  collect_forest.py        # 4. 森林覆盖率采集
  collect_medical.py       # 5. 医疗资源采集
        │
        ▼
  merge_all_data.py        # 6. 合并 → JSON / GeoJSON / SQLite
        │
        ▼
  quality_check.py         # 7. 数据质量检查
        │
        ▼
  build_database.py        # 8. 同步到项目数据库
        │
        ▼
  生成最终报告              # 9. 汇总日志 + 统计

使用方式：
  python update_all.py              # 全量更新
  python update_all.py --skip-sync  # 跳过项目数据库同步
  python update_all.py --dry-run    # 模拟运行（build_database 使用 --dry-run）

工程设计：
  - 每步独立运行，失败不阻塞后续步骤
  - 汇总所有步骤的执行状态
  - 生成最终运行报告
"""

import subprocess
import sys
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from collector_utils import (
    BASE_DIR, LOGS_DIR,
    get_logger, save_json,
)

logger = get_logger("update_all")

CST = timezone(timedelta(hours=8))

SCRIPTS_DIR = Path(__file__).parent


# ══════════════════════════════════════════════════════════════
# 流水线定义
# ══════════════════════════════════════════════════════════════

PIPELINE = [
    {
        "step": 1,
        "name": "地理信息采集",
        "script": "collect_locations.py",
        "description": "从 OSM Nominatim API 采集坐标、行政区划、海拔",
        "required": True,  # 失败则终止后续步骤
    },
    {
        "step": 2,
        "name": "气候数据采集",
        "script": "collect_weather.py",
        "description": "从中国天气网/地方气象局公报采集气候与气温",
        "required": False,
    },
    {
        "step": 3,
        "name": "空气质量采集",
        "script": "collect_air_quality.py",
        "description": "从中国环境监测总站/地方生态环境局公报采集空气质量",
        "required": False,
    },
    {
        "step": 4,
        "name": "森林覆盖率采集",
        "script": "collect_forest.py",
        "description": "从国家林业和草原局/地方林业局公报采集森林覆盖率",
        "required": False,
    },
    {
        "step": 5,
        "name": "医疗资源采集",
        "script": "collect_medical.py",
        "description": "从国家卫健委/地方卫健委公开数据采集医疗水平",
        "required": False,
    },
    {
        "step": 6,
        "name": "数据合并与输出",
        "script": "merge_all_data.py",
        "description": "合并各维度数据 → JSON / GeoJSON / SQLite",
        "required": True,
    },
    {
        "step": 7,
        "name": "数据质量检查",
        "script": "quality_check.py",
        "description": "验证坐标、重复、空字段、GeoJSON、SQLite",
        "required": False,
    },
    {
        "step": 8,
        "name": "项目数据库同步",
        "script": "build_database.py",
        "description": "UPSERT 同步数据仓库 → 项目数据库",
        "required": False,
    },
]


# ══════════════════════════════════════════════════════════════
# 执行引擎
# ══════════════════════════════════════════════════════════════

def run_script(script_name: str, extra_args: list[str] = None) -> dict:
    """
    运行单个 Python 脚本并捕获结果。

    Args:
        script_name: 脚本文件名
        extra_args: 额外命令行参数

    Returns:
        {"success": bool, "stdout": str, "stderr": str, "returncode": int, "duration_s": float}
    """
    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        return {
            "success": False,
            "stdout": "",
            "stderr": f"脚本不存在: {script_path}",
            "returncode": -1,
            "duration_s": 0,
        }

    cmd = [sys.executable, str(script_path)]
    if extra_args:
        cmd.extend(extra_args)

    start = datetime.now(CST)
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=600,  # 10 分钟超时
            cwd=str(SCRIPTS_DIR),
        )
        duration = (datetime.now(CST) - start).total_seconds()
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout[-3000:],  # 截取最后 3000 字符
            "stderr": result.stderr[-1000:],
            "returncode": result.returncode,
            "duration_s": round(duration, 1),
        }
    except subprocess.TimeoutExpired:
        duration = (datetime.now(CST) - start).total_seconds()
        return {
            "success": False,
            "stdout": "",
            "stderr": "执行超时（> 10 分钟）",
            "returncode": -1,
            "duration_s": round(duration, 1),
        }
    except Exception as e:
        duration = (datetime.now(CST) - start).total_seconds()
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1,
            "duration_s": round(duration, 1),
        }


def run_pipeline(skip_sync: bool = False, dry_run: bool = False) -> dict:
    """
    执行完整数据流水线。

    Args:
        skip_sync: True 则跳过项目数据库同步（步骤 8）
        dry_run: True 则 build_database 使用模拟模式

    Returns:
        完整运行报告
    """
    report = {
        "pipeline": "update_all",
        "start_time": datetime.now(CST).isoformat(),
        "steps": [],
        "summary": {},
    }

    total_start = datetime.now(CST)
    stop_on_failure = False

    for step_def in PIPELINE:
        step_num = step_def["step"]
        step_name = step_def["name"]
        script = step_def["script"]
        required = step_def["required"]

        # 跳过项目数据库同步？
        if skip_sync and step_num == 8:
            logger.info(f"\n[跳过] 步骤 {step_num}: {step_name}（--skip-sync）")
            report["steps"].append({
                "step": step_num,
                "name": step_name,
                "script": script,
                "status": "skipped",
                "reason": "--skip-sync",
            })
            continue

        # 如果前面有 required 步骤失败，当前 required 步骤也跳过
        if stop_on_failure and required:
            logger.info(f"\n[终止] 步骤 {step_num}: {step_name}（前置必需步骤失败）")
            report["steps"].append({
                "step": step_num,
                "name": step_name,
                "script": script,
                "status": "aborted",
                "reason": "前置必需步骤失败",
            })
            break

        # 执行
        logger.info(f"\n{'=' * 60}")
        logger.info(f"[步骤 {step_num}/8] {step_name}")
        logger.info(f"  脚本: {script}")
        logger.info(f"  说明: {step_def['description']}")
        logger.info(f"  必需: {'是' if required else '否'}")
        logger.info(f"{'=' * 60}")

        extra_args = []
        if step_num == 8 and dry_run:
            extra_args = ["--dry-run"]

        result = run_script(script, extra_args)

        status = "success" if result["success"] else "failed"
        step_report = {
            "step": step_num,
            "name": step_name,
            "script": script,
            "status": status,
            "returncode": result["returncode"],
            "duration_s": result["duration_s"],
            "error": result["stderr"][:500] if not result["success"] else None,
        }
        report["steps"].append(step_report)

        if result["success"]:
            logger.info(f"✅ 步骤 {step_num} 完成 ({result['duration_s']}s)")
        else:
            logger.error(f"❌ 步骤 {step_num} 失败 ({result['duration_s']}s)")
            logger.error(f"   错误: {result['stderr'][:200]}")
            if required:
                stop_on_failure = True
                logger.error("   ⚠️ 必需步骤失败，后续必需步骤将跳过")

    # 汇总
    total_duration = (datetime.now(CST) - total_start).total_seconds()
    steps_status = [s["status"] for s in report["steps"]]
    success_count = steps_status.count("success")
    failed_count = steps_status.count("failed")
    skipped_count = steps_status.count("skipped") + steps_status.count("aborted")

    report["summary"] = {
        "end_time": datetime.now(CST).isoformat(),
        "total_duration_s": round(total_duration, 1),
        "total_steps": len(PIPELINE),
        "success": success_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "overall": (
            "SUCCESS" if failed_count == 0
            else "PARTIAL" if success_count > 0
            else "FAILED"
        ),
    }

    return report


# ══════════════════════════════════════════════════════════════
# 报告输出
# ══════════════════════════════════════════════════════════════

def print_final_report(report: dict) -> None:
    """打印最终运行报告。"""
    s = report["summary"]

    logger.info("\n\n")
    logger.info("╔" + "═" * 58 + "╗")
    logger.info("║" + "  AI康养旅居助手 — 数据仓库更新报告".ljust(50) + "║")
    logger.info("╠" + "═" * 58 + "╣")
    logger.info(f"║  开始时间: {report['start_time']}".ljust(50) + "║")
    logger.info(f"║  结束时间: {s['end_time']}".ljust(50) + "║")
    logger.info(f"║  总耗时:   {s['total_duration_s']:.1f}s".ljust(50) + "║")
    logger.info("╠" + "═" * 58 + "╣")

    for step in report["steps"]:
        status_icon = {
            "success": "✅",
            "failed": "❌",
            "skipped": "⏭️",
            "aborted": "🚫",
        }.get(step["status"], "❓")

        line = f"║  {status_icon} 步骤{step['step']}: {step['name']}"
        if step.get("duration_s"):
            line += f" ({step['duration_s']}s)"
        logger.info(line.ljust(50) + "║")

    logger.info("╠" + "═" * 58 + "╣")
    logger.info(f"║  成功: {s['success']}  |  失败: {s['failed']}  |  跳过: {s['skipped']}".ljust(50) + "║")
    logger.info(f"║  总体状态: {s['overall']}".ljust(50) + "║")
    logger.info("╚" + "═" * 58 + "╝")

    # 输出文件清单
    logger.info("\n输出文件:")
    outputs = [
        ("JSON", BASE_DIR / "json" / "destinations.json"),
        ("GeoJSON", BASE_DIR / "geojson" / "destinations.geojson"),
        ("SQLite", BASE_DIR / "sqlite" / "destinations.sqlite"),
        ("质量报告", LOGS_DIR / "quality_report.json"),
        ("统计报告", LOGS_DIR / "dataset_statistics.json"),
        ("数据来源", LOGS_DIR / "data_sources.md"),
    ]
    for label, path in outputs:
        exists = "✓" if path.exists() else "✗"
        logger.info(f"  [{exists}] {label}: {path}")


# ══════════════════════════════════════════════════════════════
# 主入口
# ══════════════════════════════════════════════════════════════

def main():
    """主函数：解析参数 → 执行流水线 → 输出报告。"""
    import argparse

    parser = argparse.ArgumentParser(
        description="AI康养旅居助手 — 数据仓库一键更新",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python update_all.py                 # 全量更新
  python update_all.py --skip-sync     # 跳过项目数据库同步
  python update_all.py --dry-run       # 模拟运行
        """,
    )
    parser.add_argument(
        "--skip-sync",
        action="store_true",
        help="跳过项目数据库同步（仅更新数据仓库）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="模拟模式（build_database 不实际写入）",
    )
    args = parser.parse_args()

    logger.info("╔" + "═" * 58 + "╗")
    logger.info("║" + "  AI康养旅居助手 — 数据仓库更新流水线".ljust(42) + "║")
    logger.info("║" + f"  启动时间: {datetime.now(CST).strftime('%Y-%m-%d %H:%M:%S')}".ljust(42) + "║")
    if args.skip_sync:
        logger.info("║" + "  ⚠️  跳过项目数据库同步".ljust(42) + "║")
    if args.dry_run:
        logger.info("║" + "  ⚠️  模拟模式".ljust(42) + "║")
    logger.info("╚" + "═" * 58 + "╝")

    # 执行流水线
    report = run_pipeline(skip_sync=args.skip_sync, dry_run=args.dry_run)

    # 保存报告
    save_json(report, LOGS_DIR / "update_all_report.json", logger)

    # 打印最终报告
    print_final_report(report)

    # 返回退出码
    if report["summary"]["overall"] == "FAILED":
        sys.exit(1)


if __name__ == "__main__":
    main()
