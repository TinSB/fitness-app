// TrainingDecisionSurfacePresentation — iOS-17C Plan + Today Read-only Surface V1.
//
// Pure, deterministic presentation organizer for the 今日 tab surface. It READS
// already-computed value types and FORMATS them into labeled, Chinese-localized
// rows; it never runs, recomputes, or changes the engine — and never touches any
// parity golden. Adding this additive presentation type is a §19.2 extension
// of an active package (no engine-output / golden change, master §11/§18).
//
//   - TodayReadinessSummary: organizes a `TrainingDecisionCoreSlice` (the engine's
//     own output, computed upstream) + a `TodayStatus` into a readiness summary
//     for the 今日 surface.
//
// (The 计划 surface's `PlanSurfaceSummary` was superseded by the real-AppData
// read path `IronPathDomain.PlanDisplay` + `IronPathDataHealth.resolvePlanDisplayState`
// (#440) and removed as dead code.)
//
// No IO, no clock, no randomness, no AppData access. Inputs are value types the
// caller already holds; output is plain strings + Bools the thin SwiftUI layer
// renders verbatim (master §5/§15: app layer formats nothing it can avoid).

import Foundation
import IronPathDomain

/// One labeled key/value row in a surface. Stable `id` so the SwiftUI layer can
/// `ForEach` without inventing identity.
public struct SurfaceRow: Identifiable, Equatable, Sendable {
    public let id: String
    public let label: String
    public let value: String

    public init(id: String, label: String, value: String) {
        self.id = id
        self.label = label
        self.value = value
    }
}

// MARK: - 今日 (Today) readiness summary

/// Read-only organization of the engine's `TrainingDecisionCoreSlice` + the
/// subjective `TodayStatus` into the 今日 surface's readiness summary. Pure
/// projection — it reads the slice the engine already produced and never calls
/// back into the engine.
public struct TodayReadinessSummary: Equatable, Sendable {
    /// Short headline, e.g. `准备度 · 中等`.
    public let headline: String
    /// One-line training-adjustment guidance, e.g. `建议：正常推进`.
    public let advice: String
    /// Engine decision rows (准备度 / 训练调整 / 今日意图 / 训练阶段 / 风险 / 负荷系数).
    public let decisionRows: [SurfaceRow]
    /// Subjective today-status rows (睡眠 / 精力 / 可用时间 / 酸痛). Missing fields
    /// render an honest `未填写` placeholder rather than a fabricated value.
    public let statusRows: [SurfaceRow]

    public init(slice: TrainingDecisionCoreSlice, todayStatus: TodayStatus) {
        let readiness = Self.readinessLabel(slice.readinessLevel)
        let adjustment = Self.adjustmentLabel(slice.trainingAdjustment)
        self.headline = "准备度 · \(readiness)"
        self.advice = "建议：\(adjustment)"
        self.decisionRows = [
            SurfaceRow(id: "readinessLevel", label: "准备度", value: readiness),
            SurfaceRow(id: "trainingAdjustment", label: "训练调整", value: adjustment),
            SurfaceRow(id: "sessionIntent", label: "今日意图", value: Self.intentLabel(slice.sessionIntent)),
            SurfaceRow(id: "activePhase", label: "训练阶段", value: Self.phaseLabel(slice.activePhase)),
            SurfaceRow(id: "riskLevel", label: "风险", value: Self.riskLabel(slice.riskLevel)),
            SurfaceRow(id: "finalVolumeMultiplier", label: "负荷系数", value: Self.multiplierText(slice.finalVolumeMultiplier)),
        ]
        self.statusRows = Self.statusRows(from: todayStatus)
    }

    // Label maps are `internal` (not `private`) so the test target can assert
    // each enum case yields a non-empty, distinct Chinese label.
    static func readinessLabel(_ level: ReadinessLevel) -> String {
        switch level {
        case .low: return "偏低"
        case .medium: return "中等"
        case .high: return "良好"
        }
    }

    static func adjustmentLabel(_ adjustment: ReadinessTrainingAdjustment) -> String {
        switch adjustment {
        case .push: return "可加量"
        case .normal: return "正常推进"
        case .conservative: return "保守"
        case .recovery: return "以恢复为主"
        }
    }

    static func intentLabel(_ intent: SessionIntent) -> String {
        switch intent {
        case .normalSession: return "常规训练"
        case .reentryProductive: return "回归 · 保底"
        case .controlledReload: return "可控回调"
        case .deloadWeek: return "减载周"
        case .severeRest: return "严重恢复"
        }
    }

    static func phaseLabel(_ phase: ActivePhase) -> String {
        switch phase {
        case .base: return "基础"
        case .build: return "积累"
        case .overload: return "超量"
        case .deload: return "减载"
        case .reentry: return "回归"
        case .restart: return "重启"
        }
    }

    static func riskLabel(_ risk: RiskLevel) -> String {
        switch risk {
        case .none: return "无"
        case .low: return "低"
        case .moderate: return "中"
        case .high: return "高"
        case .severe: return "严重"
        }
    }

    static func multiplierText(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    static func statusRows(from status: TodayStatus) -> [SurfaceRow] {
        [
            SurfaceRow(id: "sleep", label: "睡眠", value: text(status.sleep)),
            SurfaceRow(id: "energy", label: "精力", value: text(status.energy)),
            SurfaceRow(id: "time", label: "可用时间", value: timeText(status.time)),
            SurfaceRow(id: "soreness", label: "酸痛", value: sorenessText(status.soreness)),
        ]
    }

    /// A trimmed non-empty string, or the honest `未填写` placeholder.
    static func text(_ raw: String?) -> String {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return "未填写"
        }
        return raw
    }

    static func timeText(_ raw: String?) -> String {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return "未填写"
        }
        return "\(raw) 分钟"
    }

    static func sorenessText(_ raw: [String]?) -> String {
        let cleaned = (raw ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return cleaned.isEmpty ? "未填写" : cleaned.joined(separator: "、")
    }
}
