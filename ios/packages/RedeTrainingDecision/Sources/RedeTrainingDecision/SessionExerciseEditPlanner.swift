// SessionExerciseEditPlanner — FR-TR14 S2 临时加动作的会话内目标生成。
//
// 只消费 clean sessions + 今天已经生成的 SessionSetPlan + catalog facts；
// 不修改今日处方。reps/RIR/rest 与 rep range 全走 owner 裁定的“借值链”；起始重量直接用
// 今日处方的同一套规则（`TodayPrescriptionEngine.sessionEditStartLoadKg`，单一真源）。
// 生成一次完整 payload 后随 TrainFlowEvent 落 draft，恢复只重放，不再查询可能变化的历史。

import RedeDataHealth

public enum SessionExerciseEditPlanner {
    public static let adHocSetCount = 3

    public static func availableExercises(
        sessionPlan: SessionSetPlan,
        catalog: ExerciseCatalog = .minimal,
        allowedEquipment: Set<String>? = nil
    ) -> [ExerciseCatalogEntry] {
        let scheduled = Set(sessionPlan.exercises.map(\.exerciseId))
        return catalog.entries
            .filter {
                !$0.deprecated
                    && EquipmentRegistry.prescribableLoadTypes.contains($0.loadType)
                    && !scheduled.contains($0.id)
                    && (allowedEquipment == nil || allowedEquipment!.contains($0.equipment))
            }
            .sorted { ($0.primaryMuscle, $0.rank, $0.id) < ($1.primaryMuscle, $1.rank, $1.id) }
    }

    public static func makeAdHocPlan(
        exerciseId: String,
        sessionPlan: SessionSetPlan,
        currentExerciseIndex: Int,
        sessions: [CleanTrainingSession],
        catalog: ExerciseCatalog = .minimal,
        allowedEquipment: Set<String>? = nil,
        loadUnit: LoadUnit = .kg,
        trainingLevel: String?,
        todayISO: String
    ) -> ExerciseSetPlan? {
        guard sessionPlan.exercises.indices.contains(currentExerciseIndex),
              let entry = availableExercises(
                sessionPlan: sessionPlan,
                catalog: catalog,
                allowedEquipment: allowedEquipment
              ).first(where: { $0.id == exerciseId }),
              let borrowed = borrowedTargets(
                for: entry,
                sessionPlan: sessionPlan,
                currentExerciseIndex: currentExerciseIndex,
                catalog: catalog
              )
        else { return nil }

        let stepKg = loadStep(for: entry, unit: loadUnit)
        let targetWeightKg = TodayPrescriptionEngine.sessionEditStartLoadKg(
            entry: entry, sessions: sessions, todayISO: todayISO, trainingLevel: trainingLevel, unit: loadUnit,
            repMin: borrowed.repLowerBound)
        let sets = (1...adHocSetCount).map {
            PlannedSet(
                index: $0,
                targetWeightKg: targetWeightKg,
                targetReps: borrowed.targetReps,
                targetRir: borrowed.targetRir
            )
        }
        return ExerciseSetPlan(
            exerciseId: exerciseId,
            restSeconds: borrowed.restSeconds,
            repLowerBound: borrowed.repLowerBound,
            repUpperBound: borrowed.repUpperBound,
            stepKg: stepKg,
            loadType: entry.loadType,
            sets: sets
        )
    }

    /// 会话中途「换进来」的动作的起始负重：与临时加动作同一规则。换动作事件建立时解析一次、
    /// 随事件落草稿（2026-10-18）。repLowerBound：换进来后沿用的次数下限。目录里没有 → nil。
    public static func startingLoadKg(
        exerciseId: String,
        sessions: [CleanTrainingSession],
        catalog: ExerciseCatalog = .minimal,
        loadUnit: LoadUnit = .kg,
        trainingLevel: String?,
        todayISO: String,
        repLowerBound: Int
    ) -> Double? {
        guard let entry = catalog.entry(id: exerciseId) else { return nil }
        return TodayPrescriptionEngine.sessionEditStartLoadKg(
            entry: entry, sessions: sessions, todayISO: todayISO, trainingLevel: trainingLevel, unit: loadUnit,
            repMin: repLowerBound)
    }

    private struct BorrowedTargets {
        let targetReps: Int
        let targetRir: Double
        let restSeconds: Int
        let repLowerBound: Int
        let repUpperBound: Int
    }

    /// Owner 裁定的确定性借值链：
    /// 1) 队列第一个同主肌群 donor；
    /// 2) targetReps 众数（平票小）+ 第一个命中 donor 的完整区间，
    ///    rest 众数（平票大），RIR 当前动作；
    /// 3) 理论兜底当前动作。所有值均来自今天引擎真实输出，零发明。
    private static func borrowedTargets(
        for entry: ExerciseCatalogEntry,
        sessionPlan: SessionSetPlan,
        currentExerciseIndex: Int,
        catalog: ExerciseCatalog
    ) -> BorrowedTargets? {
        let current = sessionPlan.exercises[currentExerciseIndex]
        guard let currentSet = current.sets.first else { return nil }

        if let sameMuscle = sessionPlan.exercises.first(where: { plan in
            catalog.entry(id: plan.exerciseId)?.primaryMuscle == entry.primaryMuscle
                && plan.sets.first != nil
        }), let donorSet = sameMuscle.sets.first {
            return BorrowedTargets(
                targetReps: donorSet.targetReps,
                targetRir: donorSet.targetRir,
                restSeconds: sameMuscle.restSeconds,
                repLowerBound: sameMuscle.repLowerBound,
                repUpperBound: sameMuscle.repUpperBound
            )
        }

        let plansWithTargets = sessionPlan.exercises.filter { !$0.sets.isEmpty }
        let repsMode = conservativeMode(plansWithTargets.compactMap { $0.sets.first?.targetReps })
        let restMode = generousMode(plansWithTargets.map(\.restSeconds))
        if let repsMode,
           let restMode,
           let rangeDonor = plansWithTargets.first(where: { $0.sets.first?.targetReps == repsMode }) {
            return BorrowedTargets(
                targetReps: repsMode,
                targetRir: currentSet.targetRir,
                restSeconds: restMode,
                repLowerBound: rangeDonor.repLowerBound,
                repUpperBound: rangeDonor.repUpperBound
            )
        }

        return BorrowedTargets(
            targetReps: currentSet.targetReps,
            targetRir: currentSet.targetRir,
            restSeconds: current.restSeconds,
            repLowerBound: current.repLowerBound,
            repUpperBound: current.repUpperBound
        )
    }

    private static func conservativeMode(_ values: [Int]) -> Int? {
        modeCandidates(values).min()
    }

    private static func generousMode(_ values: [Int]) -> Int? {
        modeCandidates(values).max()
    }

    private static func modeCandidates(_ values: [Int]) -> [Int] {
        guard !values.isEmpty else { return [] }
        let counts = Dictionary(grouping: values, by: { $0 }).mapValues(\.count)
        guard let maximum = counts.values.max() else { return [] }
        return counts.compactMap { $0.value == maximum ? $0.key : nil }
    }

    private static func loadStep(for entry: ExerciseCatalogEntry, unit: LoadUnit) -> Double {
        if entry.loadType == "bodyweight-plus" {
            return LoadGrid.addedLoadStepKg(unit: unit)
        }
        return LoadGrid.stepKg(equipment: entry.equipment, unit: unit)
    }
}
