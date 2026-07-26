"""
AI 康养旅居助手 — 数据库模块
Task 3.2: SQLite 连接管理 + 建表
"""
import sqlite3
from .config import DATABASE_PATH

# 建表 SQL
CREATE_DESTINATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS destinations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,            -- 目的地名称
    province        TEXT    NOT NULL,            -- 省份
    climate         TEXT    NOT NULL,            -- 气候类型
    altitude        INTEGER,                    -- 海拔（米）
    temperature_summer TEXT,                    -- 夏季气温范围
    temperature_winter TEXT,                    -- 冬季气温范围
    air_quality     TEXT,                       -- 空气质量等级
    monthly_cost_low  INTEGER,                  -- 月最低消费（元）
    monthly_cost_high INTEGER,                  -- 月最高消费（元）
    features        TEXT    NOT NULL,            -- 特色标签（JSON数组字符串）
    description     TEXT    NOT NULL,            -- 描述
    suitable_for    TEXT,                       -- 适合人群
    best_season     TEXT,                       -- 最佳季节
    latitude        REAL    NOT NULL,            -- 纬度
    longitude       REAL    NOT NULL,            -- 经度
    image_url       TEXT,                       -- 图片URL
    score           REAL    DEFAULT 4.0         -- 综合评分
);
"""


def get_connection() -> sqlite3.Connection:
    """获取数据库连接（自动启用 WAL 模式和 foreign keys）"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """初始化数据库：创建所有表（仅首次运行生效）"""
    conn = get_connection()
    try:
        conn.execute(CREATE_DESTINATIONS_TABLE)
        conn.commit()
    finally:
        conn.close()


def table_exists(table_name: str) -> bool:
    """检查表是否存在且包含数据"""
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        )
        return cursor.fetchone()[0] > 0
    finally:
        conn.close()


def count_rows(table_name: str) -> int:
    """统计表的行数"""
    conn = get_connection()
    try:
        cursor = conn.execute(f"SELECT COUNT(*) FROM {table_name}")
        return cursor.fetchone()[0]
    finally:
        conn.close()
