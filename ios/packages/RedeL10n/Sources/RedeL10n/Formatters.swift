// PA-S4 — i18n/formatters PA-subset port.
//
// Faithful Swift mirror of the THREE display formatters that
// `retired web reference` imports from `retired web reference`
// (engine import段, programAdjustmentEngine.ts:11-14) plus their private
// dependencies:
//   - formatProgramTemplateName (formatters.ts:484-486) → delegates to
//   - formatTemplateName        (formatters.ts:187-208) → reads
//       TEMPLATE_NAME_MAP       (formatters.ts:62-83),
//       normalizeDisplayKey     (formatters.ts:27-33),
//       localizeTemplateNameText(formatters.ts:178-185),
//       warnMissingFormatter    (formatters.ts:15-19, DEV-only console.warn → no-op)
//   - formatDayTemplateName     (formatters.ts:488-490) → delegates to
//     formatTrainingDayName     (formatters.ts:210-211) = thin wrapper over the
//     SAME formatTemplateName chain (reused here, not re-implemented)
//   - formatAdjustmentChangeLabel (formatters.ts:496-507) — an independent inline
//     7-entry record map with `?? '计划调整'` fallback, keyed by the RAW value
//     (legacy web schema `value as string`, NO normalizeDisplayKey)
//
// Each Swift declaration cites its mirrored legacy web schema source line; every table is
// transcribed entry-by-entry (key + Chinese value verbatim). The GENERATED
// `i18n/formatters-pa-snapshot-v1` parity golden (produced by running the REAL
// legacy web schema formatters through retired fixture generator, never hand-authored —
// §22) mechanically reconciles both tables AND a branch-covering probe set, so
// no map entry, branch, regex, or fallback string can drift in transcription.
//
// ── De-dup contract (REUSE, do NOT re-port) ──────────────────────────────────
//   * formatExerciseName (formatters.ts:492-494) → REUSES the already-ported
//     `RedeTrainingDecision.ExerciseLibrary.formatExerciseDisplayName`. NOT
//     ported here (a second copy would force an L10n→TrainingDecision dependency).
//   * formatMuscleName (formatters.ts:219) → REUSES the already-ported
//     `RedeTrainingDecision.VolumeAdaptationEngine.formatMuscleName`. NOT here.
//   * formatAdjustmentRiskLevel (formatters.ts:509-516) / formatAdjustmentReviewStatus
//     (formatters.ts:519-528) → programAdjustmentEngine does NOT import them
//     (verified: engine imports only the 4 formatters above). NOT ported in this slice.
//   * Terms (S0, RedeL10n.Terms) + the PA-S1 domain types are REUSED, not re-ported.
//
// ── `value: unknown` modelling (zero-dependency rationale) ────────────────────
//   The legacy web schema formatters accept `unknown`; in this repo's Swift the analogous carrier
//   is `RedeDomain.JSONValue`. RedeL10n, however, is a ZERO-dependency
//   leaf package (Package.swift: "No remote dependencies"; same contract that
//   keeps S0 Terms standalone). Importing JSONValue would require adding an
//   RedeDomain dependency to RedeL10n/Package.swift — forbidden by the
//   slice's hard red lines (no Package.swift edits; no L10n→downstream edge /
//   dependency cycle). So the template-name formatters take a self-contained
//   local `NameValue` that faithfully carries the only shapes the engine ever
//   passes (formatters.ts only reads a string, or an object's id/nameZh/name/label
//   string fields; programAdjustmentEngine.ts:494/523/767/835 pass a template
//   object or a plain string). A future engine-port slice (which lives in
//   RedeTrainingDecision and legitimately depends on both packages) adapts its
//   JSONValue template objects into `NameValue` at the call site.
//
// PURE / display-only: no clock, zero `: Date`, no IO, no write path, no
// CanonicalSessionWriter. These functions only produce display strings.

import Foundation

public enum Formatters {
    // MARK: - `value: unknown` carrier

    /// Faithful local stand-in for the legacy web schema `value: unknown` accepted by
    /// `formatTemplateName` (formatters.ts:187). The legacy web schema only ever reads a
    /// primitive string, or — when `typeof value === 'object'` — the object's
    /// `id`, `nameZh`, `name`, `label` fields (formatters.ts:189-197). Modelled
    /// locally (NOT `RedeDomain.JSONValue`) to keep RedeL10n
    /// zero-dependency — see the file header for the full rationale.
    public enum NameValue: Equatable, Sendable {
        /// legacy web schema `undefined` / `null`.
        case null
        /// legacy web schema primitive string.
        case string(String)
        /// legacy web schema object; only these four fields are read by formatTemplateName.
        case object(id: String? = nil, nameZh: String? = nil, name: String? = nil, label: String? = nil)
    }

    // MARK: - Frozen tables (mirrored verbatim from legacy web schema truth)

    /// `TEMPLATE_NAME_MAP` (formatters.ts:62-83). 20 entries, key + Chinese
    /// value verbatim. `internal` (not `private`) so the @testable parity test
    /// can reconcile it entry-by-entry against the golden; it is NOT part of the
    /// public API surface.
    static let templateNameMap: [String: String] = [
        "push-a": "推 A",          // formatters.ts:63
        "pusha": "推 A",           // formatters.ts:64
        "push": "推 A",            // formatters.ts:65
        "pull-a": "拉 A",          // formatters.ts:66
        "pulla": "拉 A",           // formatters.ts:67
        "pull": "拉 A",            // formatters.ts:68
        "legs-a": "腿 A",          // formatters.ts:69
        "legsa": "腿 A",           // formatters.ts:70
        "legs": "腿 A",            // formatters.ts:71
        "upper-a": "上肢 A",       // formatters.ts:72
        "uppera": "上肢 A",        // formatters.ts:73
        "upper": "上肢 A",         // formatters.ts:74
        "lower-a": "下肢 A",       // formatters.ts:75
        "lowera": "下肢 A",        // formatters.ts:76
        "lower": "下肢 A",         // formatters.ts:77
        "full-body": "全身训练",   // formatters.ts:78
        "fullbody": "全身训练",    // formatters.ts:79
        "arms": "手臂补量",        // formatters.ts:80
        "quick-30": "30 分钟快练", // formatters.ts:81
        "crowded-gym": "人多替代", // formatters.ts:82
    ]

    /// The inline change-label record from `formatAdjustmentChangeLabel`
    /// (formatters.ts:498-506). 7 entries, verbatim. `internal` for the same
    /// parity-reconciliation reason as `templateNameMap`.
    static let adjustmentChangeLabels: [String: String] = [
        "add_sets": "增加组数",           // formatters.ts:499
        "remove_sets": "减少组数",        // formatters.ts:500
        "add_new_exercise": "新增动作",   // formatters.ts:501
        "swap_exercise": "替代动作",      // formatters.ts:502
        "reduce_support": "减少辅助层",   // formatters.ts:503
        "increase_support": "增加辅助层", // formatters.ts:504
        "keep": "保持当前结构",           // formatters.ts:505
    ]

    // MARK: - Public formatters (the 3 the engine imports)

    /// `formatProgramTemplateName` (formatters.ts:484-486) =
    /// `formatTemplateName(value, fallbackLabel)`, default fallback `'未知模板'`.
    public static func formatProgramTemplateName(_ value: NameValue, fallbackLabel: String = "未知模板") -> String {
        formatTemplateName(value, fallbackLabel: fallbackLabel)
    }

    /// `formatDayTemplateName` (formatters.ts:488-490) =
    /// `formatTrainingDayName(value, fallbackLabel)`, default fallback `'未指定训练日'`.
    public static func formatDayTemplateName(_ value: NameValue, fallbackLabel: String = "未指定训练日") -> String {
        formatTrainingDayName(value, fallbackLabel: fallbackLabel)
    }

    /// `formatAdjustmentChangeLabel` (formatters.ts:496-507) =
    /// `({...})[value as string] ?? '计划调整'`. The legacy web schema keys by the RAW value
    /// (cast to string), with NO normalizeDisplayKey — mirrored faithfully here:
    /// the dictionary is looked up with the raw string. legacy web schema `value: unknown` is,
    /// in this engine, always `change.type` (a string) or `null`/`undefined`
    /// (→ JS `obj['null']`/`obj['undefined']` → undefined → fallback), so the
    /// faithful Swift carrier is `String?` (nil = the null/undefined case).
    public static func formatAdjustmentChangeLabel(_ value: String?) -> String {
        guard let key = value else { return "计划调整" }
        return adjustmentChangeLabels[key] ?? "计划调整"
    }

    // MARK: - Delegate chain

    /// `formatTrainingDayName` (formatters.ts:210-211) = `formatTemplateName(value,
    /// fallbackLabel)` (a thin wrapper; reuses the shared chain, not re-implemented).
    static func formatTrainingDayName(_ value: NameValue, fallbackLabel: String = "未命名") -> String {
        formatTemplateName(value, fallbackLabel: fallbackLabel)
    }

    /// `formatTemplateName` (formatters.ts:187-208). Faithful branch-by-branch port.
    static func formatTemplateName(_ value: NameValue, fallbackLabel: String = "未命名") -> String {
        // value === undefined || value === null || value === '' -> fallbackLabel (formatters.ts:188)
        let candidates: [String?]
        switch value {
        case .null:
            return fallbackLabel
        case .string(let s):
            if s.isEmpty { return fallbackLabel } // value === ''
            // typeof value === 'object' ? [...] : [value] (formatters.ts:189-197)
            candidates = [s]
        case .object(let id, let nameZh, let name, let label):
            // formatters.ts:191-196 — candidate order is id, nameZh, name, label
            // (deliberately DISTINCT from lookupLabel's id, name, nameZh, label).
            candidates = [id, nameZh, name, label]
        }

        for candidate in candidates {
            // String(candidate || '') then normalizeDisplayKey (formatters.ts:199, :27-33).
            let normalized = normalizeDisplayKey(candidate ?? "")
            if let hit = templateNameMap[normalized] { return hit } // formatters.ts:200
            if let c = candidate { // typeof candidate === 'string' (formatters.ts:201)
                let localized = localizeTemplateNameText(c.trimmingCharacters(in: .whitespacesAndNewlines)) // :202
                // /[㐀-鿿]/.test(localized) && !/\b(push|pull|legs|upper|lower|full body)\b/i.test(localized)
                if containsCjk(localized) && !containsEnglishTemplateWord(localized) { // formatters.ts:203
                    return localized
                }
            }
        }
        // warnMissingFormatter('formatTemplateName', value) — DEV-only console.warn,
        // no functional output (formatters.ts:206, :15-19) → intentionally a no-op.
        return fallbackLabel // formatters.ts:207
    }

    // MARK: - Private helpers (regex-faithful)

    /// `normalizeDisplayKey` (formatters.ts:27-33): trim → strip parenthesised
    /// content (CN/EN parens) → split camelCase → collapse `[_\s]+` to `-` →
    /// lowercase. Same transform the ReplacementEngine / VolumeAdaptationEngine
    /// ports each ship privately (per-engine convention); ported here independently
    /// so RedeL10n stays self-contained.
    private static func normalizeDisplayKey(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines) // String(value||'').trim()
        s = regexReplaceAll(s, "[（(].*?[)）]", "")     // .replace(/[（(].*?[)）]/g, '')
        s = regexReplaceAll(s, "([a-z])([A-Z])", "$1-$2") // .replace(/([a-z])([A-Z])/g, '$1-$2')
        s = regexReplaceAll(s, "[_\\s]+", "-")          // .replace(/[_\s]+/g, '-')
        return s.lowercased()                            // .toLowerCase()
    }

    /// `localizeTemplateNameText` (formatters.ts:178-185): six case-insensitive
    /// `\b…\b` template-name substitutions, regex + replacement text mirrored verbatim.
    ///
    /// `\b` FIDELITY: JS `\b` is an ASCII word boundary (`\w` = `[A-Za-z0-9_]`), but
    /// NSRegularExpression (ICU) `\b` treats CJK scalars as word chars — so an English
    /// token glued directly to a CJK char (`full body训练`) sees a boundary under JS but
    /// NOT under ICU, diverging. We spell `\b` as the explicit ASCII look-arounds JS
    /// means: `(?<![A-Za-z0-9_])` / `(?![A-Za-z0-9_])`. The English-glued-to-CJK probe
    /// golden pins the equivalence.
    private static func localizeTemplateNameText(_ value: String) -> String {
        var s = value
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])push[\\s_-]*a(?![A-Za-z0-9_])", "推 A", caseInsensitive: true)        // :180
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])pull[\\s_-]*a(?![A-Za-z0-9_])", "拉 A", caseInsensitive: true)        // :181
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])legs[\\s_-]*a(?![A-Za-z0-9_])", "腿 A", caseInsensitive: true)        // :182
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])upper[\\s_-]*a(?![A-Za-z0-9_])", "上肢 A", caseInsensitive: true)     // :183
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])lower[\\s_-]*a(?![A-Za-z0-9_])", "下肢 A", caseInsensitive: true)     // :184
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])full[\\s_-]*body(?![A-Za-z0-9_])", "全身训练", caseInsensitive: true) // :185
        return s
    }

    /// `/[㐀-鿿]/.test(value)` (formatters.ts:203) — true iff the string carries any
    /// CJK scalar in U+3400…U+9FFF, the exact range the legacy web schema regex matches.
    private static func containsCjk(_ value: String) -> Bool {
        for scalar in value.unicodeScalars where scalar.value >= 0x3400 && scalar.value <= 0x9FFF {
            return true
        }
        return false
    }

    /// `/\b(push|pull|legs|upper|lower|full body)\b/i.test(value)` (formatters.ts:203) —
    /// true iff a residual English template word remains after localization. Uses the
    /// ASCII `\b` look-arounds (see localizeTemplateNameText) so a CJK-glued English
    /// token matches as it does under JS `\b`, not under ICU's CJK-inclusive `\b`.
    private static func containsEnglishTemplateWord(_ value: String) -> Bool {
        regexMatches(value, "(?<![A-Za-z0-9_])(push|pull|legs|upper|lower|full body)(?![A-Za-z0-9_])", caseInsensitive: true)
    }

    /// Global regex replace (`String.prototype.replace(/…/g, …)`). The replacement
    /// is an NSRegularExpression template, so `$1`/`$2` group refs work (used by
    /// normalizeDisplayKey's camelCase split); the literal Chinese replacements
    /// carry no `$`/`\\` so they pass through verbatim.
    private static func regexReplaceAll(
        _ input: String,
        _ pattern: String,
        _ replacement: String,
        caseInsensitive: Bool = false
    ) -> String {
        let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return input }
        let range = NSRange(input.startIndex..., in: input)
        return regex.stringByReplacingMatches(in: input, range: range, withTemplate: replacement)
    }

    /// `regex.test(input)` — does the pattern match anywhere in the input.
    private static func regexMatches(_ input: String, _ pattern: String, caseInsensitive: Bool) -> Bool {
        let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return false }
        let range = NSRange(input.startIndex..., in: input)
        return regex.firstMatch(in: input, range: range) != nil
    }
}
