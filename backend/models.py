"""
AI 康养旅居助手 — 数据模型
Task 3.3: Pydantic 模型，与 destinations 表结构对应
"""
from pydantic import BaseModel


class DestinationBase(BaseModel):
    """目的地基础字段 — 与 health_travel_data 数据仓库字段对齐"""
    # 基础信息
    name: str
    province: str
    city: str | None = None                          # 城市/县级市（新增）
    climate: str
    altitude: int | None = None
    latitude: float
    longitude: float

    # 气候与气温
    temperature_summer: str | None = None             # 夏季气温范围
    temperature_winter: str | None = None             # 冬季气温范围
    average_temperature: str | None = None            # 年均气温（新增）

    # 环境与生态
    air_quality: str | None = None
    forest_coverage: str | None = None                # 森林覆盖率（新增）

    # 医疗资源
    medical_level: str | None = None                  # 医疗等级（新增）

    # 消费与预算
    monthly_cost_low: int | None = None
    monthly_cost_high: int | None = None
    budget_level: str | None = None                   # 预算级别（新增）

    # 特色与描述
    features: str          # JSON 数组字符串，如 '["避暑","森林康养"]'
    description: str
    suitable_for: str | None = None
    best_season: str | None = None

    # 图片
    image_url: str | None = None
    image_source: str | None = None                   # 图片来源（新增）
    image_license: str | None = None                  # 图片许可证（新增）

    # 评分与来源
    score: float = 4.0
    source: str | None = None                         # 数据来源说明（新增）
    source_url: str | None = None                     # 数据来源 URL（新增）


class Destination(DestinationBase):
    """数据库返回的完整目的地模型"""
    id: int

    class Config:
        from_attributes = True


# 兼容 SQLite Row 对象的构造方式
def row_to_destination(row) -> Destination:
    """将 sqlite3.Row 转换为 Destination 模型（映射全部 25 个字段）"""
    return Destination(
        # 基础
        id=row["id"],
        name=row["name"],
        province=row["province"],
        city=row["city"] if "city" in row.keys() else None,
        climate=row["climate"],
        altitude=row["altitude"],
        latitude=row["latitude"],
        longitude=row["longitude"],

        # 气候与气温
        temperature_summer=row["temperature_summer"],
        temperature_winter=row["temperature_winter"],
        average_temperature=row["average_temperature"] if "average_temperature" in row.keys() else None,

        # 环境与生态
        air_quality=row["air_quality"],
        forest_coverage=row["forest_coverage"] if "forest_coverage" in row.keys() else None,

        # 医疗资源
        medical_level=row["medical_level"] if "medical_level" in row.keys() else None,

        # 消费与预算
        monthly_cost_low=row["monthly_cost_low"],
        monthly_cost_high=row["monthly_cost_high"],
        budget_level=row["budget_level"] if "budget_level" in row.keys() else None,

        # 特色与描述
        features=row["features"],
        description=row["description"],
        suitable_for=row["suitable_for"],
        best_season=row["best_season"],

        # 图片
        image_url=row["image_url"],
        image_source=row["image_source"] if "image_source" in row.keys() else None,
        image_license=row["image_license"] if "image_license" in row.keys() else None,

        # 评分与来源
        score=row["score"],
        source=row["source"] if "source" in row.keys() else None,
        source_url=row["source_url"] if "source_url" in row.keys() else None,
    )
