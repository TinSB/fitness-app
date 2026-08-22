import XCTest
import RedeDomain
import RedeEntitlements
import RedeL10n
import RedeTrainingDecision
@testable import Rede

// Rede Coach 付费边界（FR-SUB1 修订，2026-08-18）。
//
// 这一层要钉死的三件事，按重要性排：
// 1. **购买闸没开时一切照旧免费**——已交付能力绝不能在没有购买入口时被收走（上架红线）。
// 2. 免费态**不泄露付费结论**：提案只留「有一条」的位，内容与预览一并消失。
// 3. **安全与控制权永不进门**：修数据卡、已采纳调整的撤销入口、实测里程碑照常。
@MainActor
final class PaidCoachBoundaryTests: XCTestCase {

    private let paid = EntitlementState.paidCoach(expirationDate: nil, billingState: .active)
    private let free = EntitlementState.freeCore
    private let gateClosed = SubscriptionLaunchDecision.blocked(.paidCapabilityNotReady)
    private let gateReady = SubscriptionLaunchDecision.ready

    private func access(_ entitlement: EntitlementState, _ decision: SubscriptionLaunchDecision) -> PaidCoachAccess {
        // arguments 显式传空：不让本机跑测试时的 DEBUG 钩子（-redeCoachBoundaryFixture）污染判定。
        PaidCoachAccess.resolve(entitlement: entitlement, launchDecision: decision, arguments: [])
    }

    // MARK: - 1. 闸没开 = 一切照旧（生产今日形态）

    func testEveryCapabilityStaysFreeWhilePurchaseGateIsClosed() {
        for entitlement in [free, paid, .checking, .unknown(.storeUnavailable)] {
            let a = access(entitlement, gateClosed)
            XCTAssertFalse(a.isGateActive)
            XCTAssertFalse(a.showsUpgradeHints, "闸没开还打广告 = 给买不到的东西做推销")
            for capability in PaidCoachCapability.allCases {
                XCTAssertTrue(a.allows(capability), "\(capability) 在闸没开时被收走了")
            }
        }
    }

    // MARK: - 2. 闸开了：付费全开、免费全关且显示预告

    func testGateActiveSplitsPaidAndFree() {
        let paidAccess = access(paid, gateReady)
        XCTAssertFalse(paidAccess.showsUpgradeHints, "付费用户不该看到升级预告")
        for capability in PaidCoachCapability.allCases {
            XCTAssertTrue(paidAccess.allows(capability))
        }

        let freeAccess = access(free, gateReady)
        XCTAssertTrue(freeAccess.showsUpgradeHints)
        for capability in PaidCoachCapability.allCases {
            XCTAssertFalse(freeAccess.allows(capability), "\(capability) 在免费态没关上")
        }
    }

    func testExpiredEntitlementFallsBackToFreeCore() {
        let expired = EntitlementState.paidCoach(expirationDate: Date().addingTimeInterval(-60), billingState: .active)
        let a = PaidCoachAccess.resolve(entitlement: expired, launchDecision: gateReady, arguments: [])
        XCTAssertFalse(a.allows(.planAdjustment))
        XCTAssertTrue(a.showsUpgradeHints)
    }

    func testGracePeriodKeepsPaidAccess() {
        // 宽限期仍是已验证付费（Apple 口径，开闸 checklist ④ 已裁定）：不能在续费失败当天断掉能力。
        let grace = EntitlementState.paidCoach(expirationDate: nil, billingState: .gracePeriod)
        XCTAssertTrue(access(grace, gateReady).allows(.weeklyReview))
    }

    func testCheckingAndUnknownDoNotUnlockPaidCapabilities() {
        // 核对不出权益时按 Free Core 呈现（既有纪律），但不能反过来把免费能力也关掉——
        // 上面第一条测试已锁「闸没开一切免费」，这里锁「闸开着、权益未知」不解锁付费。
        for entitlement in [EntitlementState.checking, .unknown(.storeUnavailable)] {
            XCTAssertFalse(access(entitlement, gateReady).allows(.autoBalance))
        }
    }

    // MARK: - 3. 计划调整：内容藏起来，撤销入口留着

    private func appDataWithAdoptedAdjustment() throws -> AppData {
        // 只需要一份能跑通 clean pipeline 的最小 canonical：有 program + 一条已采纳调整记录。
        try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "userProfile": .object([
                "goal": .string("hypertrophy"),
                "daysPerWeek": .int(5),
                "equipmentScenario": .string("commercialGym"),
                "experienceLevel": .string("intermediate"),
            ]),
            "program": .object([
                "templateId": .string("upper-lower"),
                "splitType": .string("upperLower"),
                "daysPerWeek": .int(5),
            ]),
            "planAdjustmentHistory": .array([
                .object([
                    "kind": .string("reduceFrequency"),
                    "fromDaysPerWeek": .int(5),
                    "toDaysPerWeek": .int(3),
                    "appliedAtISO": .string("2026-08-01T10:00:00Z"),
                ]),
            ]),
        ]))
    }

    func testAdoptedAdjustmentKeepsItsUndoEntryForFreeUsers() throws {
        let appData = try appDataWithAdoptedAdjustment()
        let state = SessionStore.planAdjustmentState(
            from: appData, now: Date(), timeZone: .current,
            paidCoach: PaidCoachAccess(hasPaidCoach: false, isGateActive: true)
        )
        // 已经生效在用户计划上的改动必须始终可撤（§1.4 用户保留控制权）——它不是付费能力。
        XCTAssertNotNil(state.activeTo, "免费态丢了撤销入口")
        XCTAssertNil(state.proposal, "免费态不该拿到提案内容")
        XCTAssertTrue(state.proposedWeekDays.isEmpty, "免费态不该拿到影响哪几天的预览")
    }

    func testHiddenProposalFlagOnlyMeansThereIsOne() throws {
        // 契约层面确认预告位不带任何内容：视图只能读到一个 Bool。
        let state = SessionStore.PlanAdjustmentState(
            proposal: nil, activeKind: nil, activeTo: nil, proposedWeekDays: [], hasHiddenProposal: true
        )
        XCTAssertTrue(state.hasHiddenProposal)
        XCTAssertNil(state.proposal)
        XCTAssertTrue(state.proposedWeekDays.isEmpty)
    }

    // MARK: - 4. 能力清单与文案一一对应（加了能力漏了文案 → 红）

    func testEveryCapabilityHasCopyInBothLanguages() {
        for locale in [RedeLocale.zh, .en] {
            let strings = RedeStrings(locale: locale)
            for capability in PaidCoachCapability.allCases {
                XCTAssertFalse(strings.paidCoachCapabilityTitle(capability.rawValue).isEmpty,
                               "\(capability) 缺 \(locale) 标题")
                XCTAssertFalse(strings.paidCoachCapabilityNote(capability.rawValue).isEmpty,
                               "\(capability) 缺 \(locale) 说明")
            }
        }
    }
}

// MARK: - 开闸 checklist ⑦：恢复购买与政策链接的可达性
//
// 起因（2026-07-20 验收批）：设置页订阅区收敛后，「恢复购买」与两条政策链接只活在 Apple 购买面里，
// 而购买面只在「已确认 Free Core × 商店就绪」出现。核对不出权益的人恰恰最需要 AppStore.sync()，
// 却只剩语义不等价的本地「重新核对」；付费用户则整个够不到政策链接。
@MainActor
final class RedeCoachRecoveryPolicyTests: XCTestCase {

    private let gateReady = SubscriptionLaunchDecision.ready
    private let gateClosed = SubscriptionLaunchDecision.blocked(.paidCapabilityNotReady)

    func testStoreNotReadyShowsNothing() {
        // 商店没就绪时既没有配置好的政策 URL 也没有购买路径，凭空多两个链接只会指向空处。
        for entitlement in [EntitlementState.freeCore, .checking,
                            .unknown(.storeUnavailable),
                            .paidCoach(expirationDate: nil, billingState: .active)] {
            XCTAssertEqual(
                RedeCoachRecoveryPolicy.controls(entitlement: entitlement, launchDecision: gateClosed),
                .none
            )
        }
    }

    func testUnknownEntitlementGetsRestoreAndPolicies() {
        // 最尖锐的一格：权益核对不出 × 商店就绪。
        let controls = RedeCoachRecoveryPolicy.controls(
            entitlement: .unknown(.storeUnavailable), launchDecision: gateReady
        )
        XCTAssertTrue(controls.showsRestore, "核对不出权益的人必须够得到向 Apple 重新同步")
        XCTAssertTrue(controls.showsPolicyLinks, "他看不到购买面，政策链接要在这里补")
    }

    func testPaidStateGetsPoliciesButNotRestore() {
        let controls = RedeCoachRecoveryPolicy.controls(
            entitlement: .paidCoach(expirationDate: nil, billingState: .active), launchDecision: gateReady
        )
        XCTAssertFalse(controls.showsRestore, "已经有权益的人不需要恢复入口")
        XCTAssertTrue(controls.showsPolicyLinks, "付费态此前完全够不到条款链接")
    }

    func testConfirmedFreeCoreLeavesItToApplesPurchaseSheet() {
        // 已确认免费 → 会看到购买面，Apple 自带恢复与政策控件，这里不重复给。
        XCTAssertEqual(
            RedeCoachRecoveryPolicy.controls(entitlement: .freeCore, launchDecision: gateReady),
            .none
        )
    }

    func testCheckingIsTransientAndAddsNoControls() {
        XCTAssertEqual(
            RedeCoachRecoveryPolicy.controls(entitlement: .checking, launchDecision: gateReady),
            .none
        )
    }

    func testExpiredPaidEntitlementIsTreatedAsFreeCoreNotPaid() {
        // 过期 = 回落 Free Core：走购买面那条路，不给「已付费」的政策页脚。
        let expired = EntitlementState.paidCoach(
            expirationDate: Date().addingTimeInterval(-60), billingState: .active
        )
        XCTAssertEqual(
            RedeCoachRecoveryPolicy.controls(entitlement: expired, launchDecision: gateReady),
            .none
        )
    }
}
