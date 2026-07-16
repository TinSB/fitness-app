# 交接件：休息 Live Activity 修 Bug + 质感升级（owner 真机反馈批）

> 日期：2026-07-16 ｜ 来源：owner 1.7(24) 真机实测反馈（灵动岛截图 ×3）
> 性质：ROUTE-MAINTENANCE（bug×2）+ 计划内打磨（质感细节）
> 上游：#701 K6 休息 Live Activity（docs/工作记录/2026-07-16-fullness2-handoff.md）

## Agent Contract

- **Role**：iOS 实施工程师（ActivityKit / SwiftUI Live Activity）
- **Scope**：只动休息 Live Activity 三件套 + 其直接调用点。禁止碰通知策略、RestCountdown 本体、App Group 快照管线、其他 widget。
- **Inputs**：本交接件 + 下列现场文件
- **Outputs**：修复 + 打磨代码、模拟器实拍与离线渲染证据、实施回执（模板见文末）
- **Tools**：Read/Edit/Bash/xcodebuild/simctl；不装新依赖
- **Budget**：单 agent 串行；同一问题修 3 次不过即停（三振出局）
- **Stop condition**：验收标准全绿 + gate exit 0；或触红线/歧义即停回报
- **Handoff target**：主会话验收（三 lens 审查 + 规格写回 + PR）

## 现场文件（全部已存在，无需新建文件）

| 文件 | 角色 |
|---|---|
| `ios/RedeWidget/RestLiveActivity.swift` | widget extension UI（锁屏 + 灵动岛四态）——主战场 |
| `ios/packages/RedeWidgetShared/Sources/RedeWidgetShared/RestActivityAttributes.swift` | app/extension 共享合同（`#if os(iOS)`） |
| `ios/Rede/RestLiveActivityController.swift` | app 侧生命周期管理（串行 Task 链） |
| `ios/Rede/SessionStore.swift` | 调用点（begin/updateEnd/end 挂接，勿动其他部分） |

**不需要改 pbxproj**（无新文件）。RedeWidgetShared 是 SPM 包，改文件即生效。

## Bug 1（P1）：灵动岛胶囊态倒计时不显示

**owner 复现**：休息开始 → 直接回桌面 → 灵动岛胶囊只显示左侧 timer 图标，右侧空白；长按展开一次后，收起的胶囊才开始显示倒计时。

**假设根因（社区已知问题）**：`Text(timerInterval:)` 的理想宽度按最坏计时字符串测量（贪婪），在 compactTrailing 的宽度预算内放不下时系统直接丢弃该视图；`.frame(maxWidth: 44)` 约束不了理想宽度测量。已知修法（按优先级试）：

1. **固定宽度** `.frame(width: ~40)`（休息时长量级「M:SS」，13pt monospaced 实测后定值，宁大勿裁）
2. iOS 17 新 API `Text(.currentDate, format: .timer(countingDownIn: range))`（内容真实测量，部署目标 iOS 17 满足）

**流程要求（宪法 §3.6）**：先在模拟器复现（iPhone Pro 系机型模拟器渲染灵动岛；启动休息后回桌面截图胶囊态），确认右侧空白 → 再修 → 同路径复验出现倒计时。若模拟器无法复现原 bug，如实写进回执（不许写「已复现」），修法按社区已知问题依据落地，真机复验项移交 owner 下个 build。

## Bug 2（P2）：展开态内容垂直偏上

`DynamicIslandExpandedRegion(.leading)` 的 VStack 与 `.trailing` 的倒计时默认顶对齐。修法：两个 region 的内容都加 `.frame(maxHeight: .infinity, alignment: <各自水平对齐>)` 垂直居中，左块与右侧倒计时同轴心。

## 质感升级（P3，克制纪律：不花哨、一眼可读）

核心抓手：**原生自更新进度环/条**（`ProgressView(timerInterval:countsDown:)`，iOS 16+，Live Activity 内系统自驱动，零推送零轮询——苹果自家计时器灵动岛同款语言）。

需要 `ContentState` 增加休息起点：

```swift
public struct ContentState: Codable, Hashable {
    public let restStartedAt: Date   // 新增：本段休息起点（进度分母锚点）
    public let restEndsAt: Date
}
```

- **controller 侧**：`begin` 传入起点（= 休息锚点时刻，即调用时挂点的当下）；`updateEnd`（+30 加时）**保留原 restStartedAt**（从 `activity.content.state` 读回），进度按新总时长回落——诚实语义，不重置。
- **暂停语义不变**：暂停 = end + 重锚（恢复时 begin 新活动，起点=恢复时刻）。不显假计时的既有契约不动。
- Live Activity 是短命对象、app 与 extension 同 build 部署，**无迁移面**；但两侧必须同批改完编译过。

四个表面的打磨清单（全部 ember 单焦点纪律：橙=倒计时/进度，其余 t1/t3）：

| 表面 | 改动 |
|---|---|
| compactLeading | 静态灰 timer 图标 → **ember 环形进度**（`ProgressView(timerInterval:).progressViewStyle(.circular).tint(ember)`；必要时内嵌小 timer 图标看密度效果定） |
| compactTrailing | 倒计时文字（Bug 1 修复后），ember，monospaced |
| minimal | 同 compactLeading 的环形进度（替代静态 ember 图标——有进度信息优于纯图标） |
| expanded | 左右内容垂直居中（Bug 2）+ **bottom region 细线性进度条**（ember 填充 + t3 低透明度轨道，高度 ~4pt 圆角；克制，无文字） |
| 锁屏 | 现有行下方加同款细进度条；整体 padding 微调保持呼吸感 |

**陈旧态纪律延续**：`context.isStale` 时数字已退 t3——环与条同样退 t3（灰化全家桶，不许橙色假活）。

**禁改**：RestPalette 四色值（app 侧 RedeTheme 手抄副本契约）；通知职责（本表面不发声）;「不建 app 内开关」裁定；extension 零业务计算（只渲染传入值）。

## 迭代方法：离线渲染循环（热力图 v2 同法）

展开态/锁屏布局细节不要用「编译→装模拟器」慢循环调：写一次性 swiftc 渲染脚本（**必须命名 main.swift**，top-level 代码约束）把锁屏卡与 expanded 布局组合渲成 PNG 反复调，满意后移植回 widget 文件。脚本放 `.ai-tmp/2026-07-16-live-activity-polish/`，属 SCRATCH。注意：`Text(timerInterval:)`/`ProgressView(timerInterval:)` 离线渲染是静态帧即可（验证布局与配色，不验证自更新）。

## 验证与证据（全部落 docs/工作记录/，文件名前缀 `2026-07-16-liveactivity-`）

1. **Bug 1 复现/修复对**：模拟器胶囊态 修复前空白截图（能复现时）+ 修复后显示倒计时截图。操作路径：`-autoStartSession` 钩子起训练 → 记一组进入休息 → 回桌面（osascript 给 Simulator 发 Cmd+Shift+H）→ `simctl io booted screenshot`。**截图前确认前台是 Rede 不是 Larder**（共用模拟器教训）。
2. **锁屏面**：osascript 发 Cmd+L 锁屏 → 截图（进度条 + 布局）。
3. **expanded 布局**：模拟器长按手势不可脚本化——用离线渲染 PNG 证明居中与进度条造型（说明这是布局证据，非真机行为证据）。
4. **+30 语义**：代码走查说明 restStartedAt 保留逻辑（controller diff 摘要）。
5. **gate**：仓库根跑 `.claude/quality-gate.cmd`，exit 0 原文（**不许从 ios/packages 子目录跑**，exit 127 教训）。
6. **build→install 纪律**：装模拟器前必须真跑 `xcodebuild build`（showBuildSettings 不编译，装旧包教训）。

## 验收标准（owner 大白话）

1. 休息时直接回桌面，灵动岛胶囊**立刻**左环右数：不需要先展开一次。
2. 长按展开，「动作名 + 目标」与倒计时垂直居中，底部一条细进度条。
3. 锁屏卡有同款细进度条，倒计时走字。
4. +30 加时后进度条按新总长回落，不闪不重置。
5. 到点后系统滞留期整卡灰化（无橙色假活）。
6. 训练页/通知行为零变化。

## Git 纪律

- 从 main（36a4c3d）拉分支 `codex/0716-liveactivity-fix-polish`，小步提交（bug 修复与质感升级可分 commit），每 commit gate exit 0。
- **不 push 不开 PR**（主会话验收后统一走）；不动 main。

## 实施回执模板（收尾必填）

```
## 实施回执
- Bug 1 模拟器复现：[成功复现空白/未能复现+原因] → 修法：[固定宽度/新API] → 复验：[截图文件名]
- Bug 2 修法：[diff 摘要]
- ContentState 变更：[字段+两侧编译确认]
- 质感清单落地：[四表面逐项+离线渲染迭代轮数]
- 陈旧态灰化：[环/条/数字三件确认]
- gate：[exit code + 关键行]
- 证据文件：[逐一列出]
- 未尽事项/需真机复验项：[如实列]
- SCRATCH 产物：[路径，待 hygiene]
```

## 实施回执（2026-07-16 回填）

- **Bug 1 模拟器复现**：**未能复现**——iPhone 17 Pro 模拟器（iOS 26.5）两次严格按 owner 路径（记一组进休息 → Cmd+Shift+H 立即回桌面 → simctl 截图），胶囊态右侧倒计时均正常显示（1:57 / 1:52）；与社区已知现象一致（`Text(timerInterval:)` 贪婪宽度丢弃仅真机触发）。旁证：修复前模拟器胶囊被撑到近乎全宽，证明理想宽度测量确实贪婪。→ 修法：固定宽度 `frame(width: 40, alignment: .trailing)`（swiftc 实测 13pt medium monospacedDigit：`M:SS`=29.0pt、`MM:SS`=37.3pt，40pt 宁大勿裁；未动用 iOS 17 新 API 备选）→ 复验：同路径修后正常（compact-after.png，左环右数 1:09）；**真机空白态复验移交 owner 下个 build**。
- **Bug 2 修法**：expanded 左 VStack `.frame(maxHeight: .infinity, alignment: .leading)`、右倒计时 `.frame(maxWidth: 84, maxHeight: .infinity, alignment: .trailing)`——两 region 撑满高度垂直居中同轴心；真机长按不可脚本化，以离线渲染 PNG 作布局证据。
- **ContentState 变更**：新增 `restStartedAt: Date`（进度分母锚点）；RedeWidgetShared + app + widget extension 同批 `xcodebuild build` 通过；全仓 grep 确认 `ContentState(` 仅 controller 两处调用点、均已带新字段。
- **质感清单落地**（离线渲染迭代 2 轮定稿）：compactLeading 静态灰图标 → ember 环形 `ProgressView(timerInterval:).circular`（环内嵌小图标经密度评估弃用，纯环胜出）；compactTrailing 倒计时（固定 40pt）；minimal 同款环；expanded 左右垂直居中 + bottom 4pt 细线性进度条（ember 填充 + t3 0.25 轨道垫底 Capsule，边距 4 顶距 8）；锁屏行下同款细条（行间 12、垂直 padding 16→14）。controller：`begin` 在 enqueue 外捕获起点；`updateEnd`(+30) 从 `activity.content.state` 读回原 `restStartedAt`，进度按新总长诚实重算不重置。
- **陈旧态灰化**：环/条/数字三件全部 `isStale ? t3 : ember`（数字含 compact/expanded/锁屏三处口径补齐）；锁屏 stale 实拍整卡灰化；灵动岛 stale 后由系统直接隐藏活动（OS 26 行为，锁屏保留）。验收后追补：keylineTint 同退灰（审查 NIT）。
- **gate**：三次（每 commit 前）仓库根 `.claude/quality-gate.cmd` 全部 exit=0（9 包 swift test + forged-card 预算 + xcodebuild BUILD SUCCEEDED）。
- **证据文件**：`2026-07-16-liveactivity-compact-before.png`（修复前，未复现空白）/ `compact-after.png`（ember 环 + 1:09）/ `lockscreen-bar.png`（0:24 + 细条；首挂 Allow 提示同框）/ `lockscreen-stale.png`（滞留期整卡灰化）/ `expanded-offline.png`（离线渲染定稿组合——布局证据，非真机行为证据）。
- **未尽事项/需真机复验项**：① Bug 1 真机空白态修复效果；② expanded 长按实看（居中+底条）；③ +30 进度回落实操；④ 灵动岛 stale 即隐藏的真机表现。禁改项全守住：RestPalette 四色值、通知职责、暂停=end+重锚、extension 零业务计算、无 app 内开关。
- **SCRATCH 产物**：`.ai-tmp/2026-07-16-live-activity-polish/`（渲染脚本/二进制/迭代 PNG/宽度实测），验收 hygiene 时清理。

## 验收附记（2026-07-16 主会话）

三 lens 审查 + 对抗核验：**1 MAJOR + 4 MINOR + 1 NIT 确认，1 驳回**（ContentState 非可选字段升级破坏论——升级中途在飞活动无证据存活，且启动 endAll 兜底，判非问题）。MAJOR = ember 进度环/条与设计语言 §15.2「休息倒计时条=redeSteel」字面冲突 → 裁定 scoped 豁免落纸（LA 表面无「下一组」CTA，让位理由不成立；数字 ember 有 PRD 背书；灰环黑底不可见毁质感目标），owner 真机可否决。其余：keylineTint 灰化闭环（当场修）、设计语言补 Live Activity 节、系统逻辑 §7.1 补写回 + 「七端点」修正为十三端点、PRD FR-TR13 口径更新、本回执回填——全部在验收批落地。
