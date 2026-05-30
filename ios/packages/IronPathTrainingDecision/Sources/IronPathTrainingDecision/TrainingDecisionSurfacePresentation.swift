// TrainingDecisionSurfacePresentation — iOS-17C Plan + Today Read-only Surface V1.
//
// Pure, deterministic presentation organizers for two tab surfaces. They READ
// already-computed value types and FORMAT them into labeled, Chinese-localized
// rows; they never run, recompute, or change the engine — and never touch any
// parity golden. Adding these additive presentation types is a §19.2 extension
// of an active package (no engine-output / golden change, master §11/§18).
//
//   - TodayReadinessSummary: organizes a `TrainingDecisionCoreSlice` (the engine's
//     own output, computed upstream) + a `TodayStatus` into a readiness summary
//     for the 今日 surface.
//   - PlanSurfaceSummary: organizes a `MesocyclePlan` + `ProgramTemplate` (Domain
//     value types) into cycle / template rows for the 计划 surface.
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

// MARK: - 计划 (Plan) surface summary

/// Read-only organization of a `MesocyclePlan` + `ProgramTemplate` into the 计划
/// surface's cycle / template rows. Pure projection over Domain value types — no
/// engine call, no week-resolution math (just a count of the planned weeks).
public struct PlanSurfaceSummary: Equatable, Sendable {
    /// Raw mesocycle phase string, trimmed; `nil` when absent.
    public let phaseText: String?
    /// Number of planned weeks parsed from the `weeks` open bag (`0` when absent).
    public let weekCount: Int
    /// `start – end` (or a half-open variant) when any boundary is present.
    public let dateRangeText: String?
    /// Mesocycle rows (阶段 / 周数 / 日期范围).
    public let cycleRows: [SurfaceRow]
    /// Program-template rows (目标 / 分化 / 每周天数).
    public let programRows: [SurfaceRow]
    /// Whether the program carries a non-empty correction / functional strategy
    /// bag (surfaced as a collapsed presence hint, not expanded detail).
    public let hasCorrectionStrategy: Bool
    public let hasFunctionalStrategy: Bool
    /// `true` when neither the mesocycle nor the program carry any displayable
    /// field — lets the surface show an honest empty state once a real read path
    /// (no canonical AppData read exists in the app yet) lands.
    public let isEmpty: Bool

    public init(mesocycle: MesocyclePlan, program: ProgramTemplate) {
        let weeks = Self.weekCount(mesocycle.weeks)
        let phase = Self.cleaned(mesocycle.phase)
        let range = Self.dateRange(start: mesocycle.startDate, end: mesocycle.endDate)
        self.weekCount = weeks
        self.phaseText = phase
        self.dateRangeText = range

        var cycle: [SurfaceRow] = []
        if let phase { cycle.append(SurfaceRow(id: "phase", label: "阶段", value: phase)) }
        if weeks > 0 { cycle.append(SurfaceRow(id: "weeks", label: "周数", value: "\(weeks) 周")) }
        if let range { cycle.append(SurfaceRow(id: "dateRange", label: "日期范围", value: range)) }
        self.cycleRows = cycle

        var prog: [SurfaceRow] = []
        if let goal = Self.cleaned(program.primaryGoal) {
            prog.append(SurfaceRow(id: "goal", label: "目标", value: goal))
        }
        if let split = Self.cleaned(program.splitType) {
            prog.append(SurfaceRow(id: "split", label: "分化", value: split))
        }
        if let days = program.daysPerWeek?.intValue {
            prog.append(SurfaceRow(id: "days", label: "每周天数", value: "\(days) 天"))
        }
        self.programRows = prog

        let hasCorrection = Self.hasContent(program.correctionStrategy)
        let hasFunctional = Self.hasContent(program.functionalStrategy)
        self.hasCorrectionStrategy = hasCorrection
        self.hasFunctionalStrategy = hasFunctional
        self.isEmpty = cycle.isEmpty && prog.isEmpty && !hasCorrection && !hasFunctional
    }

    static func cleaned(_ raw: String?) -> String? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        return raw
    }

    static func weekCount(_ weeks: JSONValue?) -> Int {
        weeks?.arrayValue?.count ?? 0
    }

    static func dateRange(start: String?, end: String?) -> String? {
        let from = cleaned(start)
        let to = cleaned(end)
        switch (from, to) {
        case let (.some(from), .some(to)): return "\(from) – \(to)"
        case let (.some(from), .none): return "\(from) 起"
        case let (.none, .some(to)): return "至 \(to)"
        case (.none, .none): return nil
        }
    }

    /// A non-null open bag with at least one element / character counts as
    /// present; `null`, absent, or empty does not.
    static func hasContent(_ value: JSONValue?) -> Bool {
        guard let value, !value.isNull else { return false }
        switch value {
        case .object(let object): return !object.isEmpty
        case .array(let array): return !array.isEmpty
        case .string(let string): return !string.isEmpty
        case .null: return false
        case .bool, .number: return true
        }
    }
}
