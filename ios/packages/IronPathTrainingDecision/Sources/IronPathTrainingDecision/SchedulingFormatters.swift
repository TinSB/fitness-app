// SC-0 — scheduling-track i18n formatter foundation.
//
// Faithful Swift mirror of `formatTrainingMode` (src/i18n/formatters.ts:213-214) — the
// ONE display formatter the recovery/scheduler engines import from src/i18n/formatters
// that was not yet native:
//   nextWorkoutScheduler.ts:1   import { formatMuscleName, formatTemplateName, formatTrainingMode }
//   nextWorkoutScheduler.ts:409 `const modeLabel = trainingMode ? formatTrainingMode(trainingMode) : ''`
// (formatMuscleName is AN-3 VolumeAdaptationEngine; formatTemplateName / formatExerciseName
// are already ported in IronPathL10n.Formatters / ExerciseLibrary.formatExerciseDisplayName.)
//
//   formatTrainingMode = lookupLabel('formatTrainingMode', value, TRAINING_MODE_LABELS)
//     TRAINING_MODE_LABELS (formatters.ts:85-89): hybrid / strength / hypertrophy.
//     lookupLabel (formatters.ts:35-60): empty → empty-default '未知状态'; object path reads
//       id/name/nameZh/label; string path = normalizeDisplayKey → map hit → label, else CJK
//       string → returned as-is, else '未知状态'.
//
// STRING-path scope (same as AN-3 formatMuscleName, VolumeAdaptationEngine.swift:611-622):
// the only call site (nextWorkoutScheduler.ts:409) guards `trainingMode ? …` so `value` is
// always a (truthy) string; the lookupLabel OBJECT path (id/name/nameZh/label candidates) is
// unreachable from it and intentionally NOT ported. The dev-only warnMissingFormatter
// console.warn (formatters.ts:15-19/58) is a no-op side effect and not ported.
//
// PURE / display-only: no clock, zero `: Date`, no IO, no write path. The
// `i18n/training-mode-cases-v1` golden (GENERATED from the REAL TS formatter via
// scripts/parityGoldensEntry.ts, never hand-authored — §22) reconciles the table + every
// branch so no entry, normalization step, or fallback string can drift in transcription.

import Foundation

/// The scheduling-track i18n formatter foundation. A namespace enum (no instances).
enum SchedulingFormatters {
    /// `TRAINING_MODE_LABELS` (formatters.ts:85-89) — verbatim.
    static let trainingModeLabels: [String: String] = [
        "hybrid": "综合",              // formatters.ts:86
        "strength": "力量",            // formatters.ts:87
        "hypertrophy": "肌肥大（增肌）", // formatters.ts:88
    ]

    /// `formatTrainingMode` (formatters.ts:213-214) = `lookupLabel('formatTrainingMode', value,
    /// TRAINING_MODE_LABELS)`, STRING path only (the scheduler call site always passes a string):
    /// empty → '未知状态'; normalized hit → label; else CJK → value; else '未知状态'.
    static func formatTrainingMode(_ value: String) -> String {
        // value === undefined || value === null || value === '' → empty default '未知状态'
        // (lookupLabel default `empty` arg, formatters.ts:39). The String carrier collapses the
        // undefined/null/'' cases to the empty string — the only one reachable from the call site.
        if value.isEmpty { return "未知状态" }
        // const normalized = normalizeDisplayKey(value); if (labels[normalized]) return labels[normalized]
        let normalized = normalizeDisplayKey(value)
        if let label = trainingModeLabels[normalized] { return label }
        // if (typeof value === 'string' && /[㐀-鿿]/.test(value)) return value (formatters.ts:57)
        if ExerciseLibrary.hasChineseText(value) { return value }
        // warnMissingFormatter(...) → no-op; return empty '未知状态' (formatters.ts:58-59)
        return "未知状态"
    }

    /// `normalizeDisplayKey` (formatters.ts:27-33) — trim → strip parenthesised content (CN/EN
    /// parens) → split camelCase → collapse `[_\s]+` to `-` → lowercase. Ported PRIVATE here
    /// (the same per-engine convention as VolumeAdaptationEngine / ReplacementEngine), so the
    /// scheduling-track formatter foundation stays self-contained.
    private static func normalizeDisplayKey(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines) // String(value||'').trim()
        s = regexReplaceAll(s, "[（(].*?[)）]", "")      // .replace(/[（(].*?[)）]/g, '')
        s = regexReplaceAll(s, "([a-z])([A-Z])", "$1-$2") // .replace(/([a-z])([A-Z])/g, '$1-$2')
        s = regexReplaceAll(s, "[_\\s]+", "-")           // .replace(/[_\s]+/g, '-')
        return s.lowercased()                             // .toLowerCase()
    }

    /// Apply a regex global replace (NSRegularExpression), mirroring `String.prototype.replace`
    /// with a `/g` pattern.
    private static func regexReplaceAll(_ input: String, _ pattern: String, _ replacement: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return input }
        let range = NSRange(input.startIndex..., in: input)
        return regex.stringByReplacingMatches(in: input, range: range, withTemplate: replacement)
    }
}
