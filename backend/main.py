"""
AI 康养旅居助手 — FastAPI 应用入口
Task 2: 最小可运行后端服务
Task 3.5: 集成数据库初始化 + 种子数据自动插入
Task 4:   GET /api/destinations 目的地列表接口
Task 5:   POST /api/recommend AI 推荐接口
"""
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db, get_connection
from .models import row_to_destination
from .schemas import QuestionnaireRequest, RecommendationResponse
from .seed_data import seed_if_empty
from .ai_engine.recommender import get_recommendations


# ── 应用生命周期 ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化数据库并插入种子数据"""
    init_db()
    seeded = seed_if_empty()
    if seeded > 0:
        print(f"[启动] 已插入 {seeded} 条种子目的地数据")
    else:
        print("[启动] 数据库已存在数据，跳过种子插入")
    yield


app = FastAPI(title="AI康养旅居助手", lifespan=lifespan)

# 允许前端跨域访问（开发阶段宽松，上线前收紧）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 路由 ──────────────────────────────────────────────────────

@app.get("/")
def home():
    """首页 — 验证服务是否启动成功"""
    return {"message": "AI康养旅居助手启动成功！"}


@app.get("/api/destinations")
def get_destinations(
    province: Optional[str] = Query(None, description="按省份筛选，如'云南'"),
    climate:  Optional[str] = Query(None, description="按气候筛选，如'高原季风气候'"),
    search:   Optional[str] = Query(None, description="名称模糊搜索"),
):
    """
    获取康养目的地列表。
    - 无参数时返回全部目的地
    - 可选 province / climate 精确筛选 + search 模糊搜索
    """
    conn = get_connection()
    try:
        sql = "SELECT * FROM destinations WHERE 1=1"
        params = []

        if province:
            sql += " AND province LIKE ?"
            params.append(f"%{province}%")
        if climate:
            sql += " AND climate LIKE ?"
            params.append(f"%{climate}%")
        if search:
            sql += " AND (name LIKE ? OR description LIKE ? OR features LIKE ?)"
            like = f"%{search}%"
            params.extend([like, like, like])

        sql += " ORDER BY score DESC"

        rows = conn.execute(sql, params).fetchall()
        destinations = [row_to_destination(r).model_dump() for r in rows]
        return {"count": len(destinations), "results": destinations}
    finally:
        conn.close()


@app.post("/api/recommend", response_model=RecommendationResponse)
def recommend(profile: QuestionnaireRequest):
    """
    AI 推荐康养旅居目的地。

    接收用户问卷（年龄、预算、健康状况、气候偏好等），
    调用 LLM 智能匹配最合适的康养目的地（失败时自动降级为规则匹配）。
    返回 5 个推荐结果 + 总体建议。
    """
    return get_recommendations(profile)
