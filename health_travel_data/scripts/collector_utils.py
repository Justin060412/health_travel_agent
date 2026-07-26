"""
数据采集工具模块 — 为所有 collect_xxx.py 脚本提供公共基础设施。

功能：
- HTTP 请求（含 Retry / Timeout / Sleep / User-Agent）
- 缓存读写（raw/ 目录，支持断点续跑）
- 日志记录（logs/ 目录，含时间戳）
- 异常隔离（单源失败不传播）
"""

import json
import os
import time
import hashlib
import logging
import traceback
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ── 路径常量 ──────────────────────────────────────────────────

BASE_DIR = Path("D:/health_travel_data")
RAW_DIR = BASE_DIR / "raw"
PROCESSED_DIR = BASE_DIR / "processed"
LOGS_DIR = BASE_DIR / "logs"
SCRIPTS_DIR = BASE_DIR / "scripts"

# 北京时间时区
CST = timezone(timedelta(hours=8))

# ── 日志配置 ──────────────────────────────────────────────────

_loggers: dict[str, logging.Logger] = {}


def get_logger(name: str) -> logging.Logger:
    """
    获取带时间戳的日志记录器。

    日志同时输出到：
    1. 控制台（INFO 级别）
    2. 文件 logs/{name}_{timestamp}.log（DEBUG 级别）

    Args:
        name: 脚本名称（如 "collect_locations"）

    Returns:
        配置好的 Logger 实例
    """
    if name in _loggers:
        return _loggers[name]

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # 控制台 handler
    if not logger.handlers:
        console = logging.StreamHandler()
        console.setLevel(logging.INFO)
        console.setFormatter(logging.Formatter(
            "[%(levelname)s] %(message)s"
        ))
        logger.addHandler(console)

        # 文件 handler
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(CST).strftime("%Y%m%d_%H%M%S")
        log_file = LOGS_DIR / f"{name}_{timestamp}.log"
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
        logger.addHandler(file_handler)

    _loggers[name] = logger
    return logger


# ── 请求会话 ──────────────────────────────────────────────────

def create_session(
    retries: int = 3,
    backoff_factor: float = 1.0,
    timeout: int = 30,
) -> requests.Session:
    """
    创建带重试机制的 requests.Session。

    Args:
        retries: 最大重试次数
        backoff_factor: 指数退避因子（第 n 次重试延迟 = backoff_factor * 2^n 秒）
        timeout: 请求超时（秒）

    Returns:
        配置好的 Session 实例
    """
    session = requests.Session()

    # User-Agent（严格遵循 OSM Nominatim 使用规范）
    # 参考: https://operations.osmfoundation.org/policies/nominatim/
    # 注意：OSM 要求 User-Agent 必须包含应用名称和有效联系方式，
    #       使用虚假邮箱或默认 UA 会返回 403 Forbidden。
    session.headers.update({
        "User-Agent": (
            "HealthTravelDataRepository/1.0 "
            "(Shanghai Normal University, School of Environmental "
            "and Geographical Sciences; academic GIS research project; "
            "https://github.com/shnu/health-travel-platform)"
        ),
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })

    # 重试策略
    retry_strategy = Retry(
        total=retries,
        backoff_factor=backoff_factor,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "HEAD"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    # 默认超时
    session.timeout = timeout

    return session


# ── 缓存机制 ──────────────────────────────────────────────────

def cache_key(*args: str) -> str:
    """
    基于参数生成缓存文件名（MD5 哈希）。

    Args:
        args: 用于生成 key 的字符串参数

    Returns:
        32 位 MD5 哈希字符串
    """
    raw = "|".join(args)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def read_cache(subdir: str, key: str) -> Optional[Any]:
    """
    读取缓存数据。

    Args:
        subdir: raw/ 下的子目录名（如 "geography"）
        key: 缓存键（通常由 cache_key() 生成）

    Returns:
        缓存的数据，不存在时返回 None
    """
    cache_path = RAW_DIR / subdir / f"{key}.json"
    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
    return None


def write_cache(subdir: str, key: str, data: Any) -> None:
    """
    写入缓存数据。

    Args:
        subdir: raw/ 下的子目录名
        key: 缓存键
        data: 要缓存的数据（必须可 JSON 序列化）
    """
    cache_dir = RAW_DIR / subdir
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{key}.json"
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def is_cached(subdir: str, key: str) -> bool:
    """检查缓存是否存在。"""
    return (RAW_DIR / subdir / f"{key}.json").exists()


# ── 安全请求封装 ──────────────────────────────────────────────

def safe_request(
    logger: logging.Logger,
    url: str,
    label: str,
    subdir: str,
    cache_name: str,
    session: Optional[requests.Session] = None,
    params: Optional[dict] = None,
    sleep_seconds: float = 1.5,
    timeout: int = 30,
    force_refresh: bool = False,
) -> Optional[dict]:
    """
    安全执行 HTTP GET 请求，带缓存、重试、超时、异常隔离。

    执行流程：
    1. 检查 raw/ 缓存 → 命中则直接返回
    2. 发送 HTTP GET（含 Retry + Timeout）
    3. 成功后写入 raw/ 缓存
    4. 失败则记录日志并返回 None（不抛异常）

    Args:
        logger: 日志记录器
        url: 请求 URL
        label: 人类可读的标签（用于日志）
        subdir: raw/ 子目录
        cache_name: 缓存文件名键
        session: 请求会话（不传则创建新的）
        params: URL 查询参数
        sleep_seconds: 请求前等待秒数（频率控制）
        timeout: 请求超时（秒）
        force_refresh: 为 True 时跳过缓存，强制重新请求

    Returns:
        响应 JSON dict，失败时返回 None
    """
    cache_k = cache_key(cache_name)

    # 检查缓存
    if not force_refresh and is_cached(subdir, cache_k):
        logger.info(f"[缓存命中] {label}")
        return read_cache(subdir, cache_k)

    # 频率控制
    if sleep_seconds > 0:
        time.sleep(sleep_seconds)

    # 发起请求
    sess = session or create_session(timeout=timeout)
    try:
        logger.info(f"[请求] {label} → {url[:100]}...")
        resp = sess.get(url, params=params, timeout=timeout)
        resp.raise_for_status()

        # 尝试解析 JSON
        data = resp.json()
        write_cache(subdir, cache_k, data)
        logger.info(f"[成功] {label} → 已缓存")
        return data

    except requests.exceptions.Timeout:
        logger.error(f"[超时] {label} → 请求超过 {timeout}s")
        return None
    except requests.exceptions.ConnectionError as e:
        logger.error(f"[连接失败] {label} → {e}")
        return None
    except requests.exceptions.HTTPError as e:
        logger.error(f"[HTTP错误] {label} → {e}")
        return None
    except json.JSONDecodeError:
        logger.error(f"[解析失败] {label} → 响应不是有效 JSON")
        return None
    except Exception:
        logger.error(f"[未知错误] {label} → {traceback.format_exc()}")
        return None
    finally:
        if session is None:
            sess.close()


# ── 数据保存 ──────────────────────────────────────────────────

def save_json(data: Any, filepath: Path, logger: Optional[logging.Logger] = None) -> bool:
    """
    保存 JSON 数据到文件。

    Args:
        data: 要保存的数据
        filepath: 目标路径
        logger: 可选日志记录器

    Returns:
        是否保存成功
    """
    try:
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if logger:
            logger.info(f"[保存] {filepath}")
        return True
    except Exception as e:
        if logger:
            logger.error(f"[保存失败] {filepath} → {e}")
        return False


def load_json(filepath: Path) -> Optional[Any]:
    """从文件加载 JSON 数据。"""
    try:
        if filepath.exists():
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return None


# ── 异常隔离器 ────────────────────────────────────────────────

def collect_with_fallback(
    logger: logging.Logger,
    label: str,
    collector_func,
    *args,
    **kwargs,
) -> Optional[Any]:
    """
    执行采集函数，异常时返回 None 而不终止程序。

    Args:
        logger: 日志记录器
        label: 人类可读标签
        collector_func: 采集函数
        *args, **kwargs: 传给采集函数的参数

    Returns:
        采集结果，失败时返回 None
    """
    try:
        return collector_func(*args, **kwargs)
    except Exception:
        logger.error(f"[采集异常] {label}\n{traceback.format_exc()}")
        return None


# ── 采集报告 ──────────────────────────────────────────────────

class CollectionReport:
    """采集运行报告，汇总成功/失败统计。"""

    def __init__(self, script_name: str):
        self.script_name = script_name
        self.start_time = datetime.now(CST)
        self.total = 0
        self.success = 0
        self.failed = 0
        self.failures: list[dict] = []

    def record_success(self, label: str) -> None:
        self.total += 1
        self.success += 1

    def record_failure(self, label: str, reason: str) -> None:
        self.total += 1
        self.failed += 1
        self.failures.append({
            "label": label,
            "reason": reason,
            "timestamp": datetime.now(CST).isoformat(),
        })

    def summary(self) -> dict:
        elapsed = (datetime.now(CST) - self.start_time).total_seconds()
        return {
            "script": self.script_name,
            "start_time": self.start_time.isoformat(),
            "elapsed_seconds": elapsed,
            "total": self.total,
            "success": self.success,
            "failed": self.failed,
            "failures": self.failures,
        }

    def print_summary(self, logger: logging.Logger) -> None:
        s = self.summary()
        logger.info("=" * 60)
        logger.info(f"[报告] {s['script']}")
        logger.info(f"  总耗时: {s['elapsed_seconds']:.1f}s")
        logger.info(f"  总计: {s['total']}  |  成功: {s['success']}  |  失败: {s['failed']}")
        if s["failures"]:
            logger.info(f"  失败详情:")
            for f in s["failures"]:
                logger.info(f"    - {f['label']}: {f['reason']}")
        logger.info("=" * 60)
