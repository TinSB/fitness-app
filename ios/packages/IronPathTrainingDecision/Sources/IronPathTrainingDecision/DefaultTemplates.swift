// PA-S3 — default training templates + makeExercise data port (pure data, read-only).
//
// Faithful 1:1 Swift transcription of:
//   src/data/exerciseLibrary.ts:1500  makeExercise  -> DefaultTrainingData.makeExercise
//   src/data/defaultTemplates.ts:9     INITIAL_TEMPLATES -> DefaultTrainingData.initialTemplates
//
// `makeExercise` REUSES the already-ported knowledge entries — it does NOT
// re-port the override / legacy-mapping tables:
//   • `override.alternativeIds` / `override.alternativePriorities` come from
//     `ReplacementEngineKnowledge.knowledge[id]` (SR-2 — the engine-used subset
//     of EXERCISE_KNOWLEDGE_OVERRIDES, reconciled item-by-item).
//   • `mapLegacyAlternativeLabelsToIds(alternatives).ids` comes from the
//     already-ported `ExerciseLibrary.mapLegacyAlternativeLabelsToIds` (SR-1).
//   • The `Array.from(new Set([...override, ...legacy])).filter(!= id)` dedup is
//     reproduced by an ORDER-PRESERVING manual unique (first occurrence wins) +
//     a self-id filter — NOT an unordered Set (which would lose TS order).
//
// `ACTIVE_DEFAULT_TEMPLATE_SCHEMA_VERSION` (defaultTemplates.ts:7) is NOT ported:
// it reads `STORAGE_VERSION` (appConfig.ts) and is consumed by neither
// INITIAL_TEMPLATES nor DEFAULT_PROGRAM_TEMPLATE — out of this slice's scope.
//
// Reconciled against the generated `default-program-data/snapshot-v1` parity
// golden (DefaultProgramDataParityTests) — any dropped/altered template,
// exercise, or makeExercise field fails that test.
//
// Pure data: no runtime logic beyond the makeExercise transform, no write path,
// no `: Date`, no clock.

import Foundation
import IronPathDomain

public enum DefaultTrainingData {

    // MARK: - makeExercise (exerciseLibrary.ts:1500-1533)

    /// Builds one `ExerciseTemplate` from the template-author shorthand,
    /// deriving `alternativeIds` / `alternativePriorities` from the already-ported
    /// knowledge tables. Mirrors the TS `makeExercise` algorithm exactly.
    ///
    /// `startWeight` is taken as `Double` and collapsed to an integer NumberRepr
    /// when whole — reproducing JS's single number type, where `JSON.stringify(60)`
    /// is `"60"` and `JSON.stringify(22.5)` is `"22.5"`.
    public static func makeExercise(
        _ id: String,
        _ name: String,
        _ alias: String,
        _ muscle: String,
        _ kind: String,
        _ sets: Int,
        _ repMin: Int,
        _ repMax: Int,
        _ rest: Int,
        _ startWeight: Double,
        _ alternatives: [String] = []
    ) -> ExerciseTemplate {
        // const override = EXERCISE_KNOWLEDGE_OVERRIDES[id] || {};  (reused via SR-2)
        let override = ReplacementEngineKnowledge.knowledge[id]
        // const legacyAlternativeIds = mapLegacyAlternativeLabelsToIds(alternatives).ids;  (reused via SR-1)
        let legacyAlternativeIds = ExerciseLibrary.mapLegacyAlternativeLabelsToIds(alternatives).ids
        // const overrideAlternativeIds = Array.isArray(override.alternativeIds) ? override.alternativeIds : [];
        let overrideAlternativeIds = override?.alternativeIds ?? []
        // const alternativeIds = Array.from(new Set([...overrideAlternativeIds, ...legacyAlternativeIds])).filter(cid => cid !== id);
        let alternativeIds = orderPreservingUnique(overrideAlternativeIds + legacyAlternativeIds).filter { $0 != id }
        // const alternativePriorities = override.alternativePriorities as Record<...> | undefined;
        let alternativePriorities: JSONValue? = override?.alternativePriorities.map { priorities in
            .object(OrderedJSONObject(entries: priorities.map { .init(key: $0.key, value: .string($0.value)) }))
        }
        return ExerciseTemplate(
            id: id,
            name: name,
            alias: alias,
            muscle: muscle,
            kind: kind,
            sets: .integer(Int64(sets)),
            repMin: .integer(Int64(repMin)),
            repMax: .integer(Int64(repMax)),
            rest: .integer(Int64(rest)),
            startWeight: jsNumber(startWeight),
            alternatives: alternatives,
            alternativeIds: alternativeIds,
            alternativePriorities: alternativePriorities
        )
    }

    // MARK: - INITIAL_TEMPLATES (defaultTemplates.ts:9-126)

    public static let initialTemplates: [TrainingTemplate] = [
        // defaultTemplates.ts:10
        TrainingTemplate(
            id: "push-a",
            name: "推 A",
            focus: "推",
            duration: .integer(70),
            note: "胸、肩、肱三头优先，卧推排在第一位，辅助动作服务肌肥大总量。",
            exercises: [
                makeExercise("bench-press", "平板卧推", "卧推", "胸", "compound", 3, 6, 8, 180, 60, ["器械推胸", "哑铃卧推"]),
                makeExercise("incline-db-press", "上斜哑铃卧推", "上斜哑铃", "胸", "compound", 3, 8, 10, 120, 22.5, ["上斜器械推胸"]),
                makeExercise("machine-chest-press", "器械推胸", "胸推机", "胸", "machine", 2, 8, 12, 120, 55, ["双杠臂屈伸"]),
                makeExercise("cable-fly", "绳索夹胸", "夹胸", "胸", "isolation", 2, 12, 15, 75, 17.5, ["蝴蝶机夹胸"]),
                makeExercise("lateral-raise", "哑铃侧平举", "侧平举", "肩", "isolation", 4, 12, 20, 60, 7.5, ["绳索侧平举"]),
                makeExercise("triceps-pushdown", "绳索下压", "三头下压", "手臂", "isolation", 3, 10, 15, 75, 25, ["窄握卧推"]),
            ]
        ),
        // defaultTemplates.ts:25
        TrainingTemplate(
            id: "pull-a",
            name: "拉 A",
            focus: "拉",
            duration: .integer(70),
            note: "背阔和中背优先，最后补手臂；肩胛控制差时保留面拉。",
            exercises: [
                makeExercise("lat-pulldown", "高位下拉", "下拉", "背", "compound", 3, 8, 10, 120, 55, ["引体向上", "单臂下拉"]),
                makeExercise("seated-row", "坐姿划船", "划船机", "背", "compound", 3, 8, 12, 120, 50, ["胸托划船", "单臂哑铃划船"]),
                makeExercise("barbell-row", "杠铃划船", "杠铃划船", "背", "compound", 3, 6, 10, 150, 50, ["T 杠划船"]),
                makeExercise("face-pull", "面拉", "面拉", "肩", "isolation", 3, 12, 20, 60, 20, ["反向飞鸟"]),
                makeExercise("db-curl", "哑铃弯举", "二头弯举", "手臂", "isolation", 3, 8, 12, 75, 12.5, ["杠铃弯举"]),
                makeExercise("hammer-curl", "锤式弯举", "锤式弯举", "手臂", "isolation", 2, 10, 15, 75, 12.5, ["绳索锤式弯举"]),
            ]
        ),
        // defaultTemplates.ts:40
        TrainingTemplate(
            id: "legs-a",
            name: "腿 A",
            focus: "腿",
            duration: .integer(80),
            note: "先做深蹲模式，再做髋铰链和腿后侧；训练量高时优先保证动作质量。",
            exercises: [
                makeExercise("squat", "深蹲", "深蹲", "腿", "compound", 4, 5, 8, 210, 80, ["哈克深蹲", "腿举"]),
                makeExercise("romanian-deadlift", "罗马尼亚硬拉", "RDL", "腿", "compound", 3, 6, 10, 180, 70, ["哑铃 RDL"]),
                makeExercise("leg-press", "腿举", "腿举", "腿", "machine", 3, 10, 15, 120, 140, ["高脚位腿举"]),
                makeExercise("leg-curl", "腿弯举", "腿弯举", "腿", "isolation", 3, 10, 15, 75, 40, ["北欧腿弯举"]),
                makeExercise("calf-raise", "提踵", "提踵", "腿", "isolation", 4, 10, 20, 60, 50, ["坐姿提踵"]),
            ]
        ),
        // defaultTemplates.ts:54
        TrainingTemplate(
            id: "upper",
            name: "上肢",
            focus: "上肢",
            duration: .integer(70),
            note: "上肢综合模板，适合时间有限但仍要保留推、拉和肩部刺激的日子。",
            exercises: [
                makeExercise("db-bench-press", "哑铃卧推", "哑铃卧推", "胸", "compound", 3, 6, 10, 150, 30, ["器械推胸"]),
                makeExercise("lat-pulldown", "高位下拉", "下拉", "背", "compound", 3, 8, 10, 120, 55, ["引体向上"]),
                makeExercise("shoulder-press", "哑铃肩推", "肩推", "肩", "compound", 3, 6, 10, 120, 20, ["器械肩推"]),
                makeExercise("one-arm-db-row", "单臂哑铃划船", "单臂划船", "背", "compound", 3, 8, 12, 90, 26, ["胸托划船"]),
                makeExercise("lateral-raise", "哑铃侧平举", "侧平举", "肩", "isolation", 3, 12, 20, 60, 7.5, ["绳索侧平举"]),
                makeExercise("triceps-pushdown", "绳索下压", "三头下压", "手臂", "isolation", 2, 10, 15, 60, 25, ["窄握卧推"]),
                makeExercise("db-curl", "哑铃弯举", "弯举", "手臂", "isolation", 2, 10, 15, 60, 12.5, ["牧师凳弯举"]),
            ]
        ),
        // defaultTemplates.ts:70
        TrainingTemplate(
            id: "lower",
            name: "下肢",
            focus: "下肢",
            duration: .integer(70),
            note: "下肢综合模板，优先腿推和髋铰链，适合恢复压力较高时使用。",
            exercises: [
                makeExercise("hack-squat", "哈克深蹲", "哈克深蹲", "腿", "compound", 3, 6, 10, 150, 80, ["深蹲", "腿举"]),
                makeExercise("db-rdl", "哑铃罗马尼亚硬拉", "哑铃 RDL", "腿", "compound", 3, 8, 12, 120, 30, ["罗马尼亚硬拉"]),
                makeExercise("leg-press", "腿举", "腿举", "腿", "machine", 3, 10, 15, 120, 140, ["高脚位腿举"]),
                makeExercise("leg-curl", "腿弯举", "腿弯举", "腿", "isolation", 3, 10, 15, 75, 35, ["北欧腿弯举"]),
                makeExercise("calf-raise", "提踵", "提踵", "腿", "isolation", 4, 12, 20, 60, 45, ["坐姿提踵"]),
            ]
        ),
        // defaultTemplates.ts:84
        TrainingTemplate(
            id: "arms",
            name: "手臂 + 三角肌",
            focus: "手臂",
            duration: .integer(45),
            note: "补手臂和侧束，主打低疲劳、高完成度，不抢下一次主训练恢复。",
            exercises: [
                makeExercise("close-grip-bench", "窄握卧推", "窄握卧推", "手臂", "compound", 3, 6, 8, 120, 50, ["绳索下压"]),
                makeExercise("preacher-curl", "牧师凳弯举", "牧师凳弯举", "手臂", "isolation", 3, 8, 12, 60, 25, ["哑铃弯举"]),
                makeExercise("triceps-pushdown", "绳索下压", "下压", "手臂", "isolation", 3, 10, 15, 60, 25, ["过顶臂屈伸"]),
                makeExercise("hammer-curl", "锤式弯举", "锤式弯举", "手臂", "isolation", 3, 10, 15, 60, 12.5, ["绳索锤式弯举"]),
                makeExercise("lateral-raise", "哑铃侧平举", "侧平举", "肩", "isolation", 4, 12, 20, 60, 7.5, ["绳索侧平举"]),
            ]
        ),
        // defaultTemplates.ts:98
        TrainingTemplate(
            id: "quick-30",
            name: "快练 30",
            focus: "快练",
            duration: .integer(30),
            note: "只有 30 分钟时使用，保留主线动作和最低有效剂量。",
            exercises: [
                makeExercise("bench-press", "平板卧推", "卧推", "胸", "compound", 2, 5, 8, 150, 60, ["器械推胸"]),
                makeExercise("lat-pulldown", "高位下拉", "下拉", "背", "compound", 2, 8, 10, 90, 55, ["引体向上"]),
                makeExercise("hack-squat", "哈克深蹲", "哈克深蹲", "腿", "compound", 2, 8, 12, 120, 80, ["腿举"]),
                makeExercise("lateral-raise", "哑铃侧平举", "侧平举", "肩", "isolation", 2, 12, 20, 45, 7.5, ["绳索侧平举"]),
            ]
        ),
        // defaultTemplates.ts:111
        TrainingTemplate(
            id: "crowded-gym",
            name: "人多替代",
            focus: "替代",
            duration: .integer(55),
            note: "健身房拥挤时使用，优先选择器械和单站点组合，保持训练刺激但减少等待。",
            exercises: [
                makeExercise("machine-chest-press", "器械推胸", "胸推机", "胸", "machine", 3, 8, 12, 90, 55, ["哑铃卧推"]),
                makeExercise("lat-pulldown", "高位下拉", "下拉", "背", "compound", 3, 8, 12, 90, 50, ["单臂下拉"]),
                makeExercise("leg-press", "腿举", "腿举", "腿", "machine", 3, 10, 15, 90, 140, ["高脚位腿举"]),
                makeExercise("cable-fly", "绳索夹胸", "夹胸", "胸", "isolation", 2, 12, 15, 60, 17.5, ["蝴蝶机夹胸"]),
                makeExercise("triceps-pushdown", "绳索下压", "下压", "手臂", "isolation", 2, 10, 15, 60, 25, ["绳索过顶臂屈伸"]),
                makeExercise("hammer-curl", "绳索锤式弯举", "锤式弯举", "手臂", "isolation", 2, 10, 15, 60, 15, ["哑铃弯举"]),
            ]
        ),
    ]

    // MARK: - Private helpers

    /// Order-preserving dedup (first occurrence wins) — the JS
    /// `Array.from(new Set(values))` insertion-order semantics. A bare Swift
    /// `Set` would lose order, so this is done manually.
    static func orderPreservingUnique(_ values: [String]) -> [String] {
        var seen: Set<String> = []
        var out: [String] = []
        for v in values where !seen.contains(v) {
            seen.insert(v)
            out.append(v)
        }
        return out
    }

    /// JS number collapse: a whole-valued Double emits as an integer
    /// (`JSON.stringify(60)` → `"60"`), a fractional one stays decimal
    /// (`JSON.stringify(22.5)` → `"22.5"`).
    static func jsNumber(_ value: Double) -> NumberRepr {
        if value.isFinite, value.truncatingRemainder(dividingBy: 1) == 0,
           value >= Double(Int64.min), value <= Double(Int64.max) {
            return .integer(Int64(value))
        }
        return .double(value)
    }
}
