# M11 iPhone App 与发布收口方案

更新时间：2026-08-24

## 产品结论

采用“SwiftUI 原生主应用 + Web 空间体验”的混合架构。目的地浏览、地图、收藏、状态、AI 入口和后续路线保存使用原生界面；Three.js 地球作为沉浸式探索子体验保留。禁止把整站直接套入 WebView 后提交 App Store。

## M11 阶段

### M11.0 原生基础（本轮）

- [x] 建立 iOS 17+ SwiftUI 工程。
- [x] 接入 `/api/health` 和 `/api/destinations`。
- [x] 原生目的地列表、详情、MapKit 地图和本机收藏。
- [x] 保留 Three.js 空间入口。
- [x] 使用 iOS Simulator SDK 完成 Swift 编译、链接和 App Bundle 构建。
- [ ] 安装 iOS 26.5 Simulator Runtime 后完成多尺寸视觉验收。

### M11.1 核心决策闭环

- [ ] 原生问卷与推荐报告。
- [ ] 原生可信依据追问与引用展示。
- [ ] 原生路线列表、路线版本和离线摘要。
- [ ] 深链统一目的地、报告和路线上下文。

### M11.2 iPhone 体验与隐私

- [ ] Dynamic Type、VoiceOver、减少动态效果和横竖屏策略。
- [ ] 弱网、离线、图片缓存和恢复策略。
- [ ] 最小化健康、位置和自由文本采集。
- [ ] 隐私政策、数据删除、App Privacy 和第三方 SDK 清单。

### M11.3 TestFlight 与 App Store

- [ ] 正式域名与 HTTPS；Release 不允许本机地址。
- [ ] Apple Developer Team、Bundle ID、签名和版本号。
- [ ] App Icon、启动页、截图、说明、支持与隐私 URL。
- [ ] 真机、TestFlight、崩溃、性能和审核说明。

## 当前环境说明

Xcode 26.6 和 iOS 26.5 SDK 已安装，M11.0 target 构建成功。当前 Mac 未安装 iOS 26.5 Simulator Runtime，因此不能启动虚拟 iPhone；需要在 Xcode → Settings → Components 安装对应 Runtime 后继续截图、触摸和多尺寸验收。

## 发布硬门槛

- 后端与静态资源必须部署在 HTTPS。
- 外部 AI 继续要求明示授权；默认本地规则/RAG。
- 康养结论必须展示来源与非医疗诊断边界。
- 不能请求非必要的定位、健康、通讯录、相册或跟踪权限。
- App 在 Web 子体验不可用时仍能完成目的地浏览和基本决策任务。
