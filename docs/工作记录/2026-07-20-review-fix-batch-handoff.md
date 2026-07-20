# 交接件：Codex 批审查修复批（四 lens findings 落地 + UX 收敛 + 治理收口）

> 日期：2026-07-20 ｜ 来源：Codex 18 提交批的四 lens 审查（1 MAJOR=0，7 MINOR + 4 NIT 确认）
> 性质：ROUTE-MAINTENANCE（审查 findings）+ 已批准 UX 收敛（owner 授权代决）
> owner 授权：「需要决断的地方替我做出最好的决定，达到企业验收标准」——本件裁定即最终裁定

## Agent Contract

- **Role**：iOS 实施工程师（SwiftUI + 文档治理）
- **Scope**：本件列出的 A-F 六组改动，禁止越界（尤其禁碰订阅 fail-closed 判定逻辑、禁开购买闸）
- **Inputs**：本交接件 + 审查结果（细节在各条目内已内联）
- **Outputs**：代码 + 文档 + 模拟器实拍证据 + 实施回执（模板文末）
- **Tools**：Read/Edit/Bash/xcodebuild/simctl；不装新依赖
- **Budget**：单 agent 串行；同一问题修 3 次不过即停
- **Stop condition**：验收全绿 + gate exit 0；触红线/歧义即停回报
- **Handoff target**：主会话验收（多 lens 审查 + PR）

## Git 纪律（⚠️ 特殊）

- 当前分支 `codex/2026-07-19-session-customization-s1` 是 Codex 的工作分支（18 个未推送提交）。**从当前 HEAD 新建分支 `codex/2026-07-20-review-fix-batch`**，在新分支上做，不动 Codex 分支本体。
- owner 有并行 Codex 会话习惯：**每次 commit 前重跑 `git status` 确认没有别人的新改动混入，add 用明确 pathspec 不用 `git add -A`**。
- 小步提交（UX / 引擎修复 / 文档治理可分 commit），每 commit 前仓库根跑 `.claude/quality-gate.cmd` exit 0。不 push 不开 PR（主会话验收后统一走）。

## A. 今日页更新提示收敛（裁定：单行化 + 移页底，两案同做）

现状：TodayTabView 的更新提示是 overline+headline+双动作三层块，压在训练判断上方——今日页第一个与训练无关的顶部常驻块，且 overline 用 ember2 违反「ember 只标训练下一步」精神。

改法：
1. 压成**单行开放行**：「新版本 X.Y · 查看 · 稍后」量级（caption/callout 级；仅「查看」可带 ember2，其余中性）。保留 7 天稍后语义与两个动作，功能零损失。
2. 整行**移到页底 receipt 区之后**（更新是低频运维信息）。设置页「版本与更新」常驻入口保证可发现性。
3. AppUpdateRuntimeTests 里涉及 UI 观察面的测试同步更新；双语文案（AppUpdateCopy）若需精简同步改精确文案测试。a11y label 完整保留。

## B. 设置页订阅区收敛（裁定：两行化，事务控件聚到 Coach 页）

现状：订阅区最多 7 行，其中「恢复购买」「隐私/条款」与 Coach 页 StoreKit 购买面的原生同款控件在同一门禁条件下真实重复。

改法：
1. 设置页订阅区收敛为**两行**：「方案 · Free Core/Rede Coach」事实行 + 「查看 Rede Coach ›」入口行。
2. 恢复购买/隐私/条款：依赖 Coach 页购买面已有的 Apple 原生控件（`.storeButton(restorePurchases)` + policy destinations），设置页删除重复项。
3. 「管理订阅」移到 Coach 页：付费态在 WeeklyCoachReviewView 下方加页脚「管理订阅 ›」；free+store 态放购买面 marketing shell 底部。
4. **红线**：RedeCoachPageContentPolicy 的 entitlement 矩阵语义不得变（只动行的归属，不动门禁条件）；AccessPolicyTests/矩阵测试全部保持绿或按新布局如实更新断言。

## C. 训练页「接下来」行补回组次预告（NIT）

「接下来」开放行动作名后补回 caption 级「· 3 × 8」（monospacedDigit、redeT4），不新增行；a11y label 同步。静态行（已有正式事实后的不可点态）同样带上。

## D. 周教练复盘两处防线加固

1. **长 ISO 日期归一**（WeeklyReviewFacts.swift）：clean session 的 date 解析改为仓内惯例 `String(date.prefix(10))` 归一后再严格校验（与 K8 行/TodayCompletedDigest 同姿态），消灭「免费行练 1 天 vs 付费页没记录」的同屏分叉可能。补长 ISO 输入的锁测试（builder 层）。
2. **0kg 假精度防线测试锁**：WeeklyCoachReviewView 私有 loader 里 `calibrating ? nil : deltaKg` 这行是唯一防线且不可测。把 TrendAssessment → WeeklyCoachLiftSignal 映射提炼为与 MemoPolicy 同级的 internal 纯函数（该文件已有此模式），补 app-hosted 测试：「calibrating 输入 deltaKg=0 → 输出 nil」。

## E. 文档治理

1. **CHANGELOG 补两条**：`## 2026-07-19` durable session reordering（FR-TR14 S1：typed move event + durable draft barrier + 杀进程恢复）；`## 2026-07-18` review request（≥3 场 / 每版本一次 / 空版本不弹；官方 requestReview）。英文，对齐既有条目风格。
2. **评分请求规格写回**：PRD 新立 FR 条目（编号先 `grep "^| FR-"` 查占用防撞号——上次撞号根因就是没扫表；建议 SE 系下一个空位），写明三条节流规则与验收口径；系统逻辑补一小节；「1.9 提交前手动验收项（UserDefaults 门控检查）」登记进 TestFlight 验收清单（docs/工作记录/2026-07-10-testflight-acceptance-checklist.md）。
3. **系统逻辑 §8.4 纠偏**：验证段「包测试覆盖跨年与时区」改为如实表述（跨年由 app-hosted 日期策略测试覆盖；包层纯日期数学无时区依赖）。
4. **V1 遗留死文案删除**：`weeklyCoachReviewVerdictBody(code:count:)`、`weeklyCoachReviewWeek(dateText:)`、`weeklyCoachReviewEvidenceTitle` 三个无生产调用点的函数及对应测试断言删除（YAGNI）；删前 grep 复核确无调用。
5. **.ai-tmp/20260718-weekly-review-premium-audit/ 归属登记**：在对应 DEV_LOG 条目补一句归属说明（属周复盘 V1→V2 之间的审计轮），按 EVIDENCE 分类。
6. **开闸 checklist 立档**：新建 `docs/工作记录/2026-07-20-purchase-gate-checklist.md`，逐项：①StoreKit 生命周期测试（`testLocalCatalogPurchasePendingRestoreRenewalExpirationAndRefund`）在可复现环境跑绿 ②app target Info.plist 补四 key（RedeSubscriptionProductIDs/PrivacyPolicyURL/TermsOfUseURL/PaidCapabilityReady）③CI `testProductionConfigurationFailsClosedWithoutApprovedProducts` 同 PR 改断言 ④grace×离线政策落地（**已裁定**：信任 currentEntitlements 成员资格为访问真相，status 仅用于展示 billingState——苹果推荐口径）⑤Sandbox/TestFlight 真实购买/恢复/退款验收 ⑥定价与 founder beta 锚点对齐。
7. **DEV_LOG**：本批一条（目标/做了什么/可见变化/证据/风险）。

## F. 门禁/CI 测试面收口（owner 已授权）

1. `.claude/quality-gate.cmd`：`-only-testing` 白名单加入 SessionStoreDraftTests 全部 5 条 + StoreKitEntitlementsTests 里 2 条周复盘政策测试（MemoPolicy/DatePolicy）。
2. `rede-ci.yml`：`-only-testing` 列表与本地 gate 对齐（同一份清单）。
3. 红着的 `testLocalCatalogPurchasePendingRestoreRenewalExpirationAndRefund` 继续显式排除，在 gate 脚本内注释注明 blocker 与开闸 checklist 路径。
4. 改完先跑一次 gate 实证新清单真的在跑（输出里数测试条数）。

## 验证与证据（企业验收标准）

1. **模拟器真实流程**（iPhone Pro 系 / 装前必真 build 不用 showBuildSettings / 截图前确认前台是 Rede）：
   - 今日页：触发更新态 fixture → 实拍页底单行（含「查看/稍后」可点）；无更新态实拍确认无残留
   - 设置页：实拍收敛后订阅区两行；Coach 页实拍「管理订阅」页脚（付费 fixture 态）与购买面控件仍全
   - 训练页：实拍「接下来 · 动作名 · 3 × 8」
   - 最大辅助字号抽查一页（沿 Codex 惯例）
2. **测试**：新增/改动测试先红后绿（D2 的 calibrating 测试必须先证明能抓住防线被删的场景）；受影响包定向测试。
3. **gate**：每 commit 仓库根 exit 0；最终一次完整门禁，输出尾部与 app-hosted 测试条数入回执。
4. 证据 PNG 存 `docs/工作记录/`，前缀 `2026-07-20-fixbatch-`。

## 红线（禁改）

- 订阅 fail-closed 判定逻辑与 entitlement 矩阵语义；购买闸保持关（Info.plist 四 key 不加）
- 周教练复盘引擎判定语义（只动 facts 归一与映射提炼，不动优先级/文案语义）
- Free Core 边界；通知职责；既有周口径（ISO 周一）
- 版本号（1.8/25 不动——修复批不 bump）

## 实施回执模板（收尾必填）

```
## 实施回执
- 分支与 commit 清单：[hash + 一句话]
- A 今日页：[改法摘要 + 实拍文件名]
- B 设置页/Coach 页：[改法摘要 + 矩阵测试处置 + 实拍]
- C 训练页：[实拍]
- D 复盘加固：[测试先红后绿证明 ×2]
- E 文档：[逐项完成情况 + 新 FR 编号（附撞号扫描结果）]
- F 门禁收口：[新清单测试条数前后对比]
- gate：[最终 exit code + 尾部原文]
- 未尽事项：[如实列]
- SCRATCH：[路径]
```
