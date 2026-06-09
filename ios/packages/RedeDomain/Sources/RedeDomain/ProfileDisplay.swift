// ProfileDisplay — iOS-17B Profile Surface V1.
//
// Pure, deterministic display/formatting helpers backing the 我的
// (Profile) tab. The app layer (ProfileRootView) is a thin renderer
// (master §5/§15): every label it shows is formatted here so the logic
// stays unit-testable and no business logic leaks into the view.
//
// === scope (iOS-17B) ===
// • Format the read-only UserProfile / UnitSettings / ScreeningProfile /
//   AppSettings fields for display (nil → a single "未设置" placeholder).
// • Map the two stable enum fields (sex, trainingLevel) to Chinese;
//   unknown tokens fall back to the raw value verbatim (never dropped).
// • Vend a deterministic preview sample so the read-only surface has
//   content to render and the unit toggle is demonstrable. The sample is
//   PREVIEW data, not canonical AppData — this slice reads/writes nothing.
//
// Weight is kg-stored (UnitSettings stores kg; the view formats for
// display). The kg↔lb conversion is REUSED from `WeightConversion`
// (iOS-17b NativeSetCaptureSupport) so the lb-per-kg factor has a single
// home — do not re-derive it. The compact number format is display-local.
// ⚠️ DO NOT add IO/persistence here (Domain is the Foundation-only leaf).
// === end scope ===

import Foundation

/// Stateless formatting namespace for the read-only profile surface.
/// All members are pure functions of their inputs.
public enum ProfileDisplay {

    /// Shown for any documented field that is absent (nil).
    public static let placeholder = "未设置"

    /// Shown for an empty list (the field exists but has no entries).
    public static let emptyList = "无"

    // MARK: - Numeric fields (kg-stored weight, height, counts)

    /// Format a kg-stored weight in the chosen display unit, e.g.
    /// `72.6 kg` / `160.1 lb`. Storage stays kg; this is display only.
    /// Routes through `WeightConversion.fromKilograms` so the kg↔lb factor
    /// has a single home (no unit drift vs. the Focus capture path).
    public static func weight(_ kilograms: NumberRepr?, unit: WeightUnit) -> String {
        guard let kilograms,
              let shown = WeightConversion.fromKilograms(kilograms.doubleValue, to: unit)
        else { return placeholder }
        return number(shown, fractionDigits: 1) + " " + unit.rawValue
    }

    /// Format a height in centimetres, e.g. `178 cm`.
    public static func height(_ centimetres: NumberRepr?) -> String {
        guard let centimetres else { return placeholder }
        return number(centimetres.doubleValue, fractionDigits: 1) + " cm"
    }

    /// Format an integer-valued field with a trailing unit, e.g.
    /// `30 岁`, `4 天/周`, `60 分钟`.
    public static func integer(_ value: NumberRepr?, suffix: String) -> String {
        guard let value else { return placeholder }
        return number(value.doubleValue, fractionDigits: 0) + suffix
    }

    /// Compact, locale-independent fixed-point string: rounds to
    /// `fractionDigits`, then trims trailing zeros and any dangling dot
    /// (`72.60` → `72.6`, `100.0` → `100`). `%f` uses the C locale, so the
    /// decimal separator is always `.` regardless of device region.
    static func number(_ value: Double, fractionDigits: Int) -> String {
        var s = String(format: "%.\(fractionDigits)f", value)
        if s.contains(".") {
            while s.hasSuffix("0") { s.removeLast() }
            if s.hasSuffix(".") { s.removeLast() }
        }
        return s
    }

    // MARK: - String fields

    /// Trimmed free-text value; blank or nil → placeholder.
    public static func text(_ value: String?) -> String {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return placeholder }
        return trimmed
    }

    /// Map the stable `sex` domain (male/female/other) to Chinese.
    /// Unknown future tokens fall back to the raw value (never dropped).
    public static func sex(_ value: String?) -> String {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return placeholder }
        switch trimmed {
        case "male": return "男"
        case "female": return "女"
        case "other": return "其他"
        default: return trimmed
        }
    }

    /// Map the stable `trainingLevel` domain (beginner/intermediate/
    /// advanced) to Chinese. Unknown tokens fall back to the raw value.
    public static func trainingLevel(_ value: String?) -> String {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return placeholder }
        switch trimmed {
        case "beginner": return "初级"
        case "intermediate": return "中级"
        case "advanced": return "高级"
        default: return trimmed
        }
    }

    // MARK: - List & boolean fields

    /// Join a string list with the Chinese enumeration comma `、`.
    /// Each entry is trimmed; blank entries are dropped. A nil or
    /// all-blank list renders as `无` (present-but-empty, distinct from
    /// the `未设置` used for an absent scalar field).
    public static func list(_ values: [String]?) -> String {
        guard let values else { return emptyList }
        let cleaned = values
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return cleaned.isEmpty ? emptyList : cleaned.joined(separator: "、")
    }

    /// Render an optional bool as 是 / 否, nil → placeholder.
    public static func bool(_ value: Bool?) -> String {
        guard let value else { return placeholder }
        return value ? "是" : "否"
    }

    // MARK: - Unit labels

    /// Human label for a display unit, e.g. `千克 (kg)` / `磅 (lb)`.
    public static func unitName(_ unit: WeightUnit) -> String {
        switch unit {
        case .kg: return "千克 (kg)"
        case .lb: return "磅 (lb)"
        }
    }
}

/// Deterministic preview data for the read-only profile surface.
///
/// This is **preview/sample** data — NOT canonical AppData. The iOS-17B
/// slice renders these constants so the 我的 page has content and the
/// unit toggle is demonstrable; reading the real on-device AppData is a
/// later, gated slice (master §8/§9/§14). Nothing here is persisted.
public enum ProfileDisplayPreviewSample {

    public static let userProfile = UserProfile(
        id: "preview-user",
        name: "示例用户",
        sex: "male",
        age: .integer(30),
        heightCm: .integer(178),
        weightKg: .double(72.6),
        trainingLevel: "intermediate",
        primaryGoal: "增肌",
        weeklyTrainingDays: .integer(4),
        sessionDurationMin: .integer(60),
        injuryFlags: ["右肩既往拉伤"],
        painNotes: ["深蹲过深时膝前侧不适"]
    )

    public static let unitSettings = UnitSettings(
        weightUnit: .kg,
        displayUnit: .kg
    )

    public static let screeningProfile = ScreeningProfile(
        userId: "preview-user",
        painTriggers: ["膝前侧（深蹲过深）"],
        restrictedExercises: ["杠铃过顶推举"],
        correctionPriority: ["髋关节灵活性", "肩胛稳定性"]
    )

    public static let appSettings = AppSettings(
        schemaVersion: .integer(2),
        selectedTemplateId: "upper-lower-4day",
        trainingMode: "hypertrophy",
        useHealthDataForReadiness: false
    )
}
