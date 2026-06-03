// PA-S0 — i18n/terms data port.
//
// Faithful Swift mirror of the eleven frozen label tables + `term()` from
// `src/i18n/terms.ts` (the one clean leaf of the PA track: zero imports, zero
// runtime logic — pure `as const` label data). Each table is transcribed
// entry-by-entry, key + Chinese value verbatim, with the mirrored TS source
// line cited; the `i18n/terms-snapshot-v1` parity golden (GENERATED from the
// same TS truth, never hand-authored — §22) mechanically reconciles every
// entry, so no label can be dropped or altered in transcription.
//
// PURE DATA — no logic beyond a dictionary subscript, no clock, zero `: Date`,
// no IO. `term(key)` is the direct `TERMS[key]` lookup (terms.ts:103).
//
// Muscle-label note (de-dup contract): `muscleLabels` below mirrors
// terms.ts:95-101 `MUSCLE_LABELS` (5: chest/back/legs/shoulders/arms →
// 胸/背/腿/肩/手臂). This is a DISTINCT TS constant from formatters.ts:102-122
// `MUSCLE_LABELS` (18 entries) — the latter is already ported into
// `IronPathTrainingDecision.VolumeAdaptationEngine.muscleLabels`. The two share
// these 5 Chinese values but have different key universes and live in different
// source files; they are NOT merged here. The S4 i18n/formatters port
// consolidates the shared muscle vocabulary; this slice ports terms.ts in full,
// faithfully and in isolation.

public enum Terms {
    /// `TERMS` (terms.ts:1-26).
    public static let terms: [String: String] = [
        "readinessScore": "准备度评分",      // terms.ts:2
        "base": "基础周",                    // terms.ts:3
        "build": "构建周",                   // terms.ts:4
        "overload": "过载周",                // terms.ts:5
        "deload": "减量周",                  // terms.ts:6
        "mainTraining": "主训练",            // terms.ts:7
        "correctionBlock": "纠偏模块",       // terms.ts:8
        "functionalBlock": "功能补丁",       // terms.ts:9
        "progressionSuggestion": "进阶建议", // terms.ts:10
        "regressionExercise": "回退动作",    // terms.ts:11
        "progressionExercise": "进阶动作",   // terms.ts:12
        "techniqueQuality": "动作质量",      // terms.ts:13
        "painPattern": "不适模式",           // terms.ts:14
        "adherence": "完成度",               // terms.ts:15
        "weeklyCoachReview": "每周训练总结", // terms.ts:16
        "mesocycle": "训练周期",             // terms.ts:17
        "supportLayer": "辅助层",            // terms.ts:18
        "weeklyBudget": "周剂量预算",        // terms.ts:19
        "topSet": "顶组",                    // terms.ts:20
        "backoffSet": "回退组",              // terms.ts:21
        "RIR": "RIR",                        // terms.ts:22
        "RPE": "RPE",                        // terms.ts:23
        "oneRm": "1RM",                      // terms.ts:24
        "ROM": "ROM",                        // terms.ts:25
    ]

    /// `PHASE_LABELS` (terms.ts:28-33).
    public static let phaseLabels: [String: String] = [
        "base": "基础周",     // terms.ts:29
        "build": "构建周",    // terms.ts:30
        "overload": "过载周", // terms.ts:31
        "deload": "减量周",   // terms.ts:32
    ]

    /// `EFFECTIVE_PHASE_DISPLAY_LABELS` (terms.ts:38-45) — compact labels that
    /// include the gap-reentry derived phases. UI-render only.
    public static let effectivePhaseDisplayLabels: [String: String] = [
        "base": "基础周",     // terms.ts:39
        "build": "构建周",    // terms.ts:40
        "overload": "过载周", // terms.ts:41
        "deload": "减量周",   // terms.ts:42
        "reentry": "回归周",  // terms.ts:43
        "restart": "重新开始", // terms.ts:44
    ]

    /// `INTENSITY_BIAS_LABELS` (terms.ts:47-51).
    public static let intensityBiasLabels: [String: String] = [
        "conservative": "保守", // terms.ts:48
        "normal": "标准",       // terms.ts:49
        "aggressive": "积极",   // terms.ts:50
    ]

    /// `TECHNIQUE_QUALITY_LABELS` (terms.ts:53-57).
    public static let techniqueQualityLabels: [String: String] = [
        "good": "良好",       // terms.ts:54
        "acceptable": "可接受", // terms.ts:55
        "poor": "较差",       // terms.ts:56
    ]

    /// `SUPPORT_BLOCK_LABELS` (terms.ts:59-62).
    public static let supportBlockLabels: [String: String] = [
        "correction": "纠偏模块", // terms.ts:60
        "functional": "功能补丁", // terms.ts:61
    ]

    /// `SKIP_REASON_LABELS` (terms.ts:64-72).
    public static let skipReasonLabels: [String: String] = [
        "time": "时间不足",       // terms.ts:65
        "pain": "出现不适",       // terms.ts:66
        "equipment": "器械受限",  // terms.ts:67
        "forgot": "漏记",         // terms.ts:68
        "too_tired": "疲劳过高",  // terms.ts:69
        "not_needed": "本次不需要", // terms.ts:70
        "other": "其他原因",      // terms.ts:71
    ]

    /// `DELOAD_LEVEL_LABELS` (terms.ts:74-79).
    public static let deloadLevelLabels: [String: String] = [
        "none": "正常推进",   // terms.ts:75
        "watch": "观察",      // terms.ts:76
        "yellow": "减量观察", // terms.ts:77
        "red": "恢复优先",    // terms.ts:78
    ]

    /// `DELOAD_STRATEGY_LABELS` (terms.ts:81-86).
    public static let deloadStrategyLabels: [String: String] = [
        "none": "按原计划推进",            // terms.ts:82
        "reduce_volume": "下修训练量",     // terms.ts:83
        "reduce_accessories": "减少辅助动作", // terms.ts:84
        "recovery_template": "切换到恢复优先安排", // terms.ts:85
    ]

    /// `READINESS_ADJUSTMENT_LABELS` (terms.ts:88-93).
    public static let readinessAdjustmentLabels: [String: String] = [
        "recovery": "恢复优先",     // terms.ts:89
        "conservative": "保守训练", // terms.ts:90
        "normal": "正常推进",       // terms.ts:91
        "push": "积极推进",         // terms.ts:92
    ]

    /// `MUSCLE_LABELS` (terms.ts:95-101). See the muscle-label de-dup note at
    /// the top of this file — distinct from formatters.ts MUSCLE_LABELS.
    public static let muscleLabels: [String: String] = [
        "chest": "胸",     // terms.ts:96
        "back": "背",      // terms.ts:97
        "legs": "腿",      // terms.ts:98
        "shoulders": "肩", // terms.ts:99
        "arms": "手臂",    // terms.ts:100
    ]

    /// `term` (terms.ts:103) = `TERMS[key]`. In TS the parameter is typed
    /// `keyof typeof TERMS`, so an unknown key is a compile-time error and the
    /// result is always a `string`. The faithful Swift equivalent returns
    /// `String?` — `nil` exactly for a key absent from `TERMS`.
    public static func term(_ key: String) -> String? { terms[key] }
}
