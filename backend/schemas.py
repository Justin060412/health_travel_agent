"""
AI 康养旅居助手 — Pydantic Schema
Task 5.1: 请求/响应数据模型
"""
from pydantic import BaseModel, Field


# ── 请求：用户问卷 ──────────────────────────────────────────

class QuestionnaireRequest(BaseModel):
    """用户填写的康养旅居偏好问卷"""
    age: int = Field(..., ge=18, le=100, description="年龄")
    monthly_budget: int = Field(..., ge=500, le=50000, description="月预算（元）")
    health_status: str = Field(
        ..., description="健康状况，如'健康'、'亚健康'、'有三高'、'关节不适'等"
    )
    climate_preference: str = Field(
        ..., description="气候偏好：避暑/避寒/温和/不挑剔"
    )
    activity_level: str = Field(
        default="轻度", description="活动量：轻度/中度/活跃"
    )
    additional_notes: str = Field(
        default="", description="补充说明（可选）"
    )


# ── 响应：推荐结果 ──────────────────────────────────────────

class RecommendationItem(BaseModel):
    """单条推荐目的地"""
    destination_id: int
    name: str
    province: str
    score: float
    reason: str = ""            # LLM 生成的推荐理由
    match_level: str = "一般"    # 匹配度：高/较高/一般


class RecommendationResponse(BaseModel):
    """AI 推荐接口完整响应"""
    recommendations: list[RecommendationItem]
    summary: str = ""            # LLM 生成的总体建议
