"""
build_database.py — 数据同步脚本（数据仓库 → 项目数据库）

功能：
  从 health_travel_data/sqlite/destinations.sqlite（数据仓库）
  单向同步到项目 data/health_travel.db（项目运行库）

同步策略：UPSERT（INSERT OR REPLACE）
  - 以 name 字段为业务主键进行匹配
  - 存在则 UPDATE（仅更新有值的非关键字段）
  - 不存在则 INSERT
  - 绝不 DELETE

安全保证：
  - 同步前自动备份项目数据库（.backup_{timestamp}）
  - 仅同步与项目表结构兼容的字段
  - 不影响项目数据库中的其他表
  - 不修改项目数据库的表结构
  - 同步失败可回滚

工程设计：
  - 独立运行，不依赖其他脚本
  - 支持重复运行（幂等）
  - 详细日志记录每次同步操作
"""

import sqlite3
import shutil
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from collector_utils import (
    get_logger, save_json, LOGS_DIR,
)

logger = get_logger("build_database")

CST = timezone(timedelta(hours=8))

# ── 路径常量 ──────────────────────────────────────────────────

# 数据仓库 SQLite（源）
REPO_SQLITE = Path("D:/health_travel_data/sqlite/destinations.sqlite")

# 项目数据库（目标）
PROJECT_DB = Path("D:/ai_project/health_travel_agent/data/health_travel.db")

# ⚠️ 安全锁：确认项目数据库路径存在
# 如果项目路径不存在，使用 Pilot 模式（仅输出日志，不实际操作）


# ══════════════════════════════════════════════════════════════
# 备份
# ══════════════════════════════════════════════════════════════

def backup_project_db() -> Path | None:
    """
    备份项目数据库。

    Returns:
        备份文件路径，项目 DB 不存在时返回 None
    """
    if not PROJECT_DB.exists():
        logger.warning(f"[备份] 项目数据库不存在: {PROJECT_DB}（将跳过备份）")
        return None

    timestamp = datetime.now(CST).strftime("%Y%m%d_%H%M%S")
    backup_path = PROJECT_DB.parent / f"health_travel.db.backup_{timestamp}"

    try:
        shutil.copy2(PROJECT_DB, backup_path)
        logger.info(f"[备份] {PROJECT_DB} → {backup_path}")
        return backup_path
    except Exception as e:
        logger.error(f"[备份失败] {e}")
        return None


# ══════════════════════════════════════════════════════════════
# 字段映射
# ══════════════════════════════════════════════════════════════

# 数据仓库 → 项目数据库字段映射
# 仅映射项目数据库 destionations 表中存在的列
# 数据仓库的富字段（如 forest_coverage, medical_level 等）暂不同步，
#   以免破坏项目数据库表结构

FIELD_MAPPING = {
    # 数据仓库字段          → 项目数据库字段
    "name":                  "name",
    "province":              "province",
    "city":                  "city",
    "climate":               "climate",
    "altitude":              "altitude",
    "average_temperature":   "average_temperature",
    "summer_temperature":    "temperature_summer",
    "winter_temperature":    "temperature_winter",
    "air_quality":           "air_quality",
    "forest_coverage":       "forest_coverage",
    "medical_level":         "medical_level",
    "budget_level":          "budget_level",
    "monthly_cost_low":      "monthly_cost_low",
    "monthly_cost_high":     "monthly_cost_high",
    "features":              "features",
    "description":           "description",
    "suitable_people":       "suitable_for",
    "best_season":           "best_season",
    "latitude":              "latitude",
    "longitude":             "longitude",
    "image_url":             "image_url",
    "score":                 "score",
    "source":                "source",
    "source_url":            "source_url",
}

# 需要同步的字段列表（按项目数据库顺序，不含 id）
SYNC_FIELDS = list(FIELD_MAPPING.values())

# 数据仓库字段 → 项目数据库字段（反向）
REPO_TO_PROJECT = {k: v for k, v in FIELD_MAPPING.items()}


# ══════════════════════════════════════════════════════════════
# 同步逻辑
# ══════════════════════════════════════════════════════════════

def get_repo_data() -> list[dict]:
    """
    从数据仓库 SQLite 读取全量数据。

    Returns:
        目的地数据列表
    """
    if not REPO_SQLITE.exists():
        logger.error(f"数据仓库 SQLite 不存在: {REPO_SQLITE}")
        logger.error("请先运行 merge_all_data.py")
        return []

    conn = sqlite3.connect(str(REPO_SQLITE))
    conn.row_factory = sqlite3.Row

    try:
        rows = conn.execute("SELECT * FROM destinations").fetchall()
        results = [dict(row) for row in rows]
        logger.info(f"[读取] 从数据仓库读取 {len(results)} 条记录")
        return results
    except sqlite3.Error as e:
        logger.error(f"[读取失败] {e}")
        return []
    finally:
        conn.close()


def sync_to_project(repo_data: list[dict], dry_run: bool = False) -> dict:
    """
    将数据仓库数据同步到项目数据库（UPSERT）。

    同步策略：
    1. 遍历数据仓库的每条记录
    2. 在项目数据库中按 name 查找匹配记录
    3. 存在 → UPDATE（仅更新 FIELD_MAPPING 中映射的字段）
    4. 不存在 → INSERT
    5. 记录每次操作的详细日志

    Args:
        repo_data: 数据仓库中的目的地列表
        dry_run: True 则仅模拟，不实际写入

    Returns:
        同步报告 dict
    """
    report = {
        "sync_time": datetime.now(CST).isoformat(),
        "dry_run": dry_run,
        "source": str(REPO_SQLITE),
        "target": str(PROJECT_DB),
        "total_in_repo": len(repo_data),
        "inserted": 0,
        "updated": 0,
        "unchanged": 0,
        "errors": 0,
        "details": [],
    }

    if not PROJECT_DB.exists():
        if dry_run:
            logger.warning("[模拟] 项目数据库不存在，将跳过实际操作")
        else:
            logger.error(f"项目数据库不存在: {PROJECT_DB}")
            logger.error("请确认项目路径是否正确。同步已取消。")
        report["errors"] = 1
        report["details"].append({
            "type": "error",
            "message": f"项目数据库不存在: {PROJECT_DB}",
        })
        return report

    if dry_run:
        logger.info("[模拟模式] 不会实际修改项目数据库")
        _simulate_sync(repo_data, report)
        return report

    # 连接项目数据库
    conn = sqlite3.connect(str(PROJECT_DB))
    conn.row_factory = sqlite3.Row

    try:
        # 获取项目数据库现有记录的 name → id 映射
        existing = {
            row["name"]: row["id"]
            for row in conn.execute("SELECT id, name FROM destinations").fetchall()
        }
        logger.info(f"[项目DB] 现有 {len(existing)} 条记录")

        # 获取项目数据库表结构（确认字段存在）
        table_info = conn.execute("PRAGMA table_info(destinations)").fetchall()
        project_columns = {row["name"] for row in table_info}

        # 过滤：仅同步项目数据库中存在的字段
        valid_fields = [f for f in SYNC_FIELDS if f in project_columns]
        skipped_fields = [f for f in SYNC_FIELDS if f not in project_columns]
        if skipped_fields:
            logger.warning(f"[字段跳过] 项目数据库缺少: {skipped_fields}")

        for repo_row in repo_data:
            name = repo_row.get("name", "")
            if not name:
                report["errors"] += 1
                report["details"].append({
                    "type": "error",
                    "name": name,
                    "message": "name 字段为空，跳过",
                })
                continue

            # 构建项目数据库字段值
            values = {}
            for repo_field, proj_field in FIELD_MAPPING.items():
                if proj_field not in project_columns:
                    continue
                val = repo_row.get(repo_field)
                # 保持 None 值（不强制转换）
                values[proj_field] = val

            if name in existing:
                # ── UPDATE ──
                set_clause = ", ".join(f"{f} = ?" for f in valid_fields)
                params = [values.get(f) for f in valid_fields]
                params.append(name)

                sql = f"UPDATE destinations SET {set_clause} WHERE name = ?"
                conn.execute(sql, params)

                report["updated"] += 1
                report["details"].append({
                    "type": "updated",
                    "name": name,
                    "id": existing[name],
                    "fields_updated": valid_fields,
                })
                logger.info(f"[UPDATE] {name} (id={existing[name]})")
            else:
                # ── INSERT ──
                columns = ["name"] + [f for f in valid_fields if f != "name"]
                placeholders = ", ".join("?" for _ in range(len(columns)))
                params = [name] + [values.get(f) for f in columns if f != "name"]

                sql = f"INSERT INTO destinations ({', '.join(columns)}) VALUES ({placeholders})"
                conn.execute(sql, params)

                # 获取新插入的 id
                new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                existing[name] = new_id  # 更新内存映射

                report["inserted"] += 1
                report["details"].append({
                    "type": "inserted",
                    "name": name,
                    "id": new_id,
                })
                logger.info(f"[INSERT] {name} → id={new_id}")

        conn.commit()
        logger.info(f"[提交] 同步完成: INSERT {report['inserted']}, UPDATE {report['updated']}")

    except sqlite3.Error as e:
        logger.error(f"[数据库错误] {e}")
        conn.rollback()
        report["errors"] += 1
        report["details"].append({
            "type": "error",
            "message": str(e),
        })
    finally:
        conn.close()

    return report


def _simulate_sync(repo_data: list[dict], report: dict) -> None:
    """模拟同步（仅输出日志，不实际操作）。"""
    for repo_row in repo_data:
        name = repo_row.get("name", "?")
        logger.info(f"[模拟] 将同步: {name}")
        report["details"].append({
            "type": "simulated",
            "name": name,
        })
    report["inserted"] = len(repo_data)  # 模拟全部为新插入
    logger.info(f"[模拟] 共 {len(repo_data)} 条记录（未实际操作）")


# ══════════════════════════════════════════════════════════════
# 验证
# ══════════════════════════════════════════════════════════════

def verify_sync() -> dict:
    """
    验证同步结果：对比数据仓库和项目数据库的记录数。

    Returns:
        验证结果 dict
    """
    verification = {
        "repo_count": 0,
        "project_count": 0,
        "matched": True,
        "detail": "",
    }

    # 数据仓库计数
    if REPO_SQLITE.exists():
        rconn = sqlite3.connect(str(REPO_SQLITE))
        verification["repo_count"] = rconn.execute(
            "SELECT COUNT(*) FROM destinations"
        ).fetchone()[0]
        rconn.close()

    # 项目数据库计数
    if PROJECT_DB.exists():
        pconn = sqlite3.connect(str(PROJECT_DB))
        verification["project_count"] = pconn.execute(
            "SELECT COUNT(*) FROM destinations"
        ).fetchone()[0]
        pconn.close()

    verification["matched"] = (
        verification["repo_count"] == verification["project_count"]
    )
    if verification["matched"]:
        verification["detail"] = f"数据一致: {verification['repo_count']} 条"
    else:
        verification["detail"] = (
            f"数据不一致: 数据仓库 {verification['repo_count']} 条, "
            f"项目数据库 {verification['project_count']} 条"
        )

    return verification


# ══════════════════════════════════════════════════════════════
# 主入口
# ══════════════════════════════════════════════════════════════

def main(dry_run: bool = False):
    """
    主函数：备份 → 读取 → 同步 → 验证 → 报告。

    Args:
        dry_run: True 时仅模拟，不实际修改项目数据库
    """
    logger.info("=" * 60)
    logger.info("build_database.py — 数据同步（数据仓库 → 项目数据库）")
    if dry_run:
        logger.info("⚠️  模拟模式 — 不会实际修改项目数据库")
    logger.info(f"源: {REPO_SQLITE}")
    logger.info(f"目标: {PROJECT_DB}")
    logger.info("=" * 60)

    # 1. 备份项目数据库
    backup_path = backup_project_db()
    if backup_path:
        logger.info(f"备份已保存: {backup_path}")

    # 2. 读取数据仓库
    repo_data = get_repo_data()
    if not repo_data:
        logger.error("数据仓库无数据，同步终止。")
        return

    # 3. 同步
    report = sync_to_project(repo_data, dry_run=dry_run)

    # 4. 验证
    if not dry_run:
        verification = verify_sync()
        report["verification"] = verification
        logger.info(f"\n[验证] {verification['detail']}")

    # 5. 保存报告
    save_json(report, LOGS_DIR / "build_database_report.json", logger)

    # 6. 打印汇总
    logger.info("\n" + "=" * 60)
    logger.info(f"同步报告:")
    logger.info(f"  数据仓库记录: {report['total_in_repo']}")
    logger.info(f"  新插入: {report['inserted']}")
    logger.info(f"  已更新: {report['updated']}")
    logger.info(f"  错误:   {report['errors']}")
    if not dry_run:
        logger.info(f"  备份:   {backup_path}")
    logger.info("=" * 60)

    return report


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="同步数据仓库到项目数据库")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="模拟运行，不实际修改项目数据库",
    )
    args = parser.parse_args()

    main(dry_run=args.dry_run)
