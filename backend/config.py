"""
AI 康养旅居助手 — 配置模块
Task 3.1: 数据库路径 + 项目配置
Task 5:    .env 环境变量加载
"""
import os
from dotenv import load_dotenv

# 项目根目录（backend 的父目录）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 加载 .env 文件（优先找 backend/.env，其次项目根）
_env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(_env_path)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# SQLite 数据库文件路径
DATABASE_PATH = os.path.join(BASE_DIR, "data", "health_travel.db")

# 确保 data 目录存在
os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

# ── AI 模型配置（从 .env 读取）──────────────────────────────

LLM_API_KEY = os.getenv("API_KEY", "")
LLM_BASE_URL = os.getenv("BASE_URL", "https://api.deepseek.com/v1")
LLM_MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-chat")
