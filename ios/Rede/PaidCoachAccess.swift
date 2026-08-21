import Foundation
import RedeEntitlements

// Rede Coach 付费边界（FR-SUB1 修订，owner 拍板 2026-08-18）。
//
// 卖点：**跨会话的判断进付费**——计划调整、弱肌群补量、周期化、优化建议、深度分析、每周复盘。
// 免费仍强于市面记录器：今日裁决 + 今日处方 + 逐组自适应建议 + 无限记录 + 手表 + 同步 + 导出 + 分享。
//
// 三条纪律（本文件是唯一执行点，别在各视图里各判一次）：
// 1. **权益判定只在 app/UI 层**。引擎与 canonical 一律不读 entitlement——付费项的做法是
//    app 层把输入置空（`priorityMuscles: []`、`mesocycleEnabled: false`），引擎代码零改动。
// 2. **免费态不泄露付费结论**（沿用 FR-SUB3）：只说「有一条建议」，不说改什么。
// 3. **安全永不进门**：疼痛登记与接线、回归协议、数据核对卡、记录、导出、隐私控制。
//
// ⚠️ 最要紧的一条：**购买闸没开时，一切照旧免费**（`isGateActive == false`）。
// 已经交付给用户的能力，绝不能在「没有购买入口」的情况下被收走——那既是对用户耍流氓，
// 也过不了 App Review。因此本边界在生产环境今天是**完全无效**的：Info.plist 四 key 缺席
// → launch gate blocked → 全部按付费态放行。边界在开闸那一刻自动生效，不需要再改代码。
enum PaidCoachCapability: String, CaseIterable {
    /// FR-PL3/4 计划调整提案（预览 → 采纳 → 回滚）。
    case planAdjustment
    /// FR-PL5 自动均衡：弱肌群每场自动补一组。
    case autoBalance
    /// FR-PL2 计划周期化：过载周 / 减载周及其依据行。
    case periodization
    /// FR-T5 教练卡的优化类（换更难变体 / 补量）。**修数据卡不在内**，那是数据可信、永久免费。
    case coachOptimization
    /// 子肌群钻取 + 相对力量档位。肌群等级总览仍免费。
    case muscleDrilldown
    /// 估算型力量里程碑。**实测里程碑仍免费**（FR-PR7 诚信红线不受影响）。
    case estimatedMilestone
    /// FR-SUB3 每周教练复盘（首个已交付的付费能力）。
    case weeklyReview
}

/// 一次解析、全局共享的付费边界快照。视图与派生层只问它两个问题：
/// 「这个能力开不开」「要不要显示免费态预告」。
struct PaidCoachAccess: Equatable {
    /// 已验证的付费权益（含宽限期）。
    let hasPaidCoach: Bool
    /// 边界是否生效。false = 购买闸未开 → 全部能力照旧可用、且不显示任何预告。
    let isGateActive: Bool

    /// 生产今日的形态：闸没开，一切免费，零预告。
    static let inactive = PaidCoachAccess(hasPaidCoach: false, isGateActive: false)

    /// 单一解析入口。**必须同时看权益与购买闸**——只看权益会在闸没开时把能力收走。
    static func resolve(
        entitlement: EntitlementState,
        launchDecision: SubscriptionLaunchDecision,
        now: Date = Date(),
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> PaidCoachAccess {
        #if DEBUG
        // 验收钩子（L3 截图用）：强制边界生效，权益仍按真实 entitlement 走。
        // 生产不可达；没有它就没法在 simctl 里看免费态（.storekit 配置挂不上，闸永远 blocked）。
        if arguments.contains("-redeCoachBoundaryFixture") {
            return PaidCoachAccess(
                hasPaidCoach: FeatureAccessPolicy.allows(.paidCoach, entitlement: entitlement, now: now),
                isGateActive: true
            )
        }
        #endif
        guard SubscriptionPagePolicy.presentation(for: launchDecision).showsTransactionControls else {
            return .inactive
        }
        return PaidCoachAccess(
            hasPaidCoach: FeatureAccessPolicy.allows(.paidCoach, entitlement: entitlement, now: now),
            isGateActive: true
        )
    }

    /// 这个付费能力现在能不能用。闸没开 → 一律能用。
    func allows(_ capability: PaidCoachCapability) -> Bool {
        guard isGateActive else { return true }
        return hasPaidCoach
    }

    /// 要不要在免费态显示「这是 Rede Coach 的能力」的预告。
    /// 只有「闸开了且没买」才显示——闸没开时显示预告等于给一个买不到的东西打广告。
    var showsUpgradeHints: Bool { isGateActive && !hasPaidCoach }
}
