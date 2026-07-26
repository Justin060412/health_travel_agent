# Sprint 7 — Experience Design：首页体验重新设计计划

> 项目：AI 康养智能推荐平台
>
> 日期：2026-07-23
>
> 目标：从"网页"升级为"体验"——打造具有沉浸感、故事感、产品感的 AI 康养探索平台

---

## 目录

1. [参考产品研究](#一参考产品研究)
2. [新首页信息架构](#二新首页信息架构)
3. [UX Flow & 页面流程图](#三ux-flow--页面流程图)
4. [每一章节 Wireframe](#四每一章节-wireframe)
5. [Storyboard](#五storyboard)
6. [页面切换方式](#六页面切换方式)
7. [动效设计](#七动效设计)
8. [数据来源规划](#八数据来源规划)
9. [技术方案](#九技术方案)
10. [后续开发顺序](#十后续开发顺序)

---

## 一、参考产品研究

### 1.1 产品体验参考矩阵

| 参考产品 | 核心手法 | 我们如何借鉴 |
|----------|----------|-------------|
| **Apple 官网** | Scroll-triggered 时间线动画、Sticky Hero、Mask Reveal、章节式叙事 | 每个 Experience 是独立章节，点击按钮进入下一章（非连续滚动），入场/退场动画编排 |
| **Google Earth** | 3D 旋转地球 + Fly-To 相机动画、OrbitControls、大气层光晕 | Experience 02 中央旋转半球 + 点击"下一站"飞向目的地 |
| **Aman Resorts** | 全屏摄影、极简文字、情感静谧、目的地独立叙事 | 每个目的地的全屏风景图 + Glass Data Panel，摄影后期统一色温/饱和度 |
| **Airbnb Explore** | 偶遇式发现、多模态真实感 | 目的地展示不是列表，而是一次"环游中国"的旅程 |
| **Stripe** | Bento Box 网格、渐进式披露、渐变波浪动画、"MVQP" 品质哲学 | Platform Center 使用杂志排版的大卡片组合（非九宫格），每次微交互都是信任信号 |
| **Linear** | 极简 Chrome、Keyboard-First、Command Palette、消除视觉噪音 | 整个首页无多余元素，每个像素都有意图 |
| **Notion** | 干净、文档化但强大 | AI Recommendation Ending 的极简仪式感 |
| **Arc Browser** | 浏览器即画布、空间感设计 | 整个首页不是"文档"，而是一个"空间" |

### 1.2 关键洞察

1. **Apple 的章节叙事**：不是 scroll，而是 scroll-driven chapter。每一屏都是一个完整的故事单元。我们改为 Click-to-Next-Chapter（按钮驱动），比 scroll 更可控、更有仪式感。

2. **Google Earth 的探索感**：地球不是地图。旋转、飞行、聚焦——这些动作本身就在讲故事。"飞向目的地"比"滚动到卡片"强 100 倍。

3. **Aman 的情感设计**：全屏摄影 + 极少文字。图片占据 80% 视觉面积，文字只是注解。每个目的地一张 Banner 级照片。

4. **Stripe 的 Bento Box**：产品磁贴不是功能列表，而是品牌宣言。每块磁贴传达一种能力、一种态度。

5. **Linear 的克制**：去掉一切非必要元素后，剩下的每一个像素都很贵。我们的首页当前有太多"还不错但不是必须"的模块。

---

## 二、新首页信息架构

### 2.1 旧架构（当前）

```
Hero
  └─ 平台数据概览（8 磁贴，重复 Hero 信息）
      └─ 精选目的地展示（4 张卡片）
          └─ 首页预览地图（Leaflet）
              └─ Footer
```

**问题**：
- 数据概览与 Hero Glass Panel 信息重复
- 4 张卡片无法传达 12 个目的地的丰富性
- 地图是信息终点而非旅程起点
- 没有故事线，只是信息堆叠

### 2.2 新架构

```
Chapter 0: Hero（入口）
  └─ 保持全屏 Hero + Glass Panel
  └─ 底部按钮："探索平台"（非"了解更多"）

Chapter 1: Platform Center（平台能力中心）
  └─ Bento Box 杂志排版
  └─ 8 个功能入口（AI 推荐 / 健康画像 / 环境数据 / 地图探索 / 行程规划 / 知识库 / 收藏 / 数据中心）
  └─ 仅 UI，未来逐步实现
  └─ 底部按钮："探索世界"

Chapter 2: Earth Journey（地球探索）★ 核心体验
  └─ 中央：Three.js 半透明旋转地球
  └─ 点击 "下一站" → 地球旋转 + 镜头飞向目的地
  └─ 右侧浮现：全屏目的地介绍（Apple Product Page 风格）
  └─ 底部按钮："下一站" / "深入了解"

Chapter 3: Deep Story（深度故事）
  └─ 点击"深入了解"后进入
  └─ 选中目的地 → 全屏沉浸式展示
  └─ 全屏风景图 + Glass Data Card + 叙事文字
  └─ 底部按钮："继续探索" / "开启旅程"

Chapter 4: AI Recommendation（仪式感 Ending）
  └─ 页面慢慢变暗
  └─ 中央浮现："你的康养旅程，即将开始"
  └─ 大按钮 → 跳转 questionnaire.html
```

### 2.3 信息架构对比

| 维度 | 旧 | 新 |
|------|-----|-----|
| 导航方式 | 连续滚动 | Click-to-Next（按钮驱动章节切换） |
| 目的地展示 | 4 张卡片 | Earth Journey 环游中国 + Deep Story 全屏沉浸 |
| 平台介绍 | 数据磁贴（与 Hero 重复） | Platform Center（功能导向的 Bento Box） |
| 地图 | Leaflet 静态预览 | Three.js 3D 旋转地球 |
| Ending | 无 | 仪式感 AI 推荐入口 |
| 故事线 | 无 | Hero → 平台 → 环游 → 沉浸 → AI → 问卷 |

---

## 三、UX Flow & 页面流程图

### 3.1 用户旅程

```
用户进入首页
  │
  ├─ Chapter 0: Hero
  │   ├─ 全屏山峦摄影 + Hero 入场动画（1.6s choreography）
  │   ├─ Glass Panel 实时数据（AQI / 森林 / 省份 / 医疗）
  │   ├─ 用户理解产品（3 秒内）
  │   └─ [ 探索平台 ↓ ] 按钮
  │
  ├─ Chapter 1: Platform Center
  │   ├─ 页面从下方淡入（或从右滑入）
  │   ├─ Bento Box 杂志排版卡片依次入场（stagger 120ms）
  │   ├─ 用户浏览平台能力
  │   └─ [ 探索世界 ↓ ] 按钮
  │
  ├─ Chapter 2: Earth Journey ★
  │   ├─ 背景切换为纯白极简
  │   ├─ 中央：半透明地球缓慢旋转（auto-rotate）
  │   ├─ 用户看到 12 个光点标记在球面上
  │   ├─ [ 下一站 → ] 按钮
  │   │   ├─ 地球旋转 + 镜头推进到云南/大理
  │   │   ├─ 右侧面板浮现：大理全屏风景图 + Glass Data Card
  │   │   └─ 用户浏览目的地信息
  │   ├─ 再次点击 [ 下一站 → ]
  │   │   ├─ 地球旋转 + 飞向黄山
  │   │   ├─ 右侧面板切换为黄山风景 + 数据
  │   │   └─ ...循环 12 个目的地
  │   └─ [ 深入了解 ↓ ] 按钮（在浏览 ≥2 个目的地后出现）
  │
  ├─ Chapter 3: Deep Story
  │   ├─ 全屏切换为当前目的地的沉浸式展示
  │   ├─ 全屏风景图（占据 80% 可视面积）
  │   ├─ Glass Data Card 叠加在图片上
  │   ├─ 叙事文字（数据 + 感受 + 适合人群）
  │   ├─ [ 换一个目的地 ] / [ 开启旅程 ↓ ]
  │   └─ 循环或前进
  │
  ├─ Chapter 4: AI Recommendation（Ending）
  │   ├─ 页面从四周向中心变暗（vignette 效果）
  │   ├─ 中央浮现文字 + 按钮
  │   ├─ [ 开始 AI 健康分析 ] → 跳转 questionnaire.html
  │   └─ View Transition API 平滑切换
  │
  └─ questionnaire.html
```

### 3.2 用户路径图

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                    首页（单页，5 章节）                      │
                    │                                                          │
  Enter ──→ Hero ──→ Platform ──→ Earth ──→ Deep ──→ AI ──→ questionnaire   │
            Ch.0      Center      Journey    Story    Ending       .html       │
                      Ch.1        Ch.2 ★     Ch.3      Ch.4                   │
                    │                                                          │
                    │  ←── 每个章节之间的切换通过按钮触发（Click-to-Next）──→      │
                    │  ←── 用户可在任意章节通过 Nav 跳转到 questionnaire ──→      │
                    └──────────────────────────────────────────────────────────┘
```

---

## 四、每一章节 Wireframe

### 4.1 Chapter 0 — Hero（保持当前，微调）

```
┌──────────────────────────────────────────────────────────────┐
│  [Navigation · 透明 → 毛玻璃]                                  │
│                                                                │
│    ┌─ 左栏 55% ───────────────┐  ┌─ 右栏 45% ──────────────┐  │
│    │                            │  │  ┌──────────────────┐   │  │
│    │  AI 驱动 · 数据智能         │  │  │  Glass Panel      │   │  │
│    │                            │  │  │  AQI · 森林 · 省份 │   │  │
│    │  山水之间，健康有数          │  │  │  · 医疗            │   │  │
│    │                            │  │  └──────────────────┘   │  │
│    │  整合真实环境数据...         │  │                          │  │
│    │                            │  │                          │  │
│    │  [探索平台 ↓]  [了解更多]    │  │                          │  │
│    └────────────────────────────┘  └──────────────────────────┘  │
│                                                                │
│  [Background: 4K 山峦摄影 · dark overlay · Ambient Light Blobs] │
│  [↓ 探索平台]                                                    │
└──────────────────────────────────────────────────────────────┘
```

**变更**：主 CTA 从"开始 AI 规划"改为"探索平台 ↓"（引导进入 Chapter 1）

---

### 4.2 Chapter 1 — Platform Center（Bento Box 重设计）

```
┌──────────────────────────────────────────────────────────────┐
│  [Navigation · scrolled 毛玻璃态]                              │
│                                                                │
│  ┌─ Section Header ────────────────────────────────────────┐  │
│  │  平台能力                                                  │  │
│  │  AI + GIS + 环境数据，为您的康养决策提供科学依据             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐              │
│  │              │ │          │ │              │              │
│  │  AI 智能推荐  │ │ 健康画像  │ │ 实时环境数据  │              │
│  │  w:2x h:2x   │ │  w:1x    │ │  w:1x        │              │
│  │              │ │  h:2x    │ │  h:1x        │              │
│  └──────────────┘ └──────────┘ └──────────────┘              │
│                                                                │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐                  │
│  │          │ │              │ │          │                  │
│  │ 地图探索  │ │  AI 行程规划  │ │ 康养知识库 │                  │
│  │  w:1x    │ │  w:2x        │ │  w:1x    │                  │
│  │  h:1x    │ │  h:1x        │ │  h:1x    │                  │
│  └──────────┘ └──────────────┘ └──────────┘                  │
│                                                                │
│  ┌──────────┐ ┌──────────┐                                    │
│  │ 我的收藏  │ │ 数据中心  │                                    │
│  └──────────┘ └──────────┘                                    │
│                                                                │
│  [ 探索世界 ↓ ]                                                │
└──────────────────────────────────────────────────────────────┘
```

**设计要点**：
- Bento Box 不等大网格（参考 Stripe + Apple）
- 大卡片（AI 推荐）2×2 单位，小卡片 1×1
- 每张卡片：Icon + 标题 + 一行描述 + hover 微浮起
- 点击卡片 → 未来进入对应功能，目前仅动画反馈
- 留白充足，卡片间距 20px

**8 个平台能力**：
| 卡片 | 位置 | 状态 |
|------|------|------|
| AI 智能推荐 | 左上大卡片 (2×2) | 🔗 跳转 questionnaire.html |
| 健康画像 | 右上 (1×2) | 📋 UI 占位 |
| 实时环境数据 | 右上 (1×1) | 📋 UI 占位 |
| 地图探索 | 左下 (1×1) | 🔗 滚动到 Earth Journey |
| AI 行程规划 | 中央 (2×1) | 📋 UI 占位 |
| 康养知识库 | 右侧 (1×1) | 📋 UI 占位 |
| 我的收藏 | 左下 (1×1) | 📋 UI 占位 |
| 数据中心 | 右下 (1×1) | 📋 UI 占位 |

---

### 4.3 Chapter 2 — Earth Journey ★（核心体验）

```
┌──────────────────────────────────────────────────────────────┐
│  [Navigation · scrolled 毛玻璃态]                              │
│                                                                │
│  ┌─ 左栏 55% ──────────────────┐ ┌─ 右栏 45% ──────────────┐ │
│  │                              │ │                          │ │
│  │     ┌──────────────┐        │ │   目的地：大理             │ │
│  │     │              │        │ │   云南 · 大理市            │ │
│  │     │   🌍         │        │ │                          │ │
│  │     │   半透明地球   │        │ │  ┌────────────────────┐  │ │
│  │     │   缓慢旋转     │        │ │  │  全屏风景图          │  │ │
│  │     │              │        │ │  │  (苍山洱海)          │  │ │
│  │     │  12 个光点    │        │ │  │                    │  │ │
│  │     │  在球面上     │        │ │  │  ┌──────────────┐  │  │ │
│  │     │              │        │ │  │  │ Glass Data    │  │  │ │
│  │     │              │        │ │  │  │ Card          │  │  │ │
│  │     └──────────────┘        │ │  │  │ 气温 15.3℃    │  │  │ │
│  │                              │ │  │  │ AQI 28       │  │  │ │
│  │     12 个目的地光点           │ │  │  │ 森林 72%      │  │  │ │
│  │     当前聚焦：大理（光晕）     │ │  │  │ 海拔 1970m    │  │  │ │
│  │                              │ │  │  │ 医疗 三甲     │  │  │ │
│  │                              │ │  │  │ 消费 ¥2,500+  │  │  │ │
│  │                              │ │  │  └──────────────┘  │  │ │
│  │                              │ │  └────────────────────┘  │ │
│  │                              │ │                          │ │
│  └──────────────────────────────┘ └──────────────────────────┘ │
│                                                                │
│  [← 上一站]              [5/12 大理]              [下一站 →]   │
│                                                                │
│  [ 深入了解大理 ↓ ]                                            │
└──────────────────────────────────────────────────────────────┘
```

**技术实现**：
- Three.js 渲染半透明地球（`MeshPhysicalMaterial` roughness: 0.3, metalness: 0）
- 地球纹理：NASA Blue Marble + 自定义云层
- 12 个光点使用 `Sprite` 定位在球面坐标（lat/lon → 3D position）
- auto-rotate: `globe.rotation.y += 0.002` per frame
- 点击"下一站"：
  1. 地球减速旋转
  2. 目标光点旋转到正面（TWEEN.js 或 GSAP）
  3. 相机轻微推进（zoom in）
  4. 目标光点放大 + 光晕脉冲
  5. 右侧面板 crossfade 切换目的地内容

**目的地数据面板内容**（每个目的地）：
- 全屏风景图（Unsplash 精选，统一后期）
- 城市名 + 省份
- 一句话介绍（如"苍山洱海间，中国最理想的康养天堂"）
- Glass Data Card：气温、AQI、森林覆盖率、海拔、医疗等级、月消费
- 适合人群标签
- 最佳季节提示

**12 个目的地游览顺序**（可配置）：
```
大理 → 青城山 → 峨眉山 → 巴马 → 桂林阳朔 →
西双版纳 → 武夷山 → 莫干山 → 黄山 → 庐山 →
三亚海棠湾 → 苏马荡
```

---

### 4.4 Chapter 3 — Deep Story（沉浸式目的地故事）

```
┌──────────────────────────────────────────────────────────────┐
│  [Navigation · 透明（叠加在图片上）]                            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │                                                          │ │
│  │              全屏目的地摄影                                 │ │
│  │              (大理 · 苍山洱海)                              │ │
│  │                                                          │ │
│  │         ┌─ Glass Data Card ─┐                            │ │
│  │         │                    │                            │ │
│  │         │  气温 15.3℃        │                            │ │
│  │         │  AQI 28 · 优       │                            │ │
│  │         │  森林覆盖率 72%     │                            │ │
│  │         │  海拔 1,970m       │                            │ │
│  │         │  周边三甲医院 3 家   │                            │ │
│  │         │  月均消费 ¥2,500+   │                            │ │
│  │         │                    │                            │ │
│  │         │  数据更新：2026-07  │                            │ │
│  │         └────────────────────┘                            │ │
│  │                                                          │ │
│  │    ┌─ Narrative Text ──────────────────────────────┐     │ │
│  │    │                                                │     │ │
│  │    │  大理，苍山洱海间的康养天堂                       │     │ │
│  │    │                                                │     │ │
│  │    │  年均气温 15.3℃，四季如春。森林覆盖率 72%，       │     │ │
│  │    │  空气质量常年优良。海拔 1,970m 处于世界公认的       │     │ │
│  │    │  最佳康养海拔区间（1,500-2,500m）。               │     │ │
│  │    │                                                │     │ │
│  │    │  适合：高原适应良好者、呼吸道疾病康复人群、         │     │ │
│  │    │  追求慢生活的高压人群。                           │     │ │
│  │    │                                                │     │ │
│  │    │  最佳季节：3-5 月（春季）、9-11 月（秋季）         │     │ │
│  │    │                                                │     │ │
│  │    └────────────────────────────────────────────────┘     │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [← 上一个目的地]                         [开启旅程 →]        │
│  [换一个目的地]                                               │
└──────────────────────────────────────────────────────────────┘
```

**设计要点**：
- 全屏摄影（同 Unsplash 4K，统一后期：色温 5200K、饱和度 -12%、暗角 +8%）
- Navigation 透明叠加在图片上（白色文字），scroll 后变毛玻璃
- Glass Data Card 在图片中央偏右
- 叙事文字在下部，最大 65ch 行宽
- 底部导航按钮

---

### 4.5 Chapter 4 — AI Recommendation（仪式感 Ending）

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│  [页面从四周向中心慢慢变暗 — vignette animation, 2s]             │
│                                                                │
│                                                                │
│                    你的康养旅程                                  │
│                    即将开始                                      │
│                                                                │
│               DeepSeek 将分析您的                                │
│         健康状况 · 气候偏好 · 预算 · 康养需求                      │
│                                                                │
│                ┌──────────────────┐                            │
│                │                  │                            │
│                │  开始 AI 健康分析  │                            │
│                │                  │                            │
│                └──────────────────┘                            │
│                                                                │
│         已有 12 个精选目的地 · 124 项环境数据 · 等您探索            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

**设计要点**：
- 2 秒 vignette 动画：从四周向中心渐变变暗（`radial-gradient` + opacity transition）
- 文字 fadeIn + slideUp（800ms, delay 400ms）
- 按钮 pulse 微呼吸动画
- 点击按钮 → View Transition API crossfade → questionnaire.html
- 底部极简数据来源

---

## 五、Storyboard

### 5.1 完整叙事时间线

```
时间轴         章节              视觉焦点              用户情绪
────────────────────────────────────────────────────────────
0s–3s      Chapter 0       全屏山峦摄影            震撼、好奇
            Hero            标题淡入
                            Glass Panel 数据

3s–8s      Chapter 0       用户阅读标题+数据        理解产品价值
            Hero            看到"探索平台"按钮

8s–10s     Transition 1    淡入 + 上滑切换          期待
            → Platform     背景变为暖白

10s–20s    Chapter 1       Bento Box 卡片          探索能力
            Platform       依次入场（stagger）
            Center          用户扫视 8 张卡片

20s–25s    Transition 2    页面 fade out            好奇
            → Earth         纯白背景 +
            Journey         地球从中央浮现

25s–40s    Chapter 2       地球缓慢旋转            惊叹
            Earth           12 个光点闪烁
            Journey         用户看到"下一站"按钮

40s–45s    Fly-To #1       地球旋转 → 云南         兴奋
                            光点放大 → 大理
                            右侧面板浮现

45s–55s    Earth Journey   用户浏览大理风景         沉浸
                            阅读 Glass Data Card

55s–60s    Fly-To #2       地球旋转 → 四川         继续探索
                            光点放大 → 青城山

...循环 2-4 个目的地...

80s–85s    Transition 3    页面切换                 深入
            → Deep Story    全屏大理风景图

85s–100s   Chapter 3       沉浸式大理展示           感动
            Deep Story      叙事文字 + 数据

100s–105s  Transition 4    页面从四周变暗           仪式感
            → Ending        vignette effect

105s–115s  Chapter 4       文字浮现 + 按钮          坚定
            AI Ending       "开始 AI 健康分析"

115s       → questionnaire  页面切换                行动
```

### 5.2 关键情感曲线

```
 情感强度
   ↑
   │          ★ Earth Journey（惊叹）
   │         / \
   │        /   \                                   ★ Ending（坚定）
   │       /     \                                 /
   │      /       \      ★ Deep Story（感动）      /
   │     /         \    /                        /
   │    /           \  /                        /
   │   ★ Hero        \/                        /
   │   (好奇)         /\                       /
   │                 /  \                     /
   │                /    ★ Platform（探索）   /
   │               /                        /
   └──────────────────────────────────────────→ 时间
```

---

## 六、页面切换方式

### 6.1 切换触发

**不使用连续滚动。** 每个章节之间的切换由按钮点击触发。

| 章节 | 触发按钮 | 目标 |
|------|---------|------|
| Hero | "探索平台 ↓" | Platform Center |
| Platform | "探索世界 ↓" | Earth Journey |
| Earth | "深入了解 ↓" | Deep Story |
| Deep | "开启旅程 ↓" | AI Ending |
| AI | "开始 AI 健康分析" | questionnaire.html |

### 6.2 切换动画规范

| 过渡 | 动画 | 时长 | 缓动 |
|------|------|------|------|
| Hero → Platform | fade out Hero bg + Nav 变毛玻璃 + 内容区 slideUp fadeIn | 800ms | ease-out-expo |
| Platform → Earth | 背景切换纯白 + 地球 scaleUp + 其他元素 fadeIn | 1000ms | ease-out-expo |
| Earth → Deep | 地球 fadeOut + 全屏图片 fadeIn（crossfade 600ms） | 800ms | ease-out-expo |
| Deep → AI | 页面 vignette 变暗（radial-gradient 从中心到边缘） | 2000ms | ease-out-expo |
| AI → questionnaire | View Transition API crossfade | 300ms | ease-out |

### 6.3 实现方案

```javascript
// 章节管理器
const ChapterManager = {
  currentChapter: 0,
  chapters: ['hero', 'platform', 'earth', 'deep', 'ending'],

  async goTo(targetIndex) {
    const current = this.chapters[this.currentChapter];
    const target = this.chapters[targetIndex];

    // 1. 当前章节退出动画
    await this.exitAnimation(current);

    // 2. 目标章节入场动画
    await this.enterAnimation(target);

    // 3. 更新 URL hash（可选）
    window.location.hash = target;

    // 4. 更新导航状态
    this.currentChapter = targetIndex;
  }
};
```

**CSS 章节容器**：
```css
.chapter {
  position: relative;
  width: 100%;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(40px);
  transition: opacity var(--duration-slow) var(--ease-out-expo),
              transform var(--duration-slow) var(--ease-out-expo);

  &.active {
    opacity: 1;
    transform: translateY(0);
  }

  &.exiting {
    opacity: 0;
    transform: translateY(-30px);
  }
}
```

---

## 七、动效设计

### 7.1 动效总览

| 类型 | 场景 | 实现 |
|------|------|------|
| **入场动画** | 每个章节进入 | fadeUp + slideUp 600–800ms |
| **退出动画** | 每个章节离开 | fadeDown + slideDown 400–600ms |
| **地球旋转** | Earth Journey 背景 | Three.js auto-rotate 0.002 rad/frame |
| **Fly-To** | 飞向目的地 | GSAP/TWEEN 动画地球 rotation + camera zoom |
| **光点脉冲** | 目的地标记高亮 | CSS animation pulse + glow |
| **面板切换** | 右侧目的地数据 | crossfade 400ms + 图片 slide 方向跟随地球 |
| **数字滚动** | Glass Data Card 数据更新 | Count-Up 动画 600ms |
| **Vignette** | AI Ending 变暗 | radial-gradient opacity 0 → 0.85 2s |
| **Stagger** | Platform Bento Box 卡片 | 每张 delay 120ms |
| **磁吸按钮** | 所有 CTA 按钮 | Magnetic ±3px（已实现） |
| **View Transition** | 页面跳转 | View Transition API crossfade 300ms |

### 7.2 Earth Journey Fly-To 详细编排

```
步骤  时间    动画
─────────────────────────────────────────────────
1     0ms     用户点击"下一站"
2     0–200ms 地球 rotation 减速（从 auto-rotate 到手动控制）
3     200ms   目标光点 emit 一圈涟漪（CSS radial scale 动画）
4     200–800ms 地球旋转到目标位置（GSAP to rotation.y, 600ms ease-out-expo）
5     500–1000ms 相机轻微 zoom in（camera.position.z 减小 15%）
6     700–1000ms 目标光点 scale 1→1.8→1.2（spring 弹跳）
7     800–1000ms 右侧面板 crossfade + slideIn（新目的地数据）
8     1000ms   地球恢复 auto-rotate（减速 0.001 rad/frame）
9     1000ms   数字 count-up 动画完成
```

### 7.3 动画性能策略

- Three.js: 使用 `requestAnimationFrame`，独立 render loop
- CSS 动画: `transform` + `opacity` only（GPU 加速）
- 图片: 懒加载 + blur-up（IntersectionObserver）
- `will-change`: 仅用于动画期间的 Globe 和 Hero 面板
- `prefers-reduced-motion`: 全局降级（跳过所有入场动画，直接显示最终状态）

---

## 八、数据来源规划

### 8.1 数据依赖

| 章节 | 需要的数据 | 来源 | 获取方式 |
|------|-----------|------|----------|
| Hero Glass Panel | 平均 AQI、森林覆盖率、省份数、医疗等级 | API | `GET /api/destinations` → 前端计算统计 |
| Platform Center | 无实时数据（UI 占位） | — | — |
| Earth Journey | 12 个目的地坐标 + 名称 + 图片 + 所有环境数据 | API | `GET /api/destinations` |
| Deep Story | 单个目的地完整数据 + 叙事文本 | API | `GET /api/destinations?id=X` |
| AI Ending | 12 个目的地数量 + 数据维度数 | API | 同 Hero |

### 8.2 图片资源

| 目的地 | Unsplash 搜索关键词 |
|--------|-------------------|
| 大理 | "Dali Yunnan Erhai lake mountain" |
| 青城山 | "Mount Qingcheng Sichuan mountain mist" |
| 峨眉山 | "Mount Emei Sichuan temple mountain" |
| 巴马 | "Bama Guangxi karst landscape" |
| 桂林阳朔 | "Yangshuo Guilin karst river" |
| 西双版纳 | "Xishuangbanna Yunnan tropical rainforest" |
| 武夷山 | "Mount Wuyi Fujian tea plantation" |
| 莫干山 | "Moganshan Zhejiang bamboo forest" |
| 黄山 | "Huangshan Yellow Mountain sunrise clouds" |
| 庐山 | "Mount Lushan Jiangxi mountain mist" |
| 三亚海棠湾 | "Haitang Bay Sanya beach" |
| 苏马荡 | "Enshi Hubei mountain village" |

**图片规范**（参考 Aman 摄影后期）：
- 分辨率：≥ 1920×1080（Unsplash 默认足够）
- 色温：5000–5600K
- 饱和度：-10%
- 对比度：+5%
- 暗角：+8%
- 统一使用 CSS `filter: saturate(0.9) contrast(1.05)` 做浏览器端后期

---

## 九、技术方案

### 9.1 Three.js 地球实现

```javascript
// 核心依赖
import * as THREE from 'three';
// 使用 CDN: https://unpkg.com/three@0.160.0/build/three.min.js

// 场景搭建
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 100);
camera.position.z = 12;

// 地球
const globeGeometry = new THREE.SphereGeometry(3, 64, 64);
const globeMaterial = new THREE.MeshPhysicalMaterial({
  map: earthTexture,           // NASA Blue Marble
  roughness: 0.4,
  metalness: 0.05,
  clearcoat: 0.1,
  transparent: true,
  opacity: 0.85,               // 半透明效果
});
const globe = new THREE.Mesh(globeGeometry, globeMaterial);

// 大气光晕
const atmosphereGeometry = new THREE.SphereGeometry(3.15, 64, 64);
const atmosphereMaterial = new THREE.ShaderMaterial({
  // Fresnel shader: 边缘发光，中心透明
  vertexShader: `...`,
  fragmentShader: `...`,
  blending: THREE.AdditiveBlending,
  transparent: true,
  opacity: 0.3,
});

// 12 个目的地光点
destinations.forEach((dest, i) => {
  const { x, y, z } = latLonToVector3(dest.lat, dest.lon, 3.05);
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(x, y, z);
  sprite.scale.set(0.15, 0.15, 1);
  globe.add(sprite);
});

// 云层（可选）
const cloudGeometry = new THREE.SphereGeometry(3.02, 64, 64);
const cloudMaterial = new THREE.MeshPhongMaterial({
  map: cloudTexture,
  blending: THREE.AdditiveBlending,
  transparent: true,
  opacity: 0.2,
});

// 动画循环
function animate() {
  requestAnimationFrame(animate);
  globe.rotation.y += autoRotateSpeed;
  cloudLayer.rotation.y += autoRotateSpeed * 1.2;
  renderer.render(scene, camera);
}
```

### 9.2 技术栈决策

| 层级 | 技术 | 理由 |
|------|------|------|
| 3D 地球 | Three.js CDN (v0.160+) | 轻量、成熟、社区最活跃 |
| 动画编排 | GSAP (CDN) | Fly-To 等复杂时间线需要 GSAP Timeline |
| 章节管理 | 自定义 Vanilla JS | 不需要 React/Vue，保持零框架 |
| 图片 | Unsplash Source API | 免费高质量、CDN 加速 |
| CSS | 已有 tokens.css Design System | 保持不变 |
| 响应式 | 已有 responsive.css | 扩展 3D 视图的移动端适配 |

### 9.3 CDN 依赖

```html
<!-- Three.js -->
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
  }
}
</script>

<!-- GSAP -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
```

### 9.4 文件结构（新增）

```
frontend/
├── index.html              # 🔄 重写：5 章节结构
├── css/
│   ├── tokens.css          # 不变
│   ├── reset.css           # 不变
│   ├── fonts.css           # 不变
│   ├── nav.css             # 🔄 扩增：章节感知的 Nav 状态
│   ├── hero.css            # 🔄 微调：Hero 作为 Chapter 0
│   ├── buttons.css         # 不变
│   ├── cards.css           # 🔄 扩增：Bento Box 卡片布局
│   ├── sections.css        # 🔄 扩增：章节容器通用样式
│   ├── map.css             # 保留（向后兼容）
│   ├── footer.css          # 不变
│   ├── responsive.css      # 🔄 扩增：新章节响应式
│   ├── ux.css              # 保留（View Transition / Magnetic / Skeleton）
│   ├── chapters.css        # 🆕 章节系统（Chapter Container, Transition, Active/Exit state）
│   ├── platform.css        # 🆕 Platform Center Bento Box 布局
│   ├── earth.css           # 🆕 Earth Journey 3D 地球容器 + 右侧面板
│   ├── deep-story.css      # 🆕 Deep Story 全屏沉浸式展示
│   ├── ending.css          # 🆕 AI Ending 仪式感页面
│   └── style.css           # 模块入口
├── js/
│   ├── api.js              # 不变
│   ├── icons.js            # 不变
│   ├── nav.js              # 🔄 扩增：章节激活时 Nav 状态
│   ├── hero.js             # 🔄 扩增：Hero → Chapter 0 适配
│   ├── cards.js            # 保留（向后兼容）
│   ├── overview.js         # 保留（向后兼容）
│   ├── map.js              # 保留（向后兼容）
│   ├── animations.js       # 🔄 扩增：章节动画协调
│   ├── main.js             # 🔄 重写：章节管理器入口
│   ├── ux.js               # 保留
│   ├── chapter-manager.js  # 🆕 章节管理器（核心）
│   ├── globe.js            # 🆕 Three.js 地球初始化 + 渲染循环 + Fly-To
│   ├── earth-panel.js      # 🆕 Earth Journey 右侧面板内容管理
│   ├── deep-story.js       # 🆕 Deep Story 内容填充
│   └── chapter-ending.js   # 🆕 AI Ending 动画
└── data/
    └── destinations.geojson # 不变
```

### 9.5 不修改的文件

- `backend/` 全部（API、数据库、AI 引擎）
- `questionnaire.html` 业务逻辑
- `results.html` 业务逻辑
- `frontend/data/destinations.geojson`

---

## 十、后续开发顺序

### 开发策略

**一个章节一个章节地开发，每完成一个验证一个。** 不一次重写整个 index.html。

### Phase 顺序

```
Phase 1: 基础设施
  ├── 1.1 创建 chapters.css（章节容器 + 切换动画）
  ├── 1.2 创建 chapter-manager.js（章节状态管理 + 按钮驱动切换）
  ├── 1.3 重写 main.js（章节管理器初始化）
  └── 验证：Hero → Platform 切换正常

Phase 2: Platform Center
  ├── 2.1 创建 platform.css（Bento Box 不等大网格）
  ├── 2.2 在 index.html 创建 Platform Center HTML 结构
  ├── 2.3 8 张功能卡片（图标 + 标题 + 描述 + hover 动画）
  ├── 2.4 Stagger 入场动画（120ms/张）
  └── 验证：Hero → Platform → 返回 Hero 正常

Phase 3: Earth Journey ★ 核心
  ├── 3.1 引入 Three.js + GSAP CDN
  ├── 3.2 创建 globe.js（初始化 + 渲染循环 + auto-rotate）
  ├── 3.3 创建 earth.css（地球容器 + 右侧面板）
  ├── 3.4 12 个光点定位（latLonToVector3）
  ├── 3.5 Fly-To 动画（TWEEN 或 GSAP）
  ├── 3.6 右侧面板切换（crossfade + count-up）
  ├── 3.7 创建 earth-panel.js（面板内容管理）
  └── 验证：Platform → Earth → 多次 Fly-To → 正常

Phase 4: Deep Story
  ├── 4.1 创建 deep-story.css（全屏沉浸式）
  ├── 4.2 在 index.html 创建 Deep Story HTML
  ├── 4.3 全屏风景图 + Glass Data Card + 叙事文字
  ├── 4.4 创建 deep-story.js（内容填充）
  └── 验证：Earth → Deep Story → 正常

Phase 5: AI Ending
  ├── 5.1 创建 ending.css（vignette 动画）
  ├── 5.2 在 index.html 创建 AI Ending HTML
  ├── 5.3 Vignette 动画 + 文字浮现 + 按钮呼吸
  ├── 5.4 创建 chapter-ending.js
  └── 验证：Deep → Ending → 跳转 questionnaire.html

Phase 6: 移动端适配
  ├── 6.1 3D 地球移动端降级（减小分辨率 + 简化着色器）
  ├── 6.2 Deep Story 移动端布局（图片在上、文字在下）
  ├── 6.3 Platform Center 移动端 Bento Box 变为 2 列
  ├── 6.4 Earth Journey 移动端：地球在上、面板在下（非分栏）
  └── 验证：768px / 430px / 390px 正常

Phase 7: 性能优化 + 无障碍
  ├── 7.1 Three.js 纹理压缩 + LOD
  ├── 7.2 图片懒加载 + blur-up
  ├── 7.3 prefers-reduced-motion 全局降级
  ├── 7.4 Keyboard Navigation（Tab 切换章节）
  └── 验证：Lighthouse > 85

Phase 8: 最终验收
  ├── 8.1 全流程走通（Hero → Platform → Earth → Deep → Ending → questionnaire）
  ├── 8.2 图片统一后期（12 个目的地 Unsplash URL 确认）
  ├── 8.3 动画节奏微调
  └── 验证：完整用户体验
```

---

## 附录：设计决策记录

| # | 决策 | 理由 |
|---|------|------|
| 1 | 使用按钮驱动而非 scroll-driven | 比 scroll 更可控、更有仪式感；用户明确"进入下一章节" |
| 2 | Three.js 而非 Leaflet 做地球 | Leaflet 是 2D 地图，无法实现旋转地球 + Fly-To 的 3D 空间感 |
| 3 | GSAP 做 Fly-To 动画 | TWEEN.js 也可行，但 GSAP Timeline 编排更强大 |
| 4 | 保持零框架（无 React/Vue） | 与现有 tech stack 一致，Three.js + GSAP 的 vanilla 集成最直接 |
| 5 | 先做 UI 再实现功能 | Platform Center 中 6/8 卡片暂时是 UI 占位，未来逐步激活 |
| 6 | 每个 Phase 独立验证 | 防止一次重写整个页面后无法排查问题 |
| 7 | Earth Journey 支持 2+ 目的地"环游" | 不是一次性展示，用户可以一直点"下一站"环游全部 12 个 |
| 8 | Deep Story 复用 Earth Journey 选中的目的地 | 避免重复的数据选择 UI |

---

*Design Plan v1.0 · Sprint 7 · 2026-07-23*
