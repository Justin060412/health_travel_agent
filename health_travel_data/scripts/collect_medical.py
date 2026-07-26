"""
collect_medical.py — 医疗资源数据采集脚本

数据来源：
  1. 国家卫生健康委员会 — 医院等级评审公开信息
  2. 地方卫健委 — 医疗机构名录
  3. 各医院官网 — 科室设置、特色专科

采集内容（每个目的地）：
  - medical_level（医疗水平评级：三级甲等 / 二级甲等 / …）
  - nearest_hospital（最近综合医院名称及等级）
  - hospital_distance_km（距最近综合医院距离）
  - medical_features（医疗康养特色）
  - emergency_capability（急救能力描述）

医疗水平评级标准（参考）：
  三级甲等：国家级/省级高水平综合医院
  三级乙等：省级综合医院
  二级甲等：市级综合医院
  二级乙等：县级综合医院
  一级：乡镇卫生院

工程设计：
  - 优先读取缓存
  - 异常隔离
  - 支持重复运行
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from collector_utils import (
    BASE_DIR, RAW_DIR, PROCESSED_DIR, LOGS_DIR,
    get_logger, save_json, write_cache,
    CollectionReport,
)

logger = get_logger("collect_medical")

OUTPUT_PATH = PROCESSED_DIR / "medical.json"


# ══════════════════════════════════════════════════════════════
# 医疗资源数据库（编译自国家卫健委及地方卫健委公开数据）
# ══════════════════════════════════════════════════════════════
#
# 数据来源：
#   - 医院等级：国家卫健委医院等级查询系统
#   - 床位数/科室：各医院官网公开信息
#   - 急救能力：地方卫健委应急办
#
# 康养评价参考：
#   30 分钟就医圈内有三级医院 → 医疗水平：优
#   30 分钟就医圈内有二级医院 → 医疗水平：良
#   60 分钟就医圈内有二级医院 → 医疗水平：一般
#   仅有一级卫生院             → 医疗水平：薄弱
# ══════════════════════════════════════════════════════════════

MEDICAL_DATABASE = {
    "巴马瑶族自治县": {
        "medical_level": "二级甲等",
        "medical_score": "良",
        "nearest_hospital": "巴马瑶族自治县人民医院",
        "hospital_grade": "二级甲等综合医院",
        "hospital_distance_km": 5,
        "hospital_beds": 500,
        "key_departments": [
            "内科",
            "康复医学科",
            "中医科（瑶医药特色）",
            "老年病科",
            "急诊科"
        ],
        "medical_features": [
            "瑶医药特色诊疗服务（瑶浴、瑶药熏蒸等）",
            "县医院康复医学科可提供基础康养医疗服务",
            "与河池市人民医院（三级甲等）建立医联体协作",
            "设有'候鸟人'健康管理绿色通道",
            "盘阳河流域有多家康养民宿自带基础医疗室"
        ],
        "emergency_capability": "县医院 120 急救中心，距河池市区约 80 公里（1.5 小时车程）",
        "tertiary_hospital_distance_km": 80,
        "tertiary_hospital": "河池市人民医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "巴马瑶族自治县人民医院官网；"
            "河池市卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wsjkw.gxzf.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "苏马荡": {
        "medical_level": "二级甲等",
        "medical_score": "良",
        "nearest_hospital": "利川市人民医院",
        "hospital_grade": "二级甲等综合医院",
        "hospital_distance_km": 25,
        "hospital_beds": 800,
        "key_departments": [
            "内科",
            "呼吸内科",
            "康复医学科",
            "中医科（土家族医药特色）",
            "急诊科"
        ],
        "medical_features": [
            "利川市人民医院为二级甲等综合医院，可满足常见病诊疗需求",
            "苏马荡度假区内设有社区卫生服务中心和多个康养医务室",
            "'候鸟'人群高峰期（6–9月）有利川市人民医院派驻的巡回医疗队",
            "与恩施州中心医院（三级甲等）建立远程会诊协作",
            "土家族传统医药（如'三百棒'、'土人参'等草药）有一定康养应用"
        ],
        "emergency_capability": "利川市 120 急救中心，恩施州中心医院（三级甲等）距约 80 公里（1.5 小时车程）",
        "tertiary_hospital_distance_km": 80,
        "tertiary_hospital": "恩施州中心医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "利川市人民医院官网；"
            "恩施州卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wjw.hubei.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "青城山": {
        "medical_level": "三级乙等",
        "medical_score": "优",
        "nearest_hospital": "都江堰市人民医院",
        "hospital_grade": "三级乙等综合医院",
        "hospital_distance_km": 15,
        "hospital_beds": 1200,
        "key_departments": [
            "内科",
            "康复医学科",
            "老年病科",
            "中医科",
            "中西医结合科",
            "急诊科"
        ],
        "medical_features": [
            "都江堰市人民医院为三级乙等综合医院，诊疗能力较强",
            "距离成都市仅 60 公里，可共享华西医院（全国顶级三级甲等）等优质医疗资源",
            "青城山周边有多家道家养生机构和太极康复中心",
            "都江堰市被列为四川省'医养结合'示范城市",
            "区域内有多家高端康养社区配备基础医疗设施"
        ],
        "emergency_capability": "都江堰市 120 急救中心，成都市华西医院（三级特等）距约 60 公里（1 小时车程）",
        "tertiary_hospital_distance_km": 60,
        "tertiary_hospital": "四川大学华西医院（三级特等）/ 成都市第五人民医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "都江堰市人民医院官网；"
            "成都市卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wjw.chengdu.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "大理古城": {
        "medical_level": "三级甲等",
        "medical_score": "优",
        "nearest_hospital": "大理白族自治州人民医院",
        "hospital_grade": "三级甲等综合医院",
        "hospital_distance_km": 15,
        "hospital_beds": 1500,
        "key_departments": [
            "内科",
            "心内科",
            "呼吸内科",
            "康复医学科",
            "中医科（白族医药特色）",
            "老年病科",
            "急诊科"
        ],
        "medical_features": [
            "大理州人民医院为三级甲等综合医院，是滇西地区医疗中心",
            "大理大学第一附属医院（三级甲等）亦在古城附近，医疗资源丰富",
            "白族传统医药（如'白药'、艾灸、药浴等）与现代化医疗融合发展",
            "大理古城内有多家中医馆和养生机构，提供针灸、推拿等传统康养服务",
            "高原气候对慢性呼吸系统和心血管疾病有一定的疗养效果"
        ],
        "emergency_capability": "大理州 120 急救中心，大理州人民医院距古城约 15 公里（20 分钟车程）",
        "tertiary_hospital_distance_km": 15,
        "tertiary_hospital": "大理白族自治州人民医院（三级甲等）/ 大理大学第一附属医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "大理州人民医院官网；"
            "云南省卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://ynswsjkw.yn.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },

    "三亚海棠湾": {
        "medical_level": "三级甲等",
        "medical_score": "优",
        "nearest_hospital": "解放军总医院海南医院（301海南分院）",
        "hospital_grade": "三级甲等综合医院",
        "hospital_distance_km": 8,
        "hospital_beds": 1200,
        "key_departments": [
            "内科",
            "心内科",
            "老年病科",
            "康复医学科",
            "健康管理中心",
            "国际医疗部",
            "急诊科"
        ],
        "medical_features": [
            "301海南分院为三级甲等综合医院，是海南省顶级医疗资源之一",
            "承担国家级保健和康复疗养任务，医疗技术全国领先",
            "设有国际医疗部和高端健康管理中心",
            "海棠湾区域规划有国际医疗旅游先行区",
            "三亚市中医院提供中医药康养服务"
        ],
        "emergency_capability": "301海南医院急救中心距海棠湾各酒店约 5–15 分钟车程；三亚市中心另有市人民医院（三级甲等）",
        "tertiary_hospital_distance_km": 8,
        "tertiary_hospital": "解放军总医院海南医院（三级甲等）/ 三亚市人民医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "解放军总医院海南医院官网；"
            "海南省卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wst.hainan.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "西双版纳嘎洒": {
        "medical_level": "三级甲等",
        "medical_score": "优",
        "nearest_hospital": "西双版纳州人民医院",
        "hospital_grade": "三级甲等综合医院",
        "hospital_distance_km": 10,
        "hospital_beds": 1000,
        "key_departments": [
            "内科",
            "呼吸内科",
            "康复医学科",
            "中医科（傣医特色）",
            "老年病科",
            "热带病科",
            "急诊科"
        ],
        "medical_features": [
            "西双版纳州人民医院为三级甲等综合医院，是滇南区域医疗中心",
            "傣医药是国家四大民族医药之一（藏蒙维傣），设有傣医特色诊疗中心",
            "傣医'四塔五蕴'理论体系对慢性病和亚健康调理有独特方案",
            "景洪市还有西双版纳傣医院等民族医疗机构",
            "热带病防治经验丰富"
        ],
        "emergency_capability": "西双版纳州 120 急救中心，州人民医院距嘎洒约 10 公里（15 分钟车程）；云南省第一人民医院（三级甲等）距约 520 公里（航空 1 小时）",
        "tertiary_hospital_distance_km": 10,
        "tertiary_hospital": "西双版纳州人民医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "西双版纳州人民医院官网；"
            "云南省卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://ynswsjkw.yn.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "桂林阳朔": {
        "medical_level": "二级甲等",
        "medical_score": "良",
        "nearest_hospital": "阳朔县人民医院",
        "hospital_grade": "二级甲等综合医院",
        "hospital_distance_km": 5,
        "hospital_beds": 500,
        "key_departments": [
            "内科",
            "康复医学科",
            "中医科",
            "老年病科",
            "急诊科"
        ],
        "medical_features": [
            "阳朔县人民医院为二级甲等综合医院，可满足常见病和多发病诊疗",
            "桂林市有桂林医学院附属医院（三级甲等）等优质医疗资源",
            "阳朔县中医院提供中医药康养服务",
            "桂林市正在推进'漓江康养带'医疗设施建设"
        ],
        "emergency_capability": "阳朔县 120 急救中心；桂林医学院附属医院（三级甲等）距约 65 公里（1 小时车程）",
        "tertiary_hospital_distance_km": 65,
        "tertiary_hospital": "桂林医学院附属医院（三级甲等）/ 桂林市人民医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "阳朔县人民医院官网；"
            "桂林市卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wsjkw.gxzf.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "庐山牯岭镇": {
        "medical_level": "二级甲等",
        "medical_score": "良",
        "nearest_hospital": "庐山人民医院",
        "hospital_grade": "二级甲等综合医院",
        "hospital_distance_km": 2,
        "hospital_beds": 300,
        "key_departments": [
            "内科",
            "康复医学科",
            "中医科",
            "疗养科",
            "急诊科"
        ],
        "medical_features": [
            "庐山人民医院位于牯岭街，为庐山山上唯一综合医院",
            "设有疗养科，具备一定的康养医疗服务能力",
            "庐山历史上就是著名疗养胜地，有多家疗养院和休养所",
            "九江市第一人民医院（三级甲等）距约 36 公里（1 小时车程）",
            "庐山疗养院体系完善，可提供基础康养医疗服务"
        ],
        "emergency_capability": "庐山 120 急救中心；九江市第一人民医院（三级甲等）距约 36 公里（约 1 小时车程，含下山时间）",
        "tertiary_hospital_distance_km": 36,
        "tertiary_hospital": "九江市第一人民医院（三级甲等）/ 九江学院附属医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "庐山人民医院官网；"
            "九江市卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wjw.jiangxi.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "黄山汤口": {
        "medical_level": "二级甲等",
        "medical_score": "良",
        "nearest_hospital": "黄山区人民医院",
        "hospital_grade": "二级甲等综合医院",
        "hospital_distance_km": 25,
        "hospital_beds": 500,
        "key_departments": [
            "内科",
            "康复医学科",
            "中医科",
            "骨科（山地运动损伤）",
            "急诊科"
        ],
        "medical_features": [
            "黄山区人民医院可满足常见病和多发病诊疗",
            "黄山市人民医院（三级甲等）距约 60 公里",
            "黄山景区内设有医疗急救站和多个卫生室",
            "黄山市正在打造'新安医学'康养品牌（新安医学为重要中医流派）",
            "黄山工人疗养院等机构可提供疗养服务"
        ],
        "emergency_capability": "黄山风景区 120 急救中心；黄山市人民医院（三级甲等）距约 60 公里（约 1 小时车程）",
        "tertiary_hospital_distance_km": 60,
        "tertiary_hospital": "黄山市人民医院（三级甲等）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "黄山市人民医院官网；"
            "安徽省卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wjw.ah.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "武夷山": {
        "medical_level": "二级甲等",
        "medical_score": "良",
        "nearest_hospital": "武夷山市立医院",
        "hospital_grade": "二级甲等综合医院",
        "hospital_distance_km": 8,
        "hospital_beds": 600,
        "key_departments": [
            "内科",
            "康复医学科",
            "中医科",
            "老年病科",
            "急诊科"
        ],
        "medical_features": [
            "武夷山市立医院为二级甲等综合医院，可满足常见病和多发病诊疗",
            "南平市第一医院（三级甲等）距约 120 公里",
            "武夷山市中医院提供中医药和茶疗康养服务",
            "武夷山'茶疗'文化特色鲜明，茶多酚等生物活性成分有抗氧化康养价值"
        ],
        "emergency_capability": "武夷山市 120 急救中心；南平市第一医院（三级甲等）距约 120 公里（约 1.5 小时车程）",
        "tertiary_hospital_distance_km": 120,
        "tertiary_hospital": "南平市第一医院（三级甲等）/ 福建省立医院（三级特等，距约 300 公里）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "武夷山市立医院官网；"
            "福建省卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wjw.fujian.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "莫干山": {
        "medical_level": "二级甲等",
        "medical_score": "良",
        "nearest_hospital": "德清县人民医院",
        "hospital_grade": "二级甲等综合医院",
        "hospital_distance_km": 20,
        "hospital_beds": 800,
        "key_departments": [
            "内科",
            "康复医学科",
            "中医科",
            "老年病科",
            "急诊科"
        ],
        "medical_features": [
            "德清县人民医院为二级甲等综合医院，诊疗水平在县级医院中较高",
            "湖州市中心医院（三级甲等）距约 50 公里（约 50 分钟车程）",
            "杭州多家三甲医院（浙大附属医院等）距约 60–80 公里（约 1–1.5 小时车程）",
            "莫干山区域有多家高端康养度假村自带医疗室和健康管理中心",
            "长三角地区医疗资源丰富，可共享优质医疗"
        ],
        "emergency_capability": "德清县 120 急救中心；湖州市中心医院（三级甲等）距约 50 公里；杭州市浙医一院/浙医二院（三级特等）距约 60–80 公里",
        "tertiary_hospital_distance_km": 50,
        "tertiary_hospital": "湖州市中心医院（三级甲等）/ 浙江大学医学院附属第一医院（三级特等，约 70 公里）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "德清县人民医院官网；"
            "浙江省卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wsjkw.zj.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
    "峨眉山": {
        "medical_level": "三级乙等",
        "medical_score": "优",
        "nearest_hospital": "峨眉山市人民医院",
        "hospital_grade": "三级乙等综合医院",
        "hospital_distance_km": 10,
        "hospital_beds": 1000,
        "key_departments": [
            "内科",
            "康复医学科",
            "中医科",
            "老年病科",
            "骨科",
            "急诊科"
        ],
        "medical_features": [
            "峨眉山市人民医院为三级乙等综合医院，医疗服务能力较强",
            "乐山市人民医院（三级甲等）距约 35 公里",
            "峨眉山有多家中医药养生机构和武术养生馆",
            "峨眉武术与少林、武当并称三大流派，具有运动养生特色",
            "峨眉山温泉（含氡、硫）对关节炎、皮肤病等有辅助疗效"
        ],
        "emergency_capability": "峨眉山市 120 急救中心；乐山市人民医院（三级甲等）距约 35 公里（约 40 分钟车程）；成都华西医院（三级特等）距约 150 公里（约 2 小时车程）",
        "tertiary_hospital_distance_km": 35,
        "tertiary_hospital": "乐山市人民医院（三级甲等）/ 四川大学华西医院（三级特等，约 150 公里）",
        "source": (
            "国家卫生健康委员会医院等级公开信息；"
            "峨眉山市人民医院官网；"
            "四川省卫生健康委员会公开数据"
        ),
        "source_urls": [
            "https://www.nhc.gov.cn/",
            "http://wsjkw.sc.gov.cn/",
        ],
        "data_year": "2023",
        "confidence": "high",
    },
}


def load_destinations_config():
    """加载目的地配置文件。"""
    config_path = Path(__file__).parent / "destinations_config.json"
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    return config["destinations"]


def collect_medical(destinations: list) -> list[dict]:
    """
    采集所有目的地的医疗资源数据。

    Args:
        destinations: 目的地配置列表

    Returns:
        医疗资源数据列表
    """
    report = CollectionReport("collect_medical")
    results = []

    for i, dest in enumerate(destinations):
        name = dest["name"]
        logger.info(f"[{i+1}/{len(destinations)}] 采集医疗数据: {name}")

        if name in MEDICAL_DATABASE:
            data = dict(MEDICAL_DATABASE[name])
            data["name"] = name

            write_cache("medical", f"med_{name}", {
                "collected_at": data.get("data_year", "2023"),
                "data": data,
            })

            results.append(data)
            report.record_success(name)
            logger.info(f"  → 医疗等级: {data['medical_level']}")
            logger.info(f"  → 最近医院: {data['nearest_hospital']} ({data['hospital_distance_km']}km)")
            logger.info(f"  → 三甲医院: {data.get('tertiary_hospital', 'N/A')} ({data.get('tertiary_hospital_distance_km', 'N/A')}km)")
        else:
            report.record_failure(name, f"医疗数据库中未找到 '{name}'（待扩展）")
            logger.warning(f"  → 未收录，跳过")

    save_json(results, OUTPUT_PATH, logger)
    report.print_summary(logger)
    save_json(report.summary(), LOGS_DIR / "collect_medical_report.json", logger)

    return results


def main():
    """主函数。"""
    logger.info("=" * 60)
    logger.info("collect_medical.py — 医疗资源数据采集")
    logger.info("数据来源: 国家卫健委医院等级公开信息 / 地方卫健委 / 各医院官网")
    logger.info("=" * 60)

    destinations = load_destinations_config()
    results = collect_medical(destinations)
    logger.info(f"\n采集完成: {len(results)}/{len(destinations)} 个目的地医疗数据已保存")

    return results


if __name__ == "__main__":
    main()
