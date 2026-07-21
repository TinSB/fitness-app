# Rede 订阅购买闸开闸 checklist（2026-07-20 立档）

> 现状：购买闸**关**——app target Info.plist 刻意不含订阅四 key，生产 launch gate 恒为
> `blocked(.paidCapabilityNotReady)`，CI/本地门禁以 `testProductionConfigurationFailsClosedWithoutApprovedProducts`
> 双保险锁死。本清单是把闸打开前**必须逐项拿到收据**的完整动作序列；任何一项缺收据不开闸。
> 来源：2026-07-20 审查修复批交接件裁定（owner 授权代决）；开闸动作本身仍属支付类高风险，
> 需 owner 明确批准后执行，不适用任何自动合并授权。

## 开闸六项（顺序执行，逐项留收据）

- [ ] **① StoreKit 生命周期测试跑绿**：`RedeTests/StoreKitEntitlementsTests/testLocalCatalogPurchasePendingRestoreRenewalExpirationAndRefund`
  在可复现环境（修复 Xcode 26.6 + iOS 26.5 Simulator 保存 `.storekit` 配置报
  `SKInternalErrorDomain Code=3` 的 blocker，或换用已验证可用的 Xcode/OS 组合）完整跑绿：
  购买取消/验证失败/成功、过期、Ask to Buy pending、恢复、宽限期、续期、退款十段生命周期
  一条不跳。该测试当前在 `.claude/quality-gate.cmd` 与 `rede-ci.yml` 显式排除并注释了
  blocker；本项完成后同 PR 解除排除。
- [ ] **② Info.plist 补四 key**：app target 加入 `RedeSubscriptionProductIDs`（与 App Store
  Connect 已批准商品 ID 完全一致）、`RedeSubscriptionPrivacyPolicyURL`、
  `RedeSubscriptionTermsOfUseURL`、`RedeSubscriptionPaidCapabilityReady`
  （`RedeSubscriptionRuntime.configuration` 实际读取的 key 名，已对照代码核实；
  当前四 key 全部刻意缺席=闸关）。政策 URL 必须真实可达并与 ASC 元数据一致。
- [ ] **③ CI fail-closed 断言同 PR 翻转**：`testProductionConfigurationFailsClosedWithoutApprovedProducts`
  当前断言「配置为空 + launch gate blocked」；开闸 PR 里同步改写断言为「配置完整 + gate ready +
  非法配置仍 fail-closed」，绝不允许出现「断言旧闸、行为新闸」的窗口。本地
  `.claude/quality-gate.cmd` 与 `rede-ci.yml` 同一份清单同步。
- [ ] **④ grace × 离线政策落地（已裁定，照此实现不再议）**：**信任
  `Transaction.currentEntitlements` 成员资格为付费访问唯一真相**——交易仍在
  currentEntitlements（含宽限期）即保持 Paid Coach；`subscriptionStatus` 的
  renewalInfo/billingState **仅用于展示层**（设置页/Coach 页宽限期注解），不参与访问判定；
  离线时沿用 StoreKit 2 本地缓存的 currentEntitlements 结论，不自设二级宽限计时器。
  这是 Apple 推荐口径，也与现有 `FeatureAccessPolicy` 的验证-过期语义一致。
- [ ] **⑤ Sandbox / TestFlight 真实交易验收**：Sandbox 账号真实购买（月/年）、恢复购买、
  退款（ASC 退款或 Sandbox 管理面）三条链路各留一份收据（截图 + entitlement 状态断言）；
  TestFlight build 复验购买面渲染、价格本地化与「管理订阅」进入 Apple 管理面。模拟器
  fixture 与 `.storekit` 本地目录不算数（L3 只证 UI，不证交易真相）。
- [ ] **⑥ 定价与 founder beta 锚点对齐**：ASC 正式定价须与官网 founder beta 承诺
  （annual_5999_high 锚点系）对账——founder 报名者拿到的价格/权益不劣于公开价，
  公开价不打脸已发出的 beta 沟通；定价决定本身由 owner 拍板并留书面记录。
- [ ] **⑦ 恢复购买与条款链接的可达性收口（2026-07-20 验收批发现）**：设置页订阅区收敛后，
  「恢复购买」唯一入口是 Coach 页购买面——按既有 entitlement 矩阵，**unknown/checking/付费态
  永远看不到购买面**，其中 unknown×store-ready 格最尖锐（权益无法核对的用户恰是
  `AppStore.sync()` 强制重同步的目标人群，现仅剩语义不等价的本地「重新读取」）；付费态同时
  失去订阅条款链接。开闸前必须落地：Coach 页 entitlement `.unavailable` 态在 store ready 时
  补「恢复购买」入口，付费态页脚补条款链接（或另行裁定的等价方案）；今日购买闸恒 blocked
  故不可达，不构成现网缺口。

## 完成定义

六项全绿且 owner 书面批准后，开闸 PR 才可合并；该 PR 属支付类，**禁止自动合并**。
开闸后第一时间在真机走一次真实购买 + 恢复 + Coach 页解锁全链路并归档收据。
