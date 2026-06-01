// SR-1 — Exercise Library data port (data + pure resolve/format functions).
//
// Faithful Swift transcription of the FOUR frozen library tables and the pure
// parsing functions in src/data/exerciseLibrary.ts. This is DATA + PURE
// FUNCTIONS only — it ports NO replacement-engine logic (EXERCISE_EQUIVALENCE_CHAINS
// / EXERCISE_KNOWLEDGE_OVERRIDES values / buildSmartReplacementRecommendations are
// SR-2/SR-3). No IO, no clock, no `: Date`, deterministic.
//
//   exerciseLibrary.ts:3    ExerciseName            -> struct ExerciseName
//   exerciseLibrary.ts:9    ExerciseEquipmentTag    -> enum ExerciseEquipmentTag
//   exerciseLibrary.ts:20   EXERCISE_DISPLAY_NAMES  -> displayNameEntries / displayNames
//   exerciseLibrary.ts:117  EXERCISE_EQUIPMENT_TAGS -> equipmentTagEntries / equipmentTags
//   exerciseLibrary.ts:181  EXERCISE_ENGLISH_NAMES  -> englishNameEntries / englishNames
//   exerciseLibrary.ts:247  EXERCISE_ALIASES        -> aliasEntries / aliases
//   exerciseLibrary.ts:317  getExerciseNameEntry    -> getExerciseNameEntry
//   exerciseLibrary.ts:323  formatExerciseDisplayName -> formatExerciseDisplayName
//   exerciseLibrary.ts:374  normalizeExerciseReference -> normalizeExerciseReference
//   exerciseLibrary.ts:381  resolveExerciseReferenceToId -> resolveExerciseReferenceToId
//   exerciseLibrary.ts:398  mapLegacyAlternativeLabelsToIds -> mapLegacyAlternativeLabelsToIds
//
// Every table entry is reconciled item-by-item against the generated
// `exercise-library/library-snapshot-v1` parity golden (ExerciseLibraryParityTests)
// — nothing can be dropped or altered in transcription without that test failing.

import Foundation
import IronPathDomain

/// `ExerciseEquipmentTag` — mirrors the TS string-literal union
/// (exerciseLibrary.ts:9-18). Raw values match the TS literals; `plate-loaded`
/// is the only non-1:1 Swift case name.
public enum ExerciseEquipmentTag: String, Equatable, Sendable, CaseIterable {
    case dumbbell
    case barbell
    case smith
    case cable
    case machine
    case bodyweight
    case bench
    case rack
    case plateLoaded = "plate-loaded"
}

/// `ExerciseName` — mirrors the TS type (exerciseLibrary.ts:3-7).
public struct ExerciseName: Equatable, Sendable {
    public let zh: String
    public let en: String?
    public let aliases: [String]?

    public init(zh: String, en: String? = nil, aliases: [String]? = nil) {
        self.zh = zh
        self.en = en
        self.aliases = aliases
    }
}

/// The exercise library: the four frozen lookup tables + the pure resolve/format
/// helpers. A namespace enum (no instances); all members are `static`.
public enum ExerciseLibrary {
    // MARK: - Tables (ORDERED — TS insertion order preserved)
    //
    // `resolveExerciseReferenceToId` returns the FIRST id whose normalized id /
    // label / alias matches, iterating in declaration order — and the TS data has
    // genuine collisions (e.g. `face-pull` & `face_pull` both normalize to
    // `facepull`/`面拉`; `landmine-press` & `landmine_press` both to
    // `landminepress`/`地雷管推举`). A Swift `Dictionary` is unordered, so the
    // ORDERED `KeyValuePairs` below are the source of truth for resolve(); the
    // O(1) dictionaries are derived from them for direct lookups.

    /// EXERCISE_DISPLAY_NAMES (exerciseLibrary.ts:20-115) — 94 entries.
    public static let displayNameEntries: KeyValuePairs<String, String> = [
        "bench-press": "平板卧推",
        "db-bench-press": "哑铃卧推",
        "incline-db-press": "上斜哑铃卧推",
        "smith-incline-press": "史密斯上斜卧推",
        "machine-incline-chest-press": "上斜器械推胸",
        "machine-chest-press": "器械推胸",
        "cable-fly": "绳索夹胸",
        "pec-deck-fly": "蝴蝶机夹胸",
        "db-fly": "哑铃飞鸟",
        "lateral-raise": "哑铃侧平举",
        "triceps-pushdown": "绳索下压",
        "close-grip-bench": "窄握卧推",
        "lat-pulldown": "高位下拉",
        "single-arm-lat-pulldown": "单臂高位下拉",
        "seated-row": "坐姿划船",
        "machine-row": "器械划船",
        "chest-supported-row": "胸托划船",
        "barbell-row": "杠铃划船",
        "t-bar-row": "T 杠划船",
        "one-arm-db-row": "单臂哑铃划船",
        "face-pull": "面拉",
        "reverse-pec-deck": "反向飞鸟",
        "cable-rear-delt-fly": "绳索后束飞鸟",
        "db-curl": "哑铃弯举",
        "hammer-curl": "锤式弯举",
        "preacher-curl": "牧师凳弯举",
        "squat": "深蹲",
        "hack-squat": "哈克深蹲",
        "smith-squat": "史密斯深蹲",
        "goblet-squat": "高脚杯深蹲",
        "leg-press": "腿举",
        "belt-squat": "腰带深蹲",
        "romanian-deadlift": "罗马尼亚硬拉",
        "db-rdl": "哑铃罗马尼亚硬拉",
        "leg-curl": "腿弯举",
        "seated-leg-curl": "坐姿腿弯举",
        "lying-leg-curl": "俯卧腿弯举",
        "nordic-curl": "北欧腿弯举",
        "calf-raise": "提踵",
        "seated-calf-raise": "坐姿提踵",
        "standing-calf-raise": "站姿提踵",
        "leg-press-calf-raise": "腿举机提踵",
        "shoulder-press": "哑铃肩推",
        "machine-shoulder-press": "器械肩推",
        "smith-shoulder-press": "史密斯肩推",
        "cable-lateral-raise": "绳索侧平举",
        "machine-lateral-raise": "器械侧平举",
        "rear-delt-raise": "俯身后束飞鸟",
        "ez-bar-curl": "EZ 杠弯举",
        "cable-curl": "绳索弯举",
        "incline-db-curl": "上斜哑铃弯举",
        "rope-hammer-curl": "绳索锤式弯举",
        "straight-bar-pushdown": "直杆下压",
        "overhead-cable-triceps-extension": "绳索过顶臂屈伸",
        "skull-crusher": "仰卧臂屈伸",
        "assisted-dip": "辅助双杠臂屈伸",
        "push-up": "俯卧撑",
        "pull-up": "引体向上",
        "assisted-pull-up": "辅助引体向上",
        "deadlift": "硬拉",
        "hip-thrust": "臀推",
        "leg-extension": "腿屈伸",
        "landmine-press": "地雷管推举",
        "thoracic_extension_foam": "泡沫轴胸椎伸展",
        "wall_slide": "墙滑",
        "serratus_wall_slide": "前锯肌墙滑",
        "face_pull": "面拉",
        "chin_tuck": "收下巴",
        "band_pull_apart": "弹力带拉开",
        "scap_pushup": "肩胛俯卧撑",
        "dead_bug": "死虫",
        "dead_bug_exhale": "呼气死虫",
        "breathing_90_90": "90/90 呼吸",
        "side_plank": "侧桥",
        "mini_band_walk": "弹力带侧走",
        "monster_walk": "怪兽走",
        "single_leg_glute_bridge": "单腿臀桥",
        "hip_90_90_switch": "90/90 髋转换",
        "couch_stretch": "沙发拉伸",
        "side_lying_hip_abduction": "侧卧髋外展",
        "knee_to_wall": "膝触墙",
        "soleus_raise": "屈膝提踵",
        "deep_squat_hold": "深蹲底部停留",
        "goblet_squat_pattern": "杯式深蹲模式重建",
        "open_book": "开书式",
        "quadruped_thoracic_rotation": "四点跪胸椎旋转",
        "pallof_press": "帕洛夫抗旋推",
        "single_arm_carry": "单臂农夫走",
        "single_leg_rdl": "单腿 RDL",
        "split_squat_iso": "分腿蹲等长停留",
        "farmer_carry": "农夫走",
        "bottom_up_press": "倒置壶铃推举",
        "landmine_press": "地雷管推举",
        "waiter_carry": "服务员行走",
    ]

    /// EXERCISE_EQUIPMENT_TAGS (exerciseLibrary.ts:117-179) — 61 entries.
    /// Array order is meaningful and preserved verbatim.
    public static let equipmentTagEntries: KeyValuePairs<String, [ExerciseEquipmentTag]> = [
        "bench-press": [.barbell, .bench, .rack],
        "db-bench-press": [.dumbbell, .bench],
        "incline-db-press": [.dumbbell, .bench],
        "smith-incline-press": [.smith, .machine, .bench],
        "machine-incline-chest-press": [.machine],
        "machine-chest-press": [.machine],
        "cable-fly": [.cable],
        "pec-deck-fly": [.machine],
        "db-fly": [.dumbbell, .bench],
        "push-up": [.bodyweight],
        "close-grip-bench": [.barbell, .bench, .rack],
        "assisted-dip": [.bodyweight, .machine],
        "lat-pulldown": [.cable, .machine],
        "single-arm-lat-pulldown": [.cable, .machine],
        "pull-up": [.bodyweight],
        "assisted-pull-up": [.bodyweight, .machine],
        "seated-row": [.cable, .machine],
        "machine-row": [.machine],
        "chest-supported-row": [.machine],
        "barbell-row": [.barbell],
        "t-bar-row": [.barbell, .plateLoaded],
        "one-arm-db-row": [.dumbbell, .bench],
        "face-pull": [.cable],
        "reverse-pec-deck": [.machine],
        "cable-rear-delt-fly": [.cable],
        "rear-delt-raise": [.dumbbell],
        "squat": [.barbell, .rack],
        "hack-squat": [.machine, .plateLoaded],
        "smith-squat": [.smith, .machine],
        "leg-press": [.machine, .plateLoaded],
        "belt-squat": [.machine],
        "goblet-squat": [.dumbbell],
        "romanian-deadlift": [.barbell],
        "db-rdl": [.dumbbell],
        "hip-thrust": [.barbell, .bench],
        "leg-curl": [.machine],
        "seated-leg-curl": [.machine],
        "lying-leg-curl": [.machine],
        "nordic-curl": [.bodyweight],
        "calf-raise": [.machine],
        "seated-calf-raise": [.machine],
        "standing-calf-raise": [.machine],
        "leg-press-calf-raise": [.machine, .plateLoaded],
        "shoulder-press": [.dumbbell],
        "machine-shoulder-press": [.machine],
        "smith-shoulder-press": [.smith, .machine],
        "landmine-press": [.barbell, .plateLoaded],
        "lateral-raise": [.dumbbell],
        "cable-lateral-raise": [.cable],
        "machine-lateral-raise": [.machine],
        "db-curl": [.dumbbell],
        "ez-bar-curl": [.barbell],
        "preacher-curl": [.machine],
        "cable-curl": [.cable],
        "incline-db-curl": [.dumbbell, .bench],
        "hammer-curl": [.dumbbell],
        "rope-hammer-curl": [.cable],
        "triceps-pushdown": [.cable],
        "straight-bar-pushdown": [.cable],
        "overhead-cable-triceps-extension": [.cable],
        "skull-crusher": [.barbell, .bench],
    ]

    /// EXERCISE_ENGLISH_NAMES (exerciseLibrary.ts:181-245) — 63 entries.
    public static let englishNameEntries: KeyValuePairs<String, String> = [
        "bench-press": "Barbell Bench Press",
        "db-bench-press": "Dumbbell Bench Press",
        "incline-db-press": "Incline Dumbbell Press",
        "smith-incline-press": "Smith Machine Incline Press",
        "machine-incline-chest-press": "Machine Incline Chest Press",
        "machine-chest-press": "Machine Chest Press",
        "cable-fly": "Cable Fly",
        "pec-deck-fly": "Pec Deck Fly",
        "db-fly": "Dumbbell Fly",
        "lateral-raise": "Dumbbell Lateral Raise",
        "triceps-pushdown": "Triceps Pushdown",
        "close-grip-bench": "Close-Grip Bench Press",
        "lat-pulldown": "Lat Pulldown",
        "single-arm-lat-pulldown": "Single-Arm Lat Pulldown",
        "seated-row": "Seated Row",
        "machine-row": "Machine Row",
        "chest-supported-row": "Chest-Supported Row",
        "barbell-row": "Barbell Row",
        "t-bar-row": "T-Bar Row",
        "one-arm-db-row": "One-Arm Dumbbell Row",
        "face-pull": "Face Pull",
        "reverse-pec-deck": "Reverse Pec Deck",
        "cable-rear-delt-fly": "Cable Rear Delt Fly",
        "db-curl": "Dumbbell Curl",
        "hammer-curl": "Hammer Curl",
        "preacher-curl": "Preacher Curl",
        "squat": "Back Squat",
        "hack-squat": "Hack Squat",
        "smith-squat": "Smith Machine Squat",
        "goblet-squat": "Goblet Squat",
        "leg-press": "Leg Press",
        "belt-squat": "Belt Squat",
        "romanian-deadlift": "Romanian Deadlift",
        "db-rdl": "Dumbbell Romanian Deadlift",
        "leg-curl": "Leg Curl",
        "seated-leg-curl": "Seated Leg Curl",
        "lying-leg-curl": "Lying Leg Curl",
        "nordic-curl": "Nordic Curl",
        "calf-raise": "Calf Raise",
        "seated-calf-raise": "Seated Calf Raise",
        "standing-calf-raise": "Standing Calf Raise",
        "leg-press-calf-raise": "Leg Press Calf Raise",
        "shoulder-press": "Dumbbell Shoulder Press",
        "machine-shoulder-press": "Machine Shoulder Press",
        "smith-shoulder-press": "Smith Machine Shoulder Press",
        "cable-lateral-raise": "Cable Lateral Raise",
        "machine-lateral-raise": "Machine Lateral Raise",
        "rear-delt-raise": "Bent-Over Rear Delt Raise",
        "ez-bar-curl": "EZ-Bar Curl",
        "cable-curl": "Cable Curl",
        "incline-db-curl": "Incline Dumbbell Curl",
        "rope-hammer-curl": "Rope Hammer Curl",
        "straight-bar-pushdown": "Straight-Bar Pushdown",
        "overhead-cable-triceps-extension": "Overhead Cable Triceps Extension",
        "skull-crusher": "Skull Crusher",
        "assisted-dip": "Assisted Dip",
        "push-up": "Push-Up",
        "pull-up": "Pull-Up",
        "assisted-pull-up": "Assisted Pull-Up",
        "deadlift": "Deadlift",
        "hip-thrust": "Hip Thrust",
        "leg-extension": "Leg Extension",
        "landmine-press": "Landmine Press",
    ]

    /// EXERCISE_ALIASES (exerciseLibrary.ts:247-307) — 59 entries.
    /// Array order is meaningful and preserved verbatim.
    public static let aliasEntries: KeyValuePairs<String, [String]> = [
        "bench-press": ["卧推", "平板杠铃卧推", "Barbell Bench Press"],
        "db-bench-press": ["平板哑铃卧推", "Dumbbell Bench Press"],
        "machine-chest-press": ["胸推机", "坐姿胸推机", "Machine Chest Press"],
        "incline-db-press": ["上斜哑铃推胸", "Incline Dumbbell Press"],
        "smith-incline-press": ["史密斯上斜推", "史密斯上斜卧推", "Smith Machine Incline Press"],
        "machine-incline-chest-press": ["上斜胸推机", "上斜器械推胸", "Machine Incline Chest Press"],
        "cable-fly": ["绳索夹胸", "绳索飞鸟", "Cable Fly"],
        "pec-deck-fly": ["蝴蝶机夹胸", "夹胸机", "Pec Deck Fly"],
        "db-fly": ["哑铃飞鸟", "Dumbbell Fly"],
        "lateral-raise": ["侧平举", "哑铃侧平举", "Dumbbell Lateral Raise"],
        "triceps-pushdown": ["三头下压", "下压", "绳索下压", "Triceps Pushdown"],
        "close-grip-bench": ["窄握卧推", "Close-Grip Bench Press"],
        "lat-pulldown": ["下拉", "高位下拉", "Lat Pulldown"],
        "single-arm-lat-pulldown": ["单臂下拉", "单臂高位下拉", "Single-Arm Lat Pulldown"],
        "pull-up": ["引体向上", "Pull-Up"],
        "assisted-pull-up": ["辅助引体向上", "Assisted Pull-Up"],
        "seated-row": ["坐姿划船", "坐姿划船器", "Seated Row"],
        "machine-row": ["器械划船", "固定器械划船", "Machine Row"],
        "chest-supported-row": ["胸托划船", "胸垫划船", "Chest-Supported Row"],
        "barbell-row": ["杠铃划船", "Barbell Row"],
        "t-bar-row": ["T杠划船", "T 杠划船", "T-Bar Row"],
        "one-arm-db-row": ["单臂哑铃划船", "单臂划船", "One-Arm Dumbbell Row"],
        "face-pull": ["面拉", "绳索面拉", "Face Pull"],
        "reverse-pec-deck": ["反向飞鸟", "反向飞鸟机", "Reverse Pec Deck"],
        "cable-rear-delt-fly": ["绳索后束飞鸟", "Cable Rear Delt Fly"],
        "db-curl": ["二头弯举", "弯举", "哑铃弯举", "Dumbbell Curl"],
        "hammer-curl": ["锤式弯举", "Hammer Curl"],
        "preacher-curl": ["牧师凳弯举", "牧师弯举", "Preacher Curl"],
        "squat": ["深蹲", "Back Squat"],
        "hack-squat": ["哈克深蹲", "Hack Squat"],
        "smith-squat": ["史密斯蹲", "史密斯深蹲", "Smith Machine Squat"],
        "goblet-squat": ["杯式深蹲", "壶铃深蹲", "高脚杯深蹲", "Goblet Squat"],
        "leg-press": ["腿举", "高脚位腿举", "Leg Press"],
        "belt-squat": ["腰带蹲", "腰带深蹲", "Belt Squat"],
        "romanian-deadlift": ["RDL", "罗马尼亚硬拉", "Romanian Deadlift"],
        "db-rdl": ["哑铃 RDL", "哑铃罗马尼亚硬拉", "Dumbbell Romanian Deadlift"],
        "leg-curl": ["腿弯举", "Leg Curl"],
        "seated-leg-curl": ["坐姿腿弯举", "Seated Leg Curl"],
        "lying-leg-curl": ["俯卧腿弯举", "Lying Leg Curl"],
        "nordic-curl": ["北欧腿弯举", "北欧弯举", "Nordic Curl"],
        "calf-raise": ["提踵", "Calf Raise"],
        "seated-calf-raise": ["坐姿提踵", "Seated Calf Raise"],
        "standing-calf-raise": ["站姿提踵", "Standing Calf Raise"],
        "leg-press-calf-raise": ["腿举提踵", "腿举机提踵", "Leg Press Calf Raise"],
        "shoulder-press": ["肩推", "哑铃肩推", "Dumbbell Shoulder Press"],
        "machine-shoulder-press": ["器械肩推", "肩推机", "Machine Shoulder Press"],
        "smith-shoulder-press": ["史密斯肩推", "史密斯推举", "Smith Machine Shoulder Press"],
        "landmine-press": ["地雷管推举", "地雷管肩推", "Landmine Press"],
        "cable-lateral-raise": ["绳索侧平举", "Cable Lateral Raise"],
        "machine-lateral-raise": ["器械侧平举", "侧平举机", "Machine Lateral Raise"],
        "rear-delt-raise": ["俯身后束飞鸟", "Bent-Over Rear Delt Raise"],
        "ez-bar-curl": ["EZ 杠弯举", "曲杆弯举", "EZ-Bar Curl"],
        "cable-curl": ["绳索弯举", "绳索二头弯举", "Cable Curl"],
        "incline-db-curl": ["上斜哑铃弯举", "上斜弯举", "Incline Dumbbell Curl"],
        "rope-hammer-curl": ["绳索锤式弯举", "绳索锤弯", "Rope Hammer Curl"],
        "straight-bar-pushdown": ["直杆下压", "直杆三头下压", "Straight-Bar Pushdown"],
        "overhead-cable-triceps-extension": ["绳索过顶臂屈伸", "过顶三头伸展", "Overhead Cable Triceps Extension"],
        "skull-crusher": ["仰卧臂屈伸", "碎颅者", "Skull Crusher"],
        "assisted-dip": ["辅助双杠臂屈伸", "辅助臂屈伸", "Assisted Dip"],
    ]

    /// The KEY SET of EXERCISE_KNOWLEDGE_OVERRIDES (exerciseLibrary.ts:485) — keys
    /// ONLY. `resolveExerciseReferenceToId` uses it as a known-id fast-path term
    /// (`EXERCISE_KNOWLEDGE_OVERRIDES[raw]` truthy ⇔ raw is a key). The override
    /// VALUES are the engine knowledge base (orderPriority / contraindications /
    /// alternativeIds / …) — NOT ported here; that is SR-2/SR-3. 63 ids (every one
    /// is also an EXERCISE_DISPLAY_NAMES key, so this term is currently redundant,
    /// but it is transcribed verbatim to keep resolve() byte-faithful to TS and to
    /// fail the parity test if a future TS override id ever stops being a display id).
    public static let knowledgeOverrideIds: Set<String> = [
        "assisted-dip", "assisted-pull-up", "barbell-row", "belt-squat", "bench-press",
        "cable-curl", "cable-fly", "cable-lateral-raise", "cable-rear-delt-fly", "calf-raise",
        "chest-supported-row", "close-grip-bench", "db-bench-press", "db-curl", "db-fly",
        "db-rdl", "deadlift", "ez-bar-curl", "face-pull", "goblet-squat", "hack-squat",
        "hammer-curl", "hip-thrust", "incline-db-curl", "incline-db-press", "landmine-press",
        "lat-pulldown", "lateral-raise", "leg-curl", "leg-extension", "leg-press",
        "leg-press-calf-raise", "lying-leg-curl", "machine-chest-press",
        "machine-incline-chest-press", "machine-lateral-raise", "machine-row",
        "machine-shoulder-press", "nordic-curl", "one-arm-db-row",
        "overhead-cable-triceps-extension", "pec-deck-fly", "preacher-curl", "pull-up",
        "push-up", "rear-delt-raise", "reverse-pec-deck", "romanian-deadlift",
        "rope-hammer-curl", "seated-calf-raise", "seated-leg-curl", "seated-row",
        "shoulder-press", "single-arm-lat-pulldown", "skull-crusher", "smith-incline-press",
        "smith-shoulder-press", "smith-squat", "squat", "standing-calf-raise",
        "straight-bar-pushdown", "t-bar-row", "triceps-pushdown",
    ]

    // MARK: - Derived O(1) lookups (built from the ordered tables)

    public static let displayNames: [String: String] = makeDictionary(displayNameEntries)
    public static let englishNames: [String: String] = makeDictionary(englishNameEntries)
    public static let equipmentTags: [String: [ExerciseEquipmentTag]] = makeDictionary(equipmentTagEntries)
    public static let aliases: [String: [String]] = makeDictionary(aliasEntries)

    private static func makeDictionary<V>(_ pairs: KeyValuePairs<String, V>) -> [String: V] {
        var dict = [String: V](minimumCapacity: pairs.count)
        for (key, value) in pairs { dict[key] = value }
        return dict
    }

    // MARK: - Pure functions

    /// `getExerciseNameEntry` (exerciseLibrary.ts:317-321).
    public static func getExerciseNameEntry(_ id: String) -> ExerciseName {
        ExerciseName(
            zh: displayNames[id] ?? "",
            en: englishNames[id],
            aliases: aliases[id]
        )
    }

    /// `hasChineseText` (exerciseLibrary.ts:309) — true iff the String carries any
    /// CJK ideograph in U+3400…U+9FFF. Non-strings (here: `nil`) are false.
    static func hasChineseText(_ value: String?) -> Bool {
        guard let value else { return false }
        return value.unicodeScalars.contains { $0.value >= 0x3400 && $0.value <= 0x9fff }
    }

    /// `formatExerciseDisplayName` (exerciseLibrary.ts:323-372). `value` mirrors TS
    /// `unknown`: a `.string` (an id or an already-Chinese label) or a `.object`
    /// carrying id / name / alias fields. `warnMissingChineseName` is a DEV-only
    /// `console.warn` (exerciseLibrary.ts:311) with no functional output — a no-op here.
    public static func formatExerciseDisplayName(
        _ value: JSONValue,
        bilingual: Bool = false,
        fallback: String? = nil
    ) -> String {
        let fallbackText = (fallback.map { $0.isEmpty } == false ? fallback : nil) ?? "未命名动作"

        // typeof value === 'string' && hasChineseText(value) -> return value
        if case .string(let s) = value, hasChineseText(s) { return s }

        // id = string value, or the first truthy id field of an object, else ''
        let id: String
        switch value {
        case .string(let s):
            id = s
        case .object(let obj):
            id = firstNonEmptyString(obj, [
                "actualExerciseId", "replacementExerciseId", "canonicalExerciseId", "id",
            ])
        default:
            id = ""
        }

        if !id.isEmpty {
            let entry = getExerciseNameEntry(id)
            if !entry.zh.isEmpty {
                if bilingual, let en = entry.en, !en.isEmpty { return "\(entry.zh)（\(en)）" }
                return entry.zh
            }
        }

        if case .object(let obj) = value {
            let rawName = obj.rawValue("name") ?? JSONValue.null
            // nameZh = value.nameZh (string) || value.name.zh (string) || ''
            let nameZh: String
            if let s = obj.rawValue("nameZh")?.stringValue {
                nameZh = s
            } else if case .object(let nameObj) = rawName, let zh = nameObj.rawValue("zh")?.stringValue {
                nameZh = zh
            } else {
                nameZh = ""
            }

            let aliasString = obj.rawValue("alias")?.stringValue
            // name = value.name when it is a string, else ''
            let name: String = {
                if case .string(let s) = rawName { return s }
                return ""
            }()

            // zh = nameZh || (hasChineseText(alias) ? alias : '') || (hasChineseText(name) ? name : '')
            let aliasZh = hasChineseText(aliasString) ? (aliasString ?? "") : ""
            let nameZhFromName = hasChineseText(name) ? name : ""
            let zh = !nameZh.isEmpty ? nameZh : (!aliasZh.isEmpty ? aliasZh : nameZhFromName)

            // en = value.nameEn (string) || value.name.en (string) || (!hasChineseText(name) ? name : undefined)
            let en: String?
            if let s = obj.rawValue("nameEn")?.stringValue {
                en = s
            } else if case .object(let nameObj) = rawName, let e = nameObj.rawValue("en")?.stringValue {
                en = e
            } else if !hasChineseText(name) {
                en = name
            } else {
                en = nil
            }

            if !zh.isEmpty {
                if bilingual, let en, !en.isEmpty, en != zh { return "\(zh)（\(en)）" }
                return zh
            }
            // if (en) warnMissingChineseName(id || en) — DEV-only warn, no-op.
        }

        // if (id) warnMissingChineseName(id) — DEV-only warn, no-op.
        return fallbackText
    }

    /// `normalizeExerciseReference` (exerciseLibrary.ts:374-379): trim → lowercase →
    /// strip any parenthetical (full/half-width) → strip whitespace + separator
    /// punctuation. Pure string transform.
    static func normalizeExerciseReference(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        s = regexReplaceAll(s, pattern: "[（(].*?[)）]", with: "")
        s = regexReplaceAll(s, pattern: "[\\s_\\-·,，。:：;；/\\\\|]+", with: "")
        return s
    }

    /// `resolveExerciseReferenceToId` (exerciseLibrary.ts:381-396). Returns the
    /// canonical id for a raw reference (id / display / english / alias), or `nil`.
    /// Iterates in TS declaration order so the FIRST match wins exactly as TS does.
    public static func resolveExerciseReferenceToId(_ value: String) -> String? {
        let raw = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return nil }
        // Known-id fast path: raw is itself a display / english / override-knowledge key.
        if displayNames[raw] != nil || englishNames[raw] != nil || knowledgeOverrideIds.contains(raw) {
            return raw
        }
        let normalized = normalizeExerciseReference(raw)
        for (id, label) in displayNameEntries {
            if normalizeExerciseReference(id) == normalized || normalizeExerciseReference(label) == normalized {
                return id
            }
        }
        for (id, label) in englishNameEntries {
            if normalizeExerciseReference(label) == normalized { return id }
        }
        for (id, aliasList) in aliasEntries {
            if aliasList.contains(where: { normalizeExerciseReference($0) == normalized }) { return id }
        }
        return nil
    }

    /// `mapLegacyAlternativeLabelsToIds` (exerciseLibrary.ts:398-410). Resolves a list
    /// of legacy alternative labels to canonical ids (deduped, order-preserving),
    /// collecting a Chinese warning for every label that fails to map.
    public struct LegacyAlternativeMapping: Equatable, Sendable {
        public let ids: [String]
        public let warnings: [String]
    }

    public static func mapLegacyAlternativeLabelsToIds(_ alternatives: [String] = []) -> LegacyAlternativeMapping {
        var warnings: [String] = []
        var ids: [String] = []
        for label in alternatives {
            if let id = resolveExerciseReferenceToId(label) {
                if !ids.contains(id) { ids.append(id) }
                continue
            }
            warnings.append("替代动作「\(label)」无法映射到动作库 ID，已从可选替代列表跳过。")
        }
        return LegacyAlternativeMapping(ids: ids, warnings: warnings)
    }

    // MARK: - Private helpers

    /// First field (in the given key order) whose value is a non-empty String —
    /// mirrors the TS `a || b || c || '' ` truthy-chain over string id fields.
    private static func firstNonEmptyString(_ obj: OrderedJSONObject, _ keys: [String]) -> String {
        for key in keys {
            if let s = obj.rawValue(key)?.stringValue, !s.isEmpty { return s }
        }
        return ""
    }

    /// Replace every match of `pattern` in `input` with `replacement` (mirrors a TS
    /// `String.replace(/.../g, …)`).
    private static func regexReplaceAll(_ input: String, pattern: String, with replacement: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return input }
        let range = NSRange(input.startIndex..<input.endIndex, in: input)
        return regex.stringByReplacingMatches(in: input, options: [], range: range, withTemplate: replacement)
    }
}
