// ProgramAdjustmentEngine — PA-S7 (PA-1a) programAdjustmentEngine minimal port.
//
// Faithful line-by-line Swift port of the TWO dependency-minimal exports of the
// PURE / read-only `retired web reference`:
//   * hashProgramTemplate  (programAdjustmentEngine.ts:92)  + its INLINE
//     stableStringify helper (ts:82-90)
//   * rollbackAdjustment    (programAdjustmentEngine.ts:921)
//
// SCOPE BOUNDARY (PA-1a): the engine's other four exports
// (selectBestDayForNewExercise / createAdjustmentDraftFromRecommendations /
// buildAdjustmentDiff / applyAdjustmentDraft) and every other plan-adjust engine
// are OUT of this slice (PA-1b+). Nothing here touches a write path:
// `rollbackAdjustment` only RETURNS the restore result — it never persists, never
// calls CanonicalSessionWriter / JSONFileAppDataStore / any §8 write boundary
// (applying a rollback to source-of-truth is the later PA-2 slice).
//
// REUSES (never re-ports) the already-ported building blocks:
//   * PA-S1 IronPathDomain types verbatim — TrainingTemplate / ProgramTemplate /
//     ProgramAdjustmentHistoryItem (+ NumberRepr / JSONValue / OrderedJSONObject);
//   * the S2 deep-clone `EngineValueUtils.clone` (= legacy web schema `clone` =
//     `JSON.parse(JSON.stringify())`, engineUtils.ts:28) for `cloneProgram`.
//
// stableStringify FIDELITY (the precision core): the inline legacy web schema stableStringify is
// a DISTINCT serializer from the repo's §9 `JSONValue.canonicalJSONString()`. They
// agree on the case-insensitive *primary* key order AND — as of FIX-B — on the
// case tie-break too: both break ties lower-before-upper (the JS
// `String.prototype.localeCompare` tertiary; §9 `canonicalKeyOrder` was corrected
// from its old code-point upper-before-lower tie-break in FIX-B). This port still
// keeps its OWN `localeCompare`-equivalent comparator (`keyOrderLess`) rather than
// routing through §9 — the engine reimplements stableStringify over `JSONValue`
// self-contained (line-by-line with the legacy web schema inline stableStringify); that locality
// is intentional and no longer reflects a tie-break divergence. The program-adjust
// goldens (generated from the retired legacy engine) are the byte-level judge.
//
// TIME INJECTION (§11): legacy web schema `rollbackAdjustment` reads the wall clock once
// (`rolledBackAt: new Date().toISOString()`, ts:934). The Swift port DOES NOT call
// any system clock — `nowIso` is a REQUIRED injected ISO string (the iOS-17e / AN
// deterministic-clock contract). Given identical (historyItem, nowIso) it returns
// an identical result. The rollback golden is generated with the wall-clock field
// substituted by `parityMeta.deterministicClockIso`; the Swift side compute-asserts
// with the SAME injected value.
//
// PURE / READ-ONLY: only string + number + array transforms over value types. Zero
// `: Date`, zero Calendar, zero IO, zero randomness, NO write path. Goldens are
// GENERATED from the retired legacy engine (frozen legacy fixture generator), never
// hand-edited (§22).

import Foundation
import IronPathDomain

public enum ProgramAdjustmentEngine {

    // MARK: - hashProgramTemplate (programAdjustmentEngine.ts:92-100)

    /// `hashProgramTemplate(programTemplate: TrainingTemplate | ProgramTemplate)`
    /// (programAdjustmentEngine.ts:92). TrainingTemplate overload.
    public static func hashProgramTemplate(_ programTemplate: TrainingTemplate) -> String {
        fnv1aTemplateHash(programTemplate.encoded())
    }

    /// `hashProgramTemplate(programTemplate: TrainingTemplate | ProgramTemplate)`
    /// (programAdjustmentEngine.ts:92). ProgramTemplate overload.
    public static func hashProgramTemplate(_ programTemplate: ProgramTemplate) -> String {
        fnv1aTemplateHash(programTemplate.encoded())
    }

    /// The FNV-1a body of `hashProgramTemplate` (ts:93-99) over the template's
    /// canonical `JSONValue` projection (decode→`encoded()` is lossless up to the
    /// key order stableStringify re-imposes itself, so the typed projection is
    /// hash-invariant — see the file header).
    private static func fnv1aTemplateHash(_ value: JSONValue) -> String {
        let serialized = stableStringify(value)                  // ts:93
        var hash: UInt32 = 2166136261                            // ts:94
        // `for (index … ) { hash ^= serialized.charCodeAt(index); hash = Math.imul(hash, 16777619) }`
        // charCodeAt iterates UTF-16 code units (ts:95-97) — NOT Unicode scalars /
        // UTF-8 bytes; `Math.imul` is 32-bit wrapping signed multiply, reproduced as
        // UInt32 `&*` (the XOR/multiply bit patterns are identical to JS's ToInt32 /
        // ToUint32 dance).
        for code in serialized.utf16 {
            hash ^= UInt32(code)                                 // ts:96
            hash = hash &* 16777619                              // ts:97 (Math.imul wrapping)
        }
        // `tpl-${(hash >>> 0).toString(16)}` (ts:99): `hash` is already an unsigned
        // 32-bit value, `String(_:radix:)` emits lowercase hex with no leading zeros.
        return "tpl-" + String(hash, radix: 16)
    }

    // MARK: - stableStringify (programAdjustmentEngine.ts:82-90) — inlined, faithful

    /// `stableStringify(value)` (programAdjustmentEngine.ts:82-90) over `JSONValue`.
    static func stableStringify(_ value: JSONValue) -> String {
        switch value {
        // `if (value === null || typeof value !== 'object') return JSON.stringify(value)` (ts:83)
        case .null:
            return "null"                                        // JSON.stringify(null)
        case .bool(let b):
            return b ? "true" : "false"                          // JSON.stringify(true|false)
        case .number(let n):
            return jsonNumberText(n)                             // JSON.stringify(<number>)
        case .string(let s):
            return jsonStringText(s)                             // JSON.stringify(<string>)
        // `if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`` (ts:84)
        case .array(let items):
            return "[" + items.map { stableStringify($0) }.joined(separator: ",") + "]"
        // Object branch (ts:85-89): Object.entries → drop undefined → sort by key via
        // localeCompare → `JSON.stringify(key):stableStringify(value)` → join(',') → wrap `{}`.
        case .object(let obj):
            // `.filter(([, entry]) => entry !== undefined)` (ts:86): `JSONValue` cannot
            // represent `undefined`, and the PA-S1 `encoded()` projection omits nil
            // typed fields entirely (equivalent to legacy web schema dropping `undefined` keys), so no
            // entry needs filtering here; explicit `null` (≠ undefined in JS) is kept.
            let sorted = obj.entries.sorted { keyOrderLess($0.key, $1.key) }  // ts:87 (localeCompare)
            let parts = sorted.map { entry in
                jsonStringText(entry.key) + ":" + stableStringify(entry.value) // ts:88
            }
            return "{" + parts.joined(separator: ",") + "}"     // ts:89
        }
    }

    // MARK: - rollbackAdjustment (programAdjustmentEngine.ts:921-936)

    /// The legacy web schema `rollbackAdjustment` return shape (ts:923-926).
    public struct RollbackResult: Equatable, Sendable {
        /// `restoredTemplateId: historyItem.sourceProgramTemplateId` (ts:928, required
        /// in legacy web schema — `String?` here only because the PA-S1 type is all-optional).
        public let restoredTemplateId: String?
        /// `restoredProgramTemplate?` — the cloned snapshot, or nil (ts:925/929).
        public let restoredProgramTemplate: ProgramTemplate?
        /// `updatedHistoryItem` — the spread + 3 overrides (ts:930-935).
        public let updatedHistoryItem: ProgramAdjustmentHistoryItem

        public init(
            restoredTemplateId: String?,
            restoredProgramTemplate: ProgramTemplate?,
            updatedHistoryItem: ProgramAdjustmentHistoryItem
        ) {
            self.restoredTemplateId = restoredTemplateId
            self.restoredProgramTemplate = restoredProgramTemplate
            self.updatedHistoryItem = updatedHistoryItem
        }
    }

    /// `rollbackAdjustment(historyItem)` (programAdjustmentEngine.ts:921-936).
    ///
    /// PURE: returns the restore result ONLY — never persists. `nowIso` is the
    /// REQUIRED injected clock replacing legacy web schema `new Date().toISOString()` (ts:934).
    public static func rollbackAdjustment(
        _ historyItem: ProgramAdjustmentHistoryItem,
        nowIso: String
    ) -> RollbackResult {
        // `restoredProgramTemplate: historyItem.sourceProgramSnapshot
        //    ? cloneProgram(historyItem.sourceProgramSnapshot) : undefined` (ts:929).
        // cloneProgram (ts:133) = clone (engineUtils.ts:28) = JSON.parse(JSON.stringify);
        // reuse the S2 deep-clone over the snapshot's canonical JSONValue projection.
        let restored: ProgramTemplate?
        if let snapshot = historyItem.sourceProgramSnapshot {
            restored = try? ProgramTemplate(decoding: EngineValueUtils.clone(snapshot.encoded()))
        } else {
            restored = nil
        }

        // `updatedHistoryItem: { ...historyItem, status: 'rolled_back',
        //    rollbackAvailable: false, rolledBackAt: new Date().toISOString() }`
        // (ts:930-935). Faithful spread: copy every field, override the three, and
        // carry the `_unknown` open bag through verbatim (the `...historyItem` spread
        // preserves any not-yet-typed keys).
        let updatedHistoryItem = ProgramAdjustmentHistoryItem(
            id: historyItem.id,
            appliedAt: historyItem.appliedAt,
            sourceProgramTemplateId: historyItem.sourceProgramTemplateId,
            experimentalProgramTemplateId: historyItem.experimentalProgramTemplateId,
            sourceCoachActionId: historyItem.sourceCoachActionId,
            sourceFingerprint: historyItem.sourceFingerprint,
            sourceProgramTemplateName: historyItem.sourceProgramTemplateName,
            experimentalProgramTemplateName: historyItem.experimentalProgramTemplateName,
            mainChangeSummary: historyItem.mainChangeSummary,
            selectedRecommendationIds: historyItem.selectedRecommendationIds,
            changes: historyItem.changes,
            status: "rolled_back",                              // ts:932
            explanation: historyItem.explanation,
            rollbackAvailable: false,                           // ts:933
            rolledBackAt: nowIso,                               // ts:934 (injected clock)
            sourceProgramSnapshot: historyItem.sourceProgramSnapshot,
            effectReview: historyItem.effectReview,
            _unknown: historyItem._unknown                      // open-bag passthrough
        )

        return RollbackResult(
            restoredTemplateId: historyItem.sourceProgramTemplateId,  // ts:928
            restoredProgramTemplate: restored,
            updatedHistoryItem: updatedHistoryItem
        )
    }

    // MARK: - JS-faithful primitive rendering + localeCompare key order

    /// `JSON.stringify(<number>)` for a parsed `NumberRepr`: integer-valued numbers
    /// (incl. whole-valued doubles) collapse to integer text (`42.0` → `"42"`),
    /// other finite doubles use the shortest round-trip form (Swift `String(Double)`
    /// == V8 `Number.prototype.toString`), and non-finite → `"null"`
    /// (`JSON.stringify(NaN|Infinity) === "null"`). `.decimal` never arises from JSON
    /// parsing; handled defensively to match the §9 canonical decimal emit.
    private static func jsonNumberText(_ n: NumberRepr) -> String {
        switch n {
        case .integer(let i):
            return String(i)
        case .double(let d):
            if !d.isFinite { return "null" }                    // JSON.stringify(NaN|±Infinity)
            if d.isZero { return "0" }
            if d.truncatingRemainder(dividingBy: 1) == 0,
               d >= Double(Int64.min), d <= Double(Int64.max) {
                return String(Int64(d))                         // 42.0 → "42"
            }
            return String(d)
        case .decimal(let dec):
            if dec.isZero { return "0" }
            var copy = dec
            var rounded = Decimal()
            NSDecimalRound(&rounded, &copy, 0, .down)
            return rounded == dec ? "\(rounded)" : "\(dec)"
        }
    }

    /// `JSON.stringify(<string>)`: wrap in quotes, escape `"` / `\` and the C0
    /// control set (short escapes for `\b \t \n \f \r`, `\u00xx` otherwise), and
    /// emit every other scalar — including non-ASCII (e.g. Chinese name/note) —
    /// verbatim (JSON.stringify does NOT \u-escape `/`, U+2028, U+2029, or any
    /// non-control non-ASCII).
    private static func jsonStringText(_ s: String) -> String {
        var out = "\""
        for scalar in s.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\u{08}": out += "\\b"
            case "\u{09}": out += "\\t"
            case "\u{0A}": out += "\\n"
            case "\u{0C}": out += "\\f"
            case "\u{0D}": out += "\\r"
            default:
                if scalar.value < 0x20 {
                    out += String(format: "\\u%04x", scalar.value)
                } else {
                    out.unicodeScalars.append(scalar)
                }
            }
        }
        out += "\""
        return out
    }

    /// `left.localeCompare(right) < 0` (programAdjustmentEngine.ts:87) for the key
    /// sort. Node default-locale `localeCompare` over the ASCII identifier keys these
    /// templates carry is a case-INSENSITIVE primary comparison (letters/digits in
    /// natural order — e.g. `daysPerWeek` < `dayTemplates` because the lowercased
    /// `'s'` < `'t'`, which raw code-point order would get wrong), and its case
    /// tertiary tie-break — applied when two keys are equal once lowercased — sorts
    /// lower-BEFORE-upper (`'a'.localeCompare('A') < 0`, verified against Node). As of
    /// FIX-B the §9 `canonicalKeyOrder` (JSONValue.swift) breaks ties the SAME way —
    /// it was corrected from its old raw code-point upper-before-lower tie-break — so
    /// the two comparators now AGREE; S7 still keeps this self-contained
    /// localeCompare-faithful comparator rather than routing through §9 (the locality
    /// is intentional, see the file header), not because of a tie-break divergence.
    /// For ASCII keys equal when lowercased, lower-before-upper is precisely raw `>`
    /// (lowercase letters carry the higher code points). The case-folding hash golden
    /// pins it; the goldens (generated from the retired legacy engine) are the final
    /// byte-level judge.
    private static func keyOrderLess(_ a: String, _ b: String) -> Bool {
        let al = a.lowercased()
        let bl = b.lowercased()
        if al != bl { return al < bl }
        // localeCompare tertiary: lower-before-upper. For ASCII case-only differences
        // this is raw code-point `>` (lowercase carries the higher code points) — the
        // same direction §9 canonicalKeyOrder now uses (aligned in FIX-B).
        return a > b
    }
}
