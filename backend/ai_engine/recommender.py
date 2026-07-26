"""
AI 康养旅居助手 — 推荐引擎
Task 5.3: 构建 Prompt → 调用 LLM → 解析结果 → 降级兜底
"""
import json
import logging

from ..database import get_connection
from ..models import row_to_destination
from ..schemas import QuestionnaireRequest, RecommendationItem, RecommendationResponse
from .provider import chat_completion

logger = logging.getLogger(__name__)

# 返回结果上限
TOP_N = 5


def _build_system_prompt(destinations_json: str) -> str:
    """构建系统提示词（数据驱动版 + 多维分析）"""
    return (
        "你是一位专业的康养旅居推荐顾问，拥有目的地真实环境数据（AQI、森林覆盖率、"
        "医疗等级、气温、海拔、预算等）。\n\n"
        "## 目的地数据（JSON 数组）\n"
        f"{destinations_json}\n\n"
        "## 推荐规则（严格遵循）\n"
        "1. 综合分析用户年龄、健康状况、预算、气候偏好，与每个目的地的真实环境数据交叉比对\n"
        "2. 严格返回恰好 5 个推荐，按匹配度从高到低排序\n"
        "3. 每个推荐需给出结构化理由，包含三部分：\n"
        "   【核心优势】— 1-2 句，说明该目的地最匹配用户需求的 3-5 个关键数据点（海拔/气温/AQI/森林覆盖/医疗等）\n"
        "   【注意事项】— 1 句，指出可能的不足或需要注意的点\n"
        "   【数据依据】— 列出支撑推荐的关键数据（年均气温、AQI、森林覆盖率、医疗等级、预算级别）\n"
        "4. 匹配度分为：高 / 较高 / 一般\n"
        "5. 总体建议（summary）需体现数据驱动分析思路：先总结用户核心需求，再概述推荐逻辑，100 字以内\n\n"
        "## 返回格式（只返回 JSON，不要其他文字）\n"
        '{"recommendations":['
        '{"destination_id":1,"match_level":"高","reason":"【核心优势】…\\n【注意事项】…\\n【数据依据】…"},'
        '...],'
        '"summary":"总体建议..."'
        "}"
    )


def _build_user_message(profile: QuestionnaireRequest) -> str:
    """将用户问卷转为自然语言（含健康+环境+预算三维分析请求）"""
    return (
        f"请根据以下用户信息，结合每个目的地的真实环境数据"
        f"（年均气温、AQI、森林覆盖率、医疗等级、海拔、预算级别），"
        f"推荐最合适的康养旅居目的地：\n"
        f"- 年龄：{profile.age} 岁\n"
        f"- 月预算：{profile.monthly_budget} 元\n"
        f"- 健康状况：{profile.health_status}\n"
        f"- 气候偏好：{profile.climate_preference}\n"
        f"- 活动量：{profile.activity_level}\n"
        f"- 补充说明：{profile.additional_notes or '无'}"
    )


def _parse_llm_response(raw_content: str, destinations_map: dict) -> list[RecommendationItem]:
    """解析 LLM 返回的 JSON，容错处理"""
    # 尝试提取 JSON（LLM 可能包裹在 ```json ... ``` 中）
    text = raw_content.strip()
    if "```" in text:
        # 去掉 markdown 代码块标记
        lines = text.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        text = "\n".join(lines)

    data = json.loads(text)
    items = []
    for item in data.get("recommendations", []):
        dest_id = item["destination_id"]
        dest = destinations_map.get(dest_id)
        if dest is None:
            continue
        items.append(RecommendationItem(
            destination_id=dest_id,
            name=dest["name"],
            province=dest["province"],
            score=dest["score"],
            match_level=item.get("match_level", "一般"),
            reason=item.get("reason", ""),
        ))
    return items[:TOP_N]


def _fallback_recommend(
    profile: QuestionnaireRequest,
    destinations: list[dict],
) -> RecommendationResponse:
    """规则兜底：按气候 + 海拔 + 预算 + 评分 + 环境数据做综合匹配"""
    def match_score(dest: dict) -> float:
        s = dest.get("score", 4.0)

        # 气候匹配（权重 1.0）
        altitude = dest.get("altitude", 0) or 0
        if profile.climate_preference == "避暑" and altitude >= 800:
            s += 1.0
        elif profile.climate_preference == "避寒" and altitude < 600:
            s += 1.0

        # 预算匹配（权重 0.5）
        low = dest.get("monthly_cost_low", 0) or 0
        high = dest.get("monthly_cost_high", 0) or 99999
        if low <= profile.monthly_budget <= high:
            s += 0.5
        elif profile.monthly_budget < low:
            s -= 0.5

        # 森林覆盖率奖励（权重 0.3）
        fc = dest.get("forest_coverage", "")
        if fc:
            try:
                pct = float(str(fc).replace("%", "").strip())
                if pct >= 80:
                    s += 0.3
            except (ValueError, TypeError):
                pass

        return s

    def build_fallback_reason(dest: dict) -> str:
        """使用真实环境数据生成结构化降级理由"""
        parts = []
        # 核心优势
        advantages = []
        altitude = dest.get("altitude", 0) or 0
        if altitude >= 1000:
            advantages.append(f"海拔{altitude}米，夏季凉爽宜居")
        elif altitude < 300:
            advantages.append(f"低海拔{altitude}米，适合关节不适人群")

        avg_temp = dest.get("average_temperature", "")
        if avg_temp:
            advantages.append(f"年均气温{avg_temp}")

        fc = dest.get("forest_coverage", "")
        if fc:
            advantages.append(f"森林覆盖率{fc}")

        aq = dest.get("air_quality", "")
        if aq:
            advantages.append(f"空气质量{aq}")

        ml = dest.get("medical_level", "")
        if ml:
            advantages.append(f"医疗{ml}")

        if advantages:
            parts.append("【核心优势】" + "，".join(advantages[:5]) + "。")

        # 注意事项
        if profile.climate_preference == "避暑" and altitude < 500:
            parts.append("【注意事项】海拔较低，夏季可能偏热。")
        elif profile.climate_preference == "避寒" and altitude > 1000:
            parts.append("【注意事项】海拔较高，冬季温度偏低。")

        # 数据依据
        data_items = []
        if avg_temp:
            data_items.append(f"年均气温{avg_temp}")
        if aq:
            data_items.append(f"AQI {aq}")
        if fc:
            data_items.append(f"森林覆盖{fc}")
        if ml:
            data_items.append(f"医疗{ml}")
        bl = dest.get("budget_level", "")
        if bl:
            data_items.append(f"预算{bl}")
        if data_items:
            parts.append("【数据依据】" + " | ".join(data_items))

        return "\n".join(parts) if parts else "根据您的偏好匹配（系统暂用规则推荐）"

    sorted_dest = sorted(destinations, key=match_score, reverse=True)
    items = []
    for d in sorted_dest[:TOP_N]:
        items.append(RecommendationItem(
            destination_id=d["id"],
            name=d["name"],
            province=d["province"],
            score=d["score"],
            match_level="一般",
            reason=build_fallback_reason(d),
        ))
    return RecommendationResponse(
        recommendations=items,
        summary=(
            f"AI 推荐服务暂时不可用，当前基于规则从 {len(destinations)} 个目的地中综合匹配"
            f"气候（{profile.climate_preference}）、预算（¥{profile.monthly_budget}/月）、"
            f"健康状况（{profile.health_status}）等因素，"
            f"得出以下基础推荐，仅供参考。"
        ),
    )


def get_recommendations(profile: QuestionnaireRequest) -> RecommendationResponse:
    """
    主入口：根据用户问卷推荐康养目的地。
    优先使用 LLM 智能推荐，失败时降级为规则匹配。
    """
    # 1. 加载全部目的地
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM destinations ORDER BY score DESC"
        ).fetchall()
        destinations = [row_to_destination(r).model_dump() for r in rows]
    finally:
        conn.close()

    # 构建 id → destination 映射（供解析用）
    destinations_map = {d["id"]: d for d in destinations}

    # 2. 准备目的地摘要（发送全套环境数据供 LLM 深度分析）
    brief = []
    for d in destinations:
        brief.append({
            "id": d["id"],
            "name": d["name"],
            "province": d["province"],
            "city": d.get("city", ""),
            "altitude": d["altitude"],
            "climate": d["climate"],
            "average_temperature": d.get("average_temperature", ""),
            "temperature_summer": d.get("temperature_summer", ""),
            "temperature_winter": d.get("temperature_winter", ""),
            "air_quality": d.get("air_quality", ""),
            "forest_coverage": d.get("forest_coverage", ""),
            "medical_level": d.get("medical_level", ""),
            "budget_level": d.get("budget_level", ""),
            "cost_range": f"{d['monthly_cost_low']}-{d['monthly_cost_high']}元/月",
            "monthly_cost_low": d["monthly_cost_low"],
            "monthly_cost_high": d["monthly_cost_high"],
            "suitable_for": d.get("suitable_for", ""),
            "best_season": d.get("best_season", ""),
            "features": d["features"],
            "score": d["score"],
        })
    destinations_json = json.dumps(brief, ensure_ascii=False)

    # 3. 调用 LLM
    try:
        result = chat_completion(
            system_prompt=_build_system_prompt(destinations_json),
            user_message=_build_user_message(profile),
        )
        raw_content = result["content"]
        print("[推荐引擎] 当前调用方式：DeepSeek [OK]")
        logger.info(f"LLM 推荐完成，token 用量: {result.get('usage', {})}")

        recommendations = _parse_llm_response(raw_content, destinations_map)
        # 尝试提取 summary
        text = raw_content.strip()
        if "```" in text:
            text = "\n".join([l for l in text.split("\n") if not l.startswith("```")])
        summary = json.loads(text).get("summary", "")
    except Exception as e:
        print(f"[推荐引擎] 当前调用方式：规则推荐 [FALLBACK]（原因: {e}）")
        logger.warning(f"LLM 推荐失败，降级为规则匹配: {e}")
        return _fallback_recommend(profile, destinations)

    return RecommendationResponse(
        recommendations=recommendations,
        summary=summary,
    )
