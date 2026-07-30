// SessionExerciseEditPlanner — FR-TR14 S2 临时加动作的会话内目标生成。
//
// 只消费 clean sessions + 今天已经生成的 SessionSetPlan + catalog facts；
// 不调用、不修改 TodayPrescriptionEngine。reps/RIR/rest 与 rep range 全走 owner
// 裁定的“借值链”，重量只走历史 → 目录保守起步。生成一次完整 payload 后随
// TrainFlowEvent 落 draft，恢复只重放，不再查询可能变化的历史。

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
        loadUnit: LoadUnit = .kg
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
        let targetWeightKg = latestWorkingWeight(exerciseId: exerciseId, sessions: sessions)
            ?? conservativeStartWeight(entry: entry, stepKg: stepKg)
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

    /// 与 TodayPrescriptionEngine.lastPerformance 同口径：最近 civil day；同日按
    /// canonical append 顺序取最后；该场工作组取最高重量。
    private static func latestWorkingWeight(
        exerciseId: String,
        sessions: [CleanTrainingSession]
    ) -> Double? {
        let candidates = sessions.enumerated().compactMap {
            canonicalOffset, session -> (day: Int, canonicalOffset: Int, weights: [Double])? in
            guard let day = TrainingDay.dayNumber(fromISO: session.date) else { return nil }
            let weights = session.exercises
                .filter { $0.exerciseId == exerciseId }
                .flatMap(\.sets)
                .map(\.weight)
            guard !weights.isEmpty else { return nil }
            return (day, canonicalOffset, weights)
        }
        return candidates.max(by: {
            $0.day == $1.day
                ? $0.canonicalOffset < $1.canonicalOffset
                : $0.day < $1.day
        })?.weights.max()
    }

    private static func loadStep(for entry: ExerciseCatalogEntry, unit: LoadUnit) -> Double {
        if entry.loadType == "bodyweight-plus" {
            return LoadGrid.addedLoadStepKg(unit: unit)
        }
        return LoadGrid.stepKg(equipment: entry.equipment, unit: unit)
    }

    /// 无历史时复用 replace 的保守重置语义：自重/弹力带归 0；其余按真实
    /// LoadGrid 对齐 startWeightKg，并以下一可用档位作下限。
    private static func conservativeStartWeight(
        entry: ExerciseCatalogEntry,
        stepKg: Double
    ) -> Double {
        if entry.loadType == "bodyweight" || entry.loadType == "band" { return 0 }
        guard stepKg > 0 else { return max(0, entry.startWeightKg) }
        return max(stepKg, (entry.startWeightKg / stepKg).rounded() * stepKg)
    }
}
