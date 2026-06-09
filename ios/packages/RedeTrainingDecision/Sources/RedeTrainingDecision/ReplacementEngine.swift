// SR-2 — Replacement Engine (pure logic port).
//
// Faithful, line-by-line Swift transcription of the THREE replacement-engine
// functions in retired-web-reference that SR-2 ports, plus every
// private helper they transitively need:
//
//   replacementEngine.ts:120  isSyntheticReplacementExerciseId
//   replacementEngine.ts:122  validateReplacementExerciseId
//   replacementEngine.ts:304  buildReplacementOptions
//
// It consumes the SR-1 library (ExerciseLibrary) + the SR-2 knowledge tables
// (ReplacementEngineKnowledge). It is PURE: no IO, no clock, no `: Date`, no
// randomness. The legacy web schema module's session-mutating functions
// (applyExerciseReplacement / restoreOriginalExercise — replacementEngine.ts:355,
// 413) are the WRITE PATH and are intentionally NOT ported here, nor is the
// top-level smartReplacement engine (that is SR-3).
//
// Output is reconciled against generated parity goldens
// (replacement-engine/*; ReplacementEngineParityTests): the legacy web schema generator runs
// the REAL engine over committed fixtures, and the Swift port must reproduce the
// SAME ReplacementOption[] / validate / isSynthetic results item-by-item.
//
// FAITHFULNESS NOTES (verified byte-for-byte against the legacy web schema source):
//   • normalizeName() (replacementEngine.ts:166) uses the regex
//     /[（）()\\s-]/g — a DOUBLE backslash in a regex literal, i.e. the char
//     class { （ ） ( ) \ s - }. It strips a literal backslash and the literal
//     lowercase letter 's' (NOT whitespace — `\s` whitespace would need a single
//     backslash), then lowercases. This quirk is reproduced exactly.
//   • Array de-dup + the rank sort preserve insertion order. JS `Array.prototype.sort`
//     is stable; Swift `sorted(by:)` is not — so the rank sort breaks ties on the
//     pre-sort index, and the equipment re-sort breaks final ties on the captured
//     `equipmentSortIndex`, exactly mirroring the stable JS sorts.

import Foundation

// MARK: - Public output types

/// `ReplacementRank` — mirrors the legacy web schema union (replacementEngine.ts:15). Raw values
/// match the legacy web schema string literals; the three `_fallback`/`_reduction` cases are the
/// only non-1:1 Swift case names.
public enum ReplacementRank: String, Equatable, Sendable, CaseIterable {
    case priority
    case acceptable
    case angle
    case optional
    case equipmentFallback = "equipment_fallback"
    case fatigueReduction = "fatigue_reduction"
    case compoundFallback = "compound_fallback"
}

/// `ReplacementOption` — mirrors the legacy web schema interface (replacementEngine.ts:18-27).
public struct ReplacementOption: Equatable, Sendable {
    public let id: String
    public let name: String
    public let rank: ReplacementRank
    public let rankLabel: String
    public let reason: String
    public let fatigueCost: String
    public let fatigueCostLabel: String
    public let prIndependent: Bool

    public init(
        id: String,
        name: String,
        rank: ReplacementRank,
        rankLabel: String,
        reason: String,
        fatigueCost: String,
        fatigueCostLabel: String,
        prIndependent: Bool
    ) {
        self.id = id
        self.name = name
        self.rank = rank
        self.rankLabel = rankLabel
        self.reason = reason
        self.fatigueCost = fatigueCost
        self.fatigueCostLabel = fatigueCostLabel
        self.prIndependent = prIndependent
    }

    /// Copy with a replaced `reason` (the equipment pass rewrites only the reason).
    func withReason(_ newReason: String) -> ReplacementOption {
        ReplacementOption(
            id: id, name: name, rank: rank, rankLabel: rankLabel, reason: newReason,
            fatigueCost: fatigueCost, fatigueCostLabel: fatigueCostLabel, prIndependent: prIndependent
        )
    }
}

/// `ReplacementContext` — mirrors the legacy web schema interface (replacementEngine.ts:29-31).
public struct ReplacementContext: Equatable, Sendable {
    public var unavailableEquipment: [ExerciseEquipmentTag]
    public init(unavailableEquipment: [ExerciseEquipmentTag] = []) {
        self.unavailableEquipment = unavailableEquipment
    }
}

/// The slice of `ExercisePrescription` (training-model.ts) that buildReplacementOptions
/// reads: the identity id fields + the per-exercise explicit-alternatives fallback.
/// `id` is required (legacy web schema `ExercisePrescription.id: string`); the rest are optional.
public struct ReplacementExerciseInput: Equatable, Sendable {
    public var id: String
    public var baseId: String?
    public var canonicalExerciseId: String?
    public var originalExerciseId: String?
    public var actualExerciseId: String?
    public var replacementExerciseId: String?
    public var replacedFromId: String?
    public var alternativeIds: [String]?
    public var alternativePriorities: [String: String]?

    public init(
        id: String,
        baseId: String? = nil,
        canonicalExerciseId: String? = nil,
        originalExerciseId: String? = nil,
        actualExerciseId: String? = nil,
        replacementExerciseId: String? = nil,
        replacedFromId: String? = nil,
        alternativeIds: [String]? = nil,
        alternativePriorities: [String: String]? = nil
    ) {
        self.id = id
        self.baseId = baseId
        self.canonicalExerciseId = canonicalExerciseId
        self.originalExerciseId = originalExerciseId
        self.actualExerciseId = actualExerciseId
        self.replacementExerciseId = replacementExerciseId
        self.replacedFromId = replacedFromId
        self.alternativeIds = alternativeIds
        self.alternativePriorities = alternativePriorities
    }
}

// MARK: - Engine

/// The replacement engine. A namespace enum (no instances); all members static.
public enum ReplacementEngine {

    // MARK: Constant tables (replacementEngine.ts:33-67)

    /// rankLabels (replacementEngine.ts:33-41).
    static let rankLabels: [ReplacementRank: String] = [
        .priority: "优先",
        .acceptable: "可接受",
        .angle: "角度相近",
        .optional: "可选",
        .equipmentFallback: "器械不可用时",
        .fatigueReduction: "降低疲劳",
        .compoundFallback: "复合动作替代",
    ]

    /// rankOrder (replacementEngine.ts:43-51). A total switch (every case mapped).
    static func rankOrderValue(_ rank: ReplacementRank) -> Int {
        switch rank {
        case .priority: return 0
        case .acceptable: return 1
        case .angle: return 1
        case .optional: return 2
        case .equipmentFallback: return 3
        case .fatigueReduction: return 3
        case .compoundFallback: return 3
        }
    }

    /// forbiddenBenchReplacementIds (replacementEngine.ts:53).
    static let forbiddenBenchReplacementIds: Set<String> = [
        "triceps-pushdown", "shoulder-press", "machine-shoulder-press", "cable-fly",
    ]

    /// equipmentLabels (replacementEngine.ts:57-67).
    static func equipmentLabel(_ tag: ExerciseEquipmentTag) -> String {
        switch tag {
        case .dumbbell: return "哑铃区"
        case .barbell: return "杠铃区"
        case .smith: return "史密斯机"
        case .cable: return "绳索区"
        case .machine: return "固定器械区"
        case .bodyweight: return "自重区"
        case .bench: return "卧推凳"
        case .rack: return "深蹲架"
        case .plateLoaded: return "片加载器械"
        }
    }

    // MARK: i18n formatters (retired-web-reference)

    /// LEVEL_LABELS (formatters.ts:171-176).
    static let levelLabels: [String: String] = [
        "low": "低", "medium": "中等", "moderate": "中等", "high": "高",
    ]

    /// `formatFatigueCost` (formatters.ts:280) → lookupLabel(value, LEVEL_LABELS).
    static func formatFatigueCost(_ value: String) -> String {
        lookupLabel(value, levelLabels)
    }

    /// `formatReplacementCategory` (formatters.ts:311-330). Only reachable as the
    /// dead `rankLabels[rank] || …` fallback (rankLabels is total over the 7 ranks),
    /// but transcribed verbatim to keep optionFromId a 1:1 mirror.
    static let replacementCategoryLabels: [String: String] = [
        "priority": "优先",
        "acceptable": "可接受",
        "optional": "可选",
        "angle": "角度相近",
        "equipment_fallback": "器械不可用时",
        "equipment-fallback": "器械不可用时",
        "fatigue_reduction": "降低疲劳",
        "fatigue-reduction": "降低疲劳",
        "compound_fallback": "复合动作替代",
        "compound-fallback": "复合动作替代",
        "not_recommended": "不推荐",
        "not-recommended": "不推荐",
        "avoid": "不推荐",
    ]

    static func formatReplacementCategory(_ value: String) -> String {
        lookupLabel(value, replacementCategoryLabels)
    }

    /// `lookupLabel` (formatters.ts:35-60), string path only — the replacement
    /// engine only ever passes plain strings (a fatigueCost / a rank rawValue), so
    /// the legacy web schema object-handling branch is unreachable here and omitted.
    private static func lookupLabel(_ value: String, _ labels: [String: String], empty: String = "未知状态") -> String {
        if value.isEmpty { return empty }
        let normalized = normalizeDisplayKey(value)
        if let label = labels[normalized] { return label }
        if ExerciseLibrary.hasChineseText(value) { return value }
        return empty
    }

    /// `normalizeDisplayKey` (formatters.ts:27-33).
    private static func normalizeDisplayKey(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines)
        s = regexReplaceAll(s, "[（(].*?[)）]", "")
        s = regexReplaceAll(s, "([a-z])([A-Z])", "$1-$2")
        s = regexReplaceAll(s, "[_\\s]+", "-")
        return s.lowercased()
    }

    // MARK: Display + equipment helpers (replacementEngine.ts:55-118)

    /// `displayName` (replacementEngine.ts:55).
    static func displayName(_ id: String, bilingual: Bool = false) -> String {
        ExerciseLibrary.formatExerciseDisplayName(.string(id), bilingual: bilingual, fallback: "未命名动作")
    }

    /// `normalizeUnavailableEquipment` (replacementEngine.ts:69-70): de-dup,
    /// order-preserving. (Trim / drop-empty is moot once decoded to typed tags.)
    static func normalizeUnavailableEquipment(_ values: [ExerciseEquipmentTag]) -> [ExerciseEquipmentTag] {
        var seen = Set<ExerciseEquipmentTag>()
        var out: [ExerciseEquipmentTag] = []
        for value in values where !seen.contains(value) {
            seen.insert(value)
            out.append(value)
        }
        return out
    }

    /// `equipmentTagsFor` (replacementEngine.ts:72-76). The override `equipmentTags`
    /// term is always nil in current data, so this always uses the SR-1 library table.
    static func equipmentTagsFor(_ id: String) -> [ExerciseEquipmentTag] {
        if let metadataTags = ReplacementEngineKnowledge.knowledge[id]?.equipmentTags {
            return metadataTags
        }
        return ExerciseLibrary.equipmentTags[id] ?? []
    }

    /// `hardUnavailableTagsFor` (replacementEngine.ts:78-81).
    static func hardUnavailableTagsFor(_ id: String, _ unavailableEquipment: [ExerciseEquipmentTag]) -> [ExerciseEquipmentTag] {
        let tags = equipmentTagsFor(id)
        return unavailableEquipment.filter { $0 != .machine && tags.contains($0) }
    }

    /// `hasHardUnavailableEquipment` (replacementEngine.ts:112).
    static func hasHardUnavailableEquipment(_ id: String, _ unavailableEquipment: [ExerciseEquipmentTag]) -> Bool {
        !hardUnavailableTagsFor(id, unavailableEquipment).isEmpty
    }

    /// `equipmentAdjustedRankScore` (replacementEngine.ts:114-118).
    static func equipmentAdjustedRankScore(_ id: String, _ rank: ReplacementRank, _ unavailableEquipment: [ExerciseEquipmentTag]) -> Double {
        let tags = equipmentTagsFor(id)
        let weakMachinePenalty = (unavailableEquipment.contains(.machine) && tags.contains(.machine)) ? 0.35 : 0
        return Double(rankOrderValue(rank)) + weakMachinePenalty
    }

    /// `appendReasonNotes` (replacementEngine.ts:83-88).
    static func appendReasonNotes(_ reason: String, _ notes: [String]) -> String {
        var seen = Set<String>()
        var uniqueNotes: [String] = []
        for note in notes where !note.isEmpty {
            if !seen.contains(note) {
                seen.insert(note)
                uniqueNotes.append(note)
            }
        }
        if uniqueNotes.isEmpty { return reason }
        let suffix = uniqueNotes.joined(separator: "；")
        if reason.contains(suffix) { return reason }
        let separator = reason.hasSuffix("。") ? "" : "。"
        return "\(reason)\(separator)\(suffix)。"
    }

    /// `equipmentReasonNotes` (replacementEngine.ts:90-110).
    static func equipmentReasonNotes(_ id: String, _ unavailableEquipment: [ExerciseEquipmentTag]) -> [String] {
        if unavailableEquipment.isEmpty { return [] }
        let tags = equipmentTagsFor(id)
        var notes: [String] = []
        let hardUnavailable = hardUnavailableTagsFor(id, unavailableEquipment)

        if !hardUnavailable.isEmpty {
            notes.append("需要\(equipmentLabel(hardUnavailable[0]))，已降低排序")
            return notes
        }

        if unavailableEquipment.contains(.dumbbell) && !tags.contains(.dumbbell) { notes.append("避开哑铃区") }
        if unavailableEquipment.contains(.cable) && !tags.contains(.cable) { notes.append("不依赖绳索") }
        if (unavailableEquipment.contains(.rack) || unavailableEquipment.contains(.barbell)) && !tags.contains(.rack) && !tags.contains(.barbell) {
            notes.append("不需要深蹲架")
        }
        if (tags.contains(.machine) || tags.contains(.smith) || tags.contains(.plateLoaded)) && !unavailableEquipment.contains(.machine) {
            notes.append("可在固定器械区完成")
        }
        return notes
    }

    // MARK: Identity helpers (replacementEngine.ts:157-180)

    /// `baseExerciseId` (replacementEngine.ts:157-159).
    static func baseExerciseId(_ exercise: ReplacementExerciseInput) -> String {
        if let value = exercise.originalExerciseId, !value.isEmpty { return value }
        if let value = exercise.replacedFromId, !value.isEmpty { return value }
        if let value = exercise.baseId, !value.isEmpty { return value }
        // String(canonicalExerciseId || id).split('__alt_')[0]
        let chosen: String
        if let canonical = exercise.canonicalExerciseId, !canonical.isEmpty { chosen = canonical } else { chosen = exercise.id }
        return chosen.components(separatedBy: "__alt_")[0]
    }

    /// `canonicalIdForAliasFilter` (replacementEngine.ts:164).
    static func canonicalIdForAliasFilter(_ id: String) -> String {
        let zh = ExerciseLibrary.getExerciseNameEntry(id).zh
        return zh.isEmpty ? id : zh
    }

    /// `normalizeName` (replacementEngine.ts:166) — the `/[（）()\\s-]/g` char set is
    /// { （ ） ( ) \ s - }; removal is CASE-SENSITIVE and happens BEFORE lowercasing
    /// (so an uppercase 'S' survives the strip and only then becomes 's'). See the
    /// file-header faithfulness note.
    static func normalizeName(_ value: String) -> String {
        let strip: Set<Character> = ["（", "）", "(", ")", "\\", "s", "-"]
        return String(value.filter { !strip.contains($0) }).lowercased()
    }

    /// The `{ ids, names }` shape returned by `buildCurrentIdentitySet`.
    struct IdentitySet {
        let ids: Set<String>
        let names: Set<String>
    }

    /// `buildCurrentIdentitySet` (replacementEngine.ts:168-177).
    static func buildCurrentIdentitySet(_ exercise: ReplacementExerciseInput) -> IdentitySet {
        let rawIds: [String?] = [
            exercise.id, exercise.baseId, exercise.canonicalExerciseId, exercise.originalExerciseId,
            exercise.actualExerciseId, exercise.replacementExerciseId, exercise.replacedFromId,
        ]
        let ids = rawIds.compactMap { $0 }.filter { !$0.isEmpty }
        let names = ids.flatMap { id -> [String] in
            [canonicalIdForAliasFilter(id)] + (ExerciseLibrary.aliases[id] ?? [])
        }.map { normalizeName($0) }
        return IdentitySet(ids: Set(ids), names: Set(names))
    }

    /// `isSelfOrAlias` (replacementEngine.ts:179-180).
    static func isSelfOrAlias(_ id: String, _ identity: IdentitySet) -> Bool {
        if identity.ids.contains(id) { return true }
        if identity.names.contains(normalizeName(canonicalIdForAliasFilter(id))) { return true }
        return (ExerciseLibrary.aliases[id] ?? []).contains { identity.names.contains(normalizeName($0)) }
    }

    /// `optionFromId` (replacementEngine.ts:182-196).
    static func optionFromId(_ id: String, _ rank: ReplacementRank, _ reason: String) -> ReplacementOption? {
        guard validateReplacementExerciseId(id) else { return nil }
        // String(metadata?.fatigueCost || 'medium')
        let raw = ReplacementEngineKnowledge.knowledge[id]?.fatigueCost ?? ""
        let fatigueCost = raw.isEmpty ? "medium" : raw
        return ReplacementOption(
            id: id,
            name: displayName(id, bilingual: true),
            rank: rank,
            rankLabel: rankLabels[rank] ?? formatReplacementCategory(rank.rawValue),
            reason: reason,
            fatigueCost: fatigueCost,
            fatigueCostLabel: formatFatigueCost(fatigueCost),
            prIndependent: true
        )
    }

    /// `rankFromPriority` (replacementEngine.ts:198-211).
    static func rankFromPriority(_ value: String?, fallback: ReplacementRank) -> ReplacementRank? {
        if value == "not_recommended" || value == "avoid" { return nil }
        if let value, let rank = ReplacementRank(rawValue: value) { return rank }
        return fallback
    }

    /// `reasonForReplacement` (replacementEngine.ts:213-302). Verbatim transcription
    /// of the per-(sourceId, id) reason text, then the rank-based fallbacks, then the
    /// generic default.
    static func reasonForReplacement(_ sourceId: String, _ id: String, _ rank: ReplacementRank) -> String {
        if sourceId == "lat-pulldown" {
            if id == "assisted-pull-up" { return "同属垂直拉，动作目标接近；会按辅助引体向上独立记录 PR / e1RM。" }
            if id == "pull-up" { return "同属垂直拉，强度和技能要求更高；适合状态好时替代。" }
            if id == "single-arm-lat-pulldown" { return "同属垂直拉，但改为单侧角度，适合需要更细致控制背阔发力时使用。" }
            if id == "machine-row" || id == "seated-row" { return "这是器械不可用时可选的背部补量选择，不是一线垂直拉等价替代。" }
        }
        if sourceId == "seated-row" {
            if id == "chest-supported-row" { return "同属水平拉，胸托能降低躯干代偿，适合作为坐姿划船的一线替代。" }
            if id == "machine-row" { return "同属水平拉，轨迹稳定，适合作为坐姿划船的一线替代。" }
            if id == "one-arm-db-row" { return "同属水平拉，但改为单侧自由重量，需要更多稳定控制。" }
            if id == "barbell-row" { return "同属水平拉但疲劳和技术要求更高，适合作为可选替代，不是默认降阶。" }
        }
        if sourceId == "barbell-row" {
            if id == "chest-supported-row" { return "同属水平拉，胸托能降低腰背疲劳，同时保留背部主训练刺激。" }
            if id == "t-bar-row" { return "同属水平拉，负荷路径接近，适合作为杠铃划船的一线替代。" }
            if id == "one-arm-db-row" || id == "seated-row" { return "同属水平拉，但器械或单侧形式不同；会按实际动作独立记录。" }
            if id == "machine-row" { return "同属背部水平拉补量，稳定性更高，但不是完全等价的杠铃划船替代。" }
        }
        if sourceId == "face-pull" {
            if id == "reverse-pec-deck" { return "同样偏向肩后束和肩胛控制，适合替代面拉，不作为背部主训练替代。" }
            if id == "cable-rear-delt-fly" { return "同样偏向肩后束控制，适合替代面拉，不提高背部主训练量权重。" }
            if id == "lateral-raise" { return "这是肩部补量选择，方向不同，只作为可选替代。" }
        }
        if sourceId == "squat" {
            if id == "hack-squat" { return "同属深蹲链，轨迹更稳定，适合作为深蹲的一线替代。" }
            if id == "smith-squat" { return "同属深蹲链，轨迹固定，适合器械可用时替代深蹲，并按史密斯深蹲独立记录。" }
            if id == "leg-press" { return "同属深蹲模式的腿部主训练，但躯干和稳定要求不同，是可接受替代，不是完全等价。" }
            if id == "belt-squat" { return "同属深蹲模式，能减少脊柱负担，是可接受替代，不是完全等价。" }
            if id == "goblet-squat" { return "同属深蹲模式，但负荷上限较低，适合作为可选替代或技术保守方案。" }
        }
        if sourceId == "romanian-deadlift" {
            if id == "db-rdl" { return "同属髋铰链，负荷形式更灵活，适合作为 RDL 的一线替代。" }
            if id == "hip-thrust" { return "臀推更偏髋伸和臀腿后链，降低下背压力，但不是髋铰链完全等价。" }
            if id == "leg-curl" || id == "seated-leg-curl" || id == "lying-leg-curl" { return "这是腿后侧补量选择，不是髋铰链等价替代，会按实际动作独立记录。" }
        }
        if sourceId == "leg-curl" {
            if id == "seated-leg-curl" { return "同属膝屈链，适合作为腿弯举的一线替代。" }
            if id == "lying-leg-curl" { return "同属膝屈链，适合作为腿弯举的一线替代。" }
            if id == "nordic-curl" { return "同属膝屈链，但疲劳和技术要求更高，适合作为可接受替代。" }
            if id == "romanian-deadlift" { return "这是后链补量选择，不是腿弯举同模式优先替代。" }
        }
        if sourceId == "calf-raise" {
            if id == "seated-calf-raise" { return "同属跖屈链，适合作为提踵的一线替代。" }
            if id == "standing-calf-raise" { return "同属跖屈链，适合作为提踵的一线替代。" }
            if id == "leg-press-calf-raise" { return "同属跖屈链，器械角度不同，是可接受替代。" }
        }
        if sourceId == "shoulder-press" {
            if id == "machine-shoulder-press" { return "同属垂直推链，轨迹更稳定，适合作为哑铃肩推的一线替代。" }
            if id == "smith-shoulder-press" { return "同属垂直推链，轨迹固定，适合需要更稳定推举路径时替代。" }
            if id == "landmine-press" { return "地雷管推举是斜向推，肩部目标接近但不是垂直推完全等价替代。" }
            if id == "db-bench-press" { return "这是推类补量选择，角度偏水平推，不是肩推等价替代。" }
        }
        if sourceId == "lateral-raise" {
            if id == "cable-lateral-raise" { return "同属侧平举链，阻力曲线更连续，适合作为哑铃侧平举的一线替代。" }
            if id == "machine-lateral-raise" { return "同属侧平举链，轨迹更稳定，适合作为哑铃侧平举的一线替代。" }
            if id == "rear-delt-raise" { return "这是肩后束补量选择，动作方向不同，不作为侧平举主替代。" }
        }
        if sourceId == "db-curl" {
            if id == "ez-bar-curl" { return "同属二头弯举链，握距和器械不同，会按 EZ 杠弯举独立记录。" }
            if id == "preacher-curl" { return "同属二头弯举链，支撑更稳定，适合作为哑铃弯举的一线替代。" }
            if id == "cable-curl" { return "同属二头弯举链，张力更连续，适合作为哑铃弯举的一线替代。" }
            if id == "incline-db-curl" { return "同属二头训练，但肩位和拉伸重点不同，是可接受替代。" }
            if id == "hammer-curl" { return "锤式握法侧重点不同，只作为可选替代，不是完全等价二头弯举。" }
        }
        if sourceId == "hammer-curl" {
            if id == "rope-hammer-curl" { return "同属锤式弯举链，握法和侧重点接近，适合作为一线替代。" }
            if id == "db-curl" { return "哑铃弯举可接受，但握法和侧重点不同，不是锤式弯举完全等价替代。" }
            if id == "ez-bar-curl" { return "这是二头弯举补量选择，握法不同，只作为可选替代。" }
        }
        if sourceId == "triceps-pushdown" {
            if id == "straight-bar-pushdown" { return "同属三头下压模式，手柄不同，适合作为绳索下压的一线替代。" }
            if id == "overhead-cable-triceps-extension" { return "同属三头伸展训练，但手臂位置不同，是可接受替代。" }
            if id == "skull-crusher" { return "同属三头伸展训练，器械和关节压力不同，只作为可选替代。" }
            if id == "close-grip-bench" || id == "assisted-dip" { return "复合动作替代，疲劳成本更高，不是完全等价替代；复合推类替代，疲劳成本更高，不是孤立下压等价替代。" }
        }
        if sourceId == "bench-press" {
            if id == "db-bench-press" { return "同为水平推，胸部刺激接近，器械占用时适合直接替代卧推。" }
            if id == "machine-chest-press" { return "同为水平推，轨迹更稳定，适合在卧推架不可用或需要降低技术压力时替代。" }
            if id == "push-up" { return "同为水平推，适合器械受限或短时训练，但负荷精度低于卧推。" }
            if id == "incline-db-press" { return "同属胸部推举，但角度偏上胸，适合作为较低优先级替代。" }
        }
        if rank == .angle { return "同属相近动作链，但角度或刺激重点不同，适合作为较低优先级替代。" }
        if rank == .acceptable { return "动作模式接近但不完全等价，会按实际动作独立记录。" }
        if rank == .equipmentFallback { return "器械不可用时可选，不代表与原动作完全等价。" }
        if rank == .fatigueReduction { return "降低疲劳压力，会按实际动作独立记录。" }
        if rank == .compoundFallback { return "复合动作替代，疲劳成本更高，不是完全等价替代。" }
        if rank == .optional { return "这是可选替代，适合特殊器械或疲劳限制场景，不代表完全等价。" }
        return "同一动作链内的替代动作，会保留本次模板位置，并按实际动作独立统计 PR / e1RM。"
    }

    // MARK: - Public functions (the SR-2 ports)

    /// `isSyntheticReplacementExerciseId` (replacementEngine.ts:120) —
    /// `/__(?:auto_)?alt(?:_|$)/.test(String(id || ''))`. Unanchored search.
    public static func isSyntheticReplacementExerciseId(_ id: String?) -> Bool {
        let value = id ?? ""
        return regexTest(value, "__(?:auto_)?alt(?:_|$)")
    }

    /// `validateReplacementExerciseId` (replacementEngine.ts:122-126).
    public static func validateReplacementExerciseId(_ id: String?) -> Bool {
        let value = (id ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty || isSyntheticReplacementExerciseId(value) { return false }
        return ExerciseLibrary.displayNames[value] != nil || ReplacementEngineKnowledge.knowledge[value] != nil
    }

    /// `buildReplacementOptions` (replacementEngine.ts:304-353).
    public static func buildReplacementOptions(_ exercise: ReplacementExerciseInput, context: ReplacementContext = ReplacementContext()) -> [ReplacementOption] {
        let sourceId = baseExerciseId(exercise)
        let identity = buildCurrentIdentitySet(exercise)
        let metadata = ReplacementEngineKnowledge.knowledge[sourceId]
        let unavailableEquipment = normalizeUnavailableEquipment(context.unavailableEquipment)

        // Object.values(EXERCISE_EQUIVALENCE_CHAINS).find(item => item.id === metadata.equivalenceChainId || item.members.includes(sourceId))
        let chainId = metadata?.equivalenceChainId
        let chain = ReplacementEngineKnowledge.equivalenceChainEntries.first(where: { element in
            (chainId.map { element.value.id == $0 } ?? false) || element.value.members.contains(sourceId)
        })?.value

        let explicitAlternativeIds = (metadata?.alternativeIds ?? exercise.alternativeIds ?? []).filter { !$0.isEmpty }
        let priorityMap = metadata?.alternativePriorities ?? exercise.alternativePriorities ?? [:]

        let candidateIds: [String]
        if !explicitAlternativeIds.isEmpty {
            candidateIds = explicitAlternativeIds
        } else {
            let regression = metadata?.regressionIds ?? []
            let members = (chain?.members ?? []).filter { $0 != sourceId }
            let progression = metadata?.progressionIds ?? []
            candidateIds = regression + members + progression
        }

        // Array.from(new Set(candidateIds)).filter(...) — de-dup by id (first wins),
        // then the predicate with its accumulating seenNames side-effect.
        var seenCandidates = Set<String>()
        var seenNames = Set<String>()
        var uniqueIds: [String] = []
        for id in candidateIds {
            if seenCandidates.contains(id) { continue }
            seenCandidates.insert(id)
            if id == sourceId { continue }
            if sourceId == "bench-press" && forbiddenBenchReplacementIds.contains(id) { continue }
            if isSelfOrAlias(id, identity) { continue }
            if priorityMap[id] == "not_recommended" || priorityMap[id] == "avoid" { continue }
            let nameKey = normalizeName(canonicalIdForAliasFilter(id))
            if seenNames.contains(nameKey) { continue }
            seenNames.insert(nameKey)
            uniqueIds.append(id)
        }

        // .map((id, index) => …).filter(Boolean) — `index` is the uniqueIds index
        // (a null does NOT shift later items' fallback decision).
        var rankedOptions: [ReplacementOption] = []
        for (index, id) in uniqueIds.enumerated() {
            let fallback: ReplacementRank = index <= 1 ? .priority : .optional
            guard let rank = rankFromPriority(priorityMap[id], fallback: fallback) else { continue }
            guard let option = optionFromId(id, rank, reasonForReplacement(sourceId, id, rank)) else { continue }
            rankedOptions.append(option)
        }
        // .sort((l, r) => rankOrder[l] - rankOrder[r]) — STABLE: tie-break on pre-sort index.
        let sortedOptions = rankedOptions.enumerated()
            .sorted { lhs, rhs in
                let lo = rankOrderValue(lhs.element.rank)
                let ro = rankOrderValue(rhs.element.rank)
                if lo != ro { return lo < ro }
                return lhs.offset < rhs.offset
            }
            .map { $0.element }

        if unavailableEquipment.isEmpty { return sortedOptions }

        // Equipment pass: rewrite reason, capture sort index, re-sort by
        // (hardUnavailable, adjustedRankScore, capturedIndex), then drop the index.
        let withNotes: [(option: ReplacementOption, equipmentSortIndex: Int)] = sortedOptions.enumerated().map { index, option in
            (option.withReason(appendReasonNotes(option.reason, equipmentReasonNotes(option.id, unavailableEquipment))), index)
        }
        return withNotes
            .sorted { lhs, rhs in
                let lHard = hasHardUnavailableEquipment(lhs.option.id, unavailableEquipment) ? 1 : 0
                let rHard = hasHardUnavailableEquipment(rhs.option.id, unavailableEquipment) ? 1 : 0
                if lHard != rHard { return lHard < rHard }
                let lScore = equipmentAdjustedRankScore(lhs.option.id, lhs.option.rank, unavailableEquipment)
                let rScore = equipmentAdjustedRankScore(rhs.option.id, rhs.option.rank, unavailableEquipment)
                if lScore != rScore { return lScore < rScore }
                return lhs.equipmentSortIndex < rhs.equipmentSortIndex
            }
            .map { $0.option }
    }

    // MARK: - Regex helpers

    /// `RegExp.test` equivalent — true iff `pattern` matches anywhere in `input`.
    private static func regexTest(_ input: String, _ pattern: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return false }
        let range = NSRange(input.startIndex..<input.endIndex, in: input)
        return regex.firstMatch(in: input, options: [], range: range) != nil
    }

    /// `String.replace(/.../g, template)` equivalent.
    private static func regexReplaceAll(_ input: String, _ pattern: String, _ replacement: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return input }
        let range = NSRange(input.startIndex..<input.endIndex, in: input)
        return regex.stringByReplacingMatches(in: input, options: [], range: range, withTemplate: replacement)
    }
}
