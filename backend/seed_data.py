"""
AI 康养旅居助手 — 种子数据
Task 3.4: 12 个康养旅居目的地预设数据

数据来源说明：
- 坐标使用百度/高德公开坐标
- 消费数据为依据公开信息的估算
- 气候数据参考中国气象局公开信息
"""
import json
from .database import get_connection

# ── 12 个康养目的地 ──────────────────────────────────────────────

SEED_DESTINATIONS = [
    {
        "name": "苏马荡",
        "province": "湖北省（恩施州利川市）",
        "climate": "亚热带山地湿润气候",
        "altitude": 1500,
        "temperature_summer": "18–26℃",
        "temperature_winter": "-2–8℃",
        "air_quality": "优（森林覆盖率 90%+）",
        "monthly_cost_low": 2000,
        "monthly_cost_high": 5000,
        "features": json.dumps(["避暑胜地", "森林康养", "候鸟社区", "土家文化", "富硒食材"], ensure_ascii=False),
        "description": (
            "苏马荡位于湖北利川市谋道镇，平均海拔 1500 米，夏季均温 22℃，"
            "是中国最大的'候鸟式'避暑康养社区之一。每年夏季吸引超过 30 万"
            "旅居人群前来避暑。这里森林覆盖率高，空气中负氧离子含量丰富，"
            "素有'中国最美小地方'和'凉都'的美誉。本地富硒农产品和土家族"
            "特色饮食也为康养提供了天然保障。"
        ),
        "suitable_for": "中老年避暑人群、呼吸系统康复、亚健康调理、退休旅居者",
        "best_season": "5–9月（避暑旺季）",
        "latitude": 30.52,
        "longitude": 108.75,
        "image_url": None,
        "score": 4.5,
    },
    {
        "name": "巴马瑶族自治县",
        "province": "广西壮族自治区（河池市）",
        "climate": "南亚热带季风气候",
        "altitude": 600,
        "temperature_summer": "22–30℃",
        "temperature_winter": "10–18℃",
        "air_quality": "优（世界长寿之乡）",
        "monthly_cost_low": 1500,
        "monthly_cost_high": 4000,
        "features": json.dumps(["长寿之乡", "地磁养生", "弱碱性水", "瑶族文化", "洞穴疗养"], ensure_ascii=False),
        "description": (
            "巴马是世界著名的'长寿之乡'，每 10 万人口中百岁老人数量居世界前列。"
            "这里拥有特殊的地磁场、远红外线、弱碱性小分子团水和富硒土壤，"
            "构成独特的'巴马长寿现象'自然环境。盘阳河流域的坡月村、巴盘屯"
            "等地已成为全国'候鸟人'的冬季康养聚集地。"
        ),
        "suitable_for": "中老年养生人群、慢性病康复、冬季避寒、长寿文化体验",
        "best_season": "10–次年4月（冬季温暖干燥）",
        "latitude": 24.14,
        "longitude": 107.25,
        "image_url": None,
        "score": 4.7,
    },
    {
        "name": "三亚海棠湾",
        "province": "海南省（三亚市）",
        "climate": "热带海洋性季风气候",
        "altitude": 10,
        "temperature_summer": "26–33℃",
        "temperature_winter": "18–26℃",
        "air_quality": "优",
        "monthly_cost_low": 4000,
        "monthly_cost_high": 12000,
        "features": json.dumps(["热带滨海", "冬季避寒", "海水疗养", "高端康养", "中医药养生"], ensure_ascii=False),
        "description": (
            "三亚是中国最南端的热带滨海城市，海棠湾拥有优质沙滩和清澈海水，"
            "冬季温暖如春，是全国最受欢迎的冬季康养目的地之一。区域内汇集了"
            "多家高端康养酒店和医疗康养机构，提供海水浴疗、温泉疗养、"
            "中医理疗等多层次康养服务。负氧离子浓度高，尤其适合呼吸系统康复。"
        ),
        "suitable_for": "冬季避寒人群、呼吸系统康复、高端康养需求、退休度假",
        "best_season": "10–次年3月（冬季最佳）",
        "latitude": 18.30,
        "longitude": 109.73,
        "image_url": None,
        "score": 4.6,
    },
    {
        "name": "西双版纳嘎洒",
        "province": "云南省（西双版纳州景洪市）",
        "climate": "热带季雨林气候",
        "altitude": 550,
        "temperature_summer": "24–33℃",
        "temperature_winter": "13–25℃",
        "air_quality": "优（热带雨林）",
        "monthly_cost_low": 2500,
        "monthly_cost_high": 6000,
        "features": json.dumps(["热带雨林", "傣医药浴", "温泉疗养", "冬季避寒", "民族文化"], ensure_ascii=False),
        "description": (
            "嘎洒是西双版纳著名的温泉康养小镇，拥有丰富的地热温泉资源，"
            "水温高达 60℃，富含硫、钙、镁等多种矿物质。这里热带雨林密布，"
            "负氧离子浓度极高，冬季气候温暖宜人。独特的傣医药浴和药膳文化"
            "为旅居者提供了别具一格的民族特色康养体验。"
        ),
        "suitable_for": "冬季避寒人群、风湿关节康复、温泉疗养爱好者、民族文化体验",
        "best_season": "11–次年3月（干季，气候宜人）",
        "latitude": 21.90,
        "longitude": 100.71,
        "image_url": None,
        "score": 4.5,
    },
    {
        "name": "大理古城",
        "province": "云南省（大理白族自治州）",
        "climate": "高原季风气候",
        "altitude": 1970,
        "temperature_summer": "16–25℃",
        "temperature_winter": "3–15℃",
        "air_quality": "优",
        "monthly_cost_low": 2500,
        "monthly_cost_high": 7000,
        "features": json.dumps(["高原湖泊", "文艺旅居", "白族文化", "苍山洱海", "慢生活"], ensure_ascii=False),
        "description": (
            "大理背靠苍山、面朝洱海，四季如春，是中国最知名的长居型旅居目的地之一。"
            "'下关风、上关花、苍山雪、洱海月'构成了独一无二的自然画卷。"
            "这里日照充足、气候干燥温和，特别适合风湿和呼吸系统问题的康复。"
            "浓厚的文艺氛围和包容的社区文化，让旅居者在这里找到心灵的归属。"
        ),
        "suitable_for": "文艺旅居人群、退休长居、心理减压、慢性呼吸系统康复",
        "best_season": "3–5月、9–11月（春秋最佳）",
        "latitude": 25.68,
        "longitude": 100.16,
        "image_url": None,
        "score": 4.8,
    },
    {
        "name": "桂林阳朔",
        "province": "广西壮族自治区（桂林市）",
        "climate": "亚热带季风气候",
        "altitude": 150,
        "temperature_summer": "25–33℃",
        "temperature_winter": "8–16℃",
        "air_quality": "优",
        "monthly_cost_low": 2000,
        "monthly_cost_high": 5000,
        "features": json.dumps(["山水田园", "徒步骑行", "慢生活", "喀斯特地貌", "生态农业"], ensure_ascii=False),
        "description": (
            "阳朔以'山水甲桂林'闻名世界，漓江和遇龙河如玉带环绕，"
            "十里画廊沿途风光美不胜收。这里生活节奏悠闲，非常适合长期旅居。"
            "田园骑行、徒步登山、竹筏漂流等户外活动丰富多彩，"
            "当地有机农产品和农家美食也为健康饮食提供了天然保障。"
        ),
        "suitable_for": "户外运动爱好者、心理减压、慢生活体验、摄影旅居",
        "best_season": "4–6月、9–11月（烟雨漓江最美）",
        "latitude": 24.78,
        "longitude": 110.49,
        "image_url": None,
        "score": 4.4,
    },
    {
        "name": "庐山牯岭镇",
        "province": "江西省（九江市）",
        "climate": "亚热带山地气候",
        "altitude": 1164,
        "temperature_summer": "18–28℃",
        "temperature_winter": "-5–5℃",
        "air_quality": "优（森林覆盖率 76%+）",
        "monthly_cost_low": 2500,
        "monthly_cost_high": 6000,
        "features": json.dumps(["避暑名山", "森林氧吧", "云海日出", "历史文化", "温泉疗养"], ensure_ascii=False),
        "description": (
            "庐山是中国四大避暑胜地之一，牯岭镇坐落在海拔 1164 米的山顶，"
            "夏季凉爽宜人，有'云中山城'之称。这里森林茂密、飞瀑流泉，"
            "负氧离子浓度极高。庐山温泉富含氡和多种矿物质，"
            "对关节炎和皮肤病有良好疗效。丰富的历史文化遗迹也让旅居生活"
            "充满人文气息。"
        ),
        "suitable_for": "中老年避暑、关节康复、文化旅居、森林浴爱好者",
        "best_season": "6–9月（避暑最佳）",
        "latitude": 29.57,
        "longitude": 115.97,
        "image_url": None,
        "score": 4.5,
    },
    {
        "name": "黄山汤口",
        "province": "安徽省（黄山市）",
        "climate": "亚热带山地湿润气候",
        "altitude": 500,
        "temperature_summer": "22–30℃",
        "temperature_winter": "0–10℃",
        "air_quality": "优（森林覆盖率 84%+）",
        "monthly_cost_low": 2000,
        "monthly_cost_high": 5500,
        "features": json.dumps(["奇松云海", "温泉疗养", "徽州文化", "森林康养", "茶文化"], ensure_ascii=False),
        "description": (
            "黄山温泉古称'汤泉'，已有千年历史，水质清澈、富含重碳酸盐，"
            "对心血管和神经系统疾病有辅助疗效。汤口镇位于黄山南大门，"
            "周边古村落如宏村、西递是世界文化遗产，徽州文化底蕴深厚。"
            "黄山毛峰茶和徽菜美食让旅居生活更添风味。"
        ),
        "suitable_for": "温泉疗养、心血管康复、徽州文化体验、摄影旅居",
        "best_season": "4–6月（杜鹃花开）、9–11月（秋色最美）",
        "latitude": 30.08,
        "longitude": 118.18,
        "image_url": None,
        "score": 4.4,
    },
    {
        "name": "武夷山",
        "province": "福建省（南平市）",
        "climate": "中亚热带季风气候",
        "altitude": 300,
        "temperature_summer": "24–32℃",
        "temperature_winter": "6–15℃",
        "air_quality": "优（世界双遗产地）",
        "monthly_cost_low": 2000,
        "monthly_cost_high": 5000,
        "features": json.dumps(["茶文化", "丹霞地貌", "森林康养", "九曲溪", "儒家文化"], ensure_ascii=False),
        "description": (
            "武夷山是世界自然与文化双遗产地，九曲溪蜿蜒如画，丹霞地貌奇特壮丽。"
            "这里是乌龙茶和红茶的发源地，茶文化底蕴深厚，品茶、学茶道成为"
            "旅居生活的重要组成部分。武夷岩茶富含茶多酚，具有抗氧化和降血脂"
            "功效。丰富的森林资源和清新空气也非常适合慢节奏的康养生活。"
        ),
        "suitable_for": "茶文化爱好者、森林康养、高血脂调理、文化旅居",
        "best_season": "3–5月（采茶季）、9–11月（秋高气爽）",
        "latitude": 27.71,
        "longitude": 117.98,
        "image_url": None,
        "score": 4.3,
    },
    {
        "name": "青城山",
        "province": "四川省（成都市都江堰市）",
        "climate": "亚热带湿润季风气候",
        "altitude": 900,
        "temperature_summer": "20–28℃",
        "temperature_winter": "2–10℃",
        "air_quality": "优（森林覆盖率 95%+）",
        "monthly_cost_low": 1800,
        "monthly_cost_high": 5000,
        "features": json.dumps(["道教养生", "森林浴", "太极拳", "都江堰水文化", "素食养生"], ensure_ascii=False),
        "description": (
            "青城山是中国道教发源地之一，素有'青城天下幽'的美誉。"
            "这里森林覆盖率达 95% 以上，是天然的大氧吧。青城山道家养生文化"
            "源远流长，太极、气功、药膳、素食等养生方式丰富多彩。"
            "毗邻都江堰水利工程，周边环境清幽，是川西最受欢迎的康养目的地之一。"
        ),
        "suitable_for": "道家养生文化爱好者、森林浴、太极气功修炼、素食人群",
        "best_season": "4–10月（气候温和，植被最茂盛）",
        "latitude": 30.90,
        "longitude": 103.57,
        "image_url": None,
        "score": 4.6,
    },
    {
        "name": "莫干山",
        "province": "浙江省（湖州市德清县）",
        "climate": "亚热带湿润季风气候",
        "altitude": 700,
        "temperature_summer": "20–28℃",
        "temperature_winter": "0–8℃",
        "air_quality": "优（竹林覆盖率 90%+）",
        "monthly_cost_low": 3500,
        "monthly_cost_high": 10000,
        "features": json.dumps(["竹海氧吧", "高端民宿", "户外运动", "有机农场", "长三角后花园"], ensure_ascii=False),
        "description": (
            "莫干山是中国四大避暑胜地之一，以竹海、清泉、别墅群著称。"
            "这里是中国高端民宿的发源地，住宿条件和康养设施一流。"
            "莫干山竹林茂密，空气中富含负氧离子，夏季凉爽宜人。"
            "Disocvery探索极限基地等户外运动设施为旅居者提供了丰富的"
            "体能训练选择。距离上海、杭州仅 1–2 小时车程，交通便利。"
        ),
        "suitable_for": "高端康养需求、户外运动爱好者、城市减压、亲子旅居",
        "best_season": "5–10月（避暑和户外运动最佳）",
        "latitude": 30.61,
        "longitude": 119.87,
        "image_url": None,
        "score": 4.5,
    },
    {
        "name": "峨眉山",
        "province": "四川省（乐山市峨眉山市）",
        "climate": "亚热带山地垂直气候",
        "altitude": 550,
        "temperature_summer": "22–30℃",
        "temperature_winter": "3–12℃",
        "air_quality": "优（世界双遗产地）",
        "monthly_cost_low": 2000,
        "monthly_cost_high": 5500,
        "features": json.dumps(["佛教康养", "温泉疗养", "武术养生", "峨眉雪芽茶", "森林氧吧"], ensure_ascii=False),
        "description": (
            "峨眉山是中国四大佛教名山之一，佛教康养文化历史悠久。"
            "山麓温泉资源丰富，富含氡、氟等多种矿物质，对皮肤和关节"
            "有良好保健功效。峨眉武术与少林、武当并称中国三大武术流派，"
            "习武练功成为独特的康养方式。峨眉雪芽茶、峨眉糕等特色饮食"
            "也丰富了旅居体验。"
        ),
        "suitable_for": "佛教文化体验、温泉疗养、武术养生、中老年康养",
        "best_season": "4–6月（佛光最佳观赏季）、9–11月（秋景最美）",
        "latitude": 29.58,
        "longitude": 103.42,
        "image_url": None,
        "score": 4.5,
    },
]


def seed_if_empty() -> int:
    """如果 destinations 表为空，插入种子数据。返回插入的行数。"""
    from .database import count_rows

    existing = count_rows("destinations")
    if existing > 0:
        return 0  # 已有数据，跳过

    conn = get_connection()
    try:
        sql = """
        INSERT INTO destinations (
            name, province, climate, altitude,
            temperature_summer, temperature_winter, air_quality,
            monthly_cost_low, monthly_cost_high,
            features, description, suitable_for, best_season,
            latitude, longitude, image_url, score
        ) VALUES (
            :name, :province, :climate, :altitude,
            :temperature_summer, :temperature_winter, :air_quality,
            :monthly_cost_low, :monthly_cost_high,
            :features, :description, :suitable_for, :best_season,
            :latitude, :longitude, :image_url, :score
        )
        """
        conn.executemany(sql, SEED_DESTINATIONS)
        conn.commit()
        return len(SEED_DESTINATIONS)
    finally:
        conn.close()
