// TrainFlowState — 专注训练流状态机（M3-2，纯值类型 reducer）。
//
// app 层只持有它（@Observable 包装）+ 跑休息计时器与渲染；全部状态转移在
// 这里发生且有测试。负重决策不在本层——下一组目标来自 NextSetEngine
// （Hold 开启时回计划值=「暂停引擎微调」，跨组延续、不跨动作）。
// 跳过/替换/疼痛是 typed 留痕事实，M3-3 随完成写入经唯一写闸落盘。
// 无 IO/clock：休息倒计时的「时间流逝」由 app 层驱动，这里只存计划秒数。

public struct TrainFlowState: Equatable, Sendable {
    public enum Phase: Equatable, Sendable {
        case activeSet
        case resting
        case confirmEnd
        case summary
    }

    public struct SkippedSet: Equatable, Sendable {
        public let exerciseId: String
        public let setIndex: Int
        public let reason: SetSkipReason
    }

    public struct SkippedExercise: Equatable, Sendable {
        public let exerciseId: String
        public let reason: SetSkipReason
    }

    public struct Replacement: Equatable, Sendable {
        public let originalExerciseId: String
        public let actualExerciseId: String
    }

    public struct Progress: Equatable, Sendable {
        public let exerciseNumber: Int
        public let exerciseTotal: Int
        public let setNumber: Int
        public let setTotal: Int
    }

    public let prescription: TodayPrescription
    public private(set) var plan: SessionSetPlan
    public private(set) var phase: Phase = .activeSet
    public private(set) var exerciseIndex: Int = 0
    /// 当前动作已完成组（跨动作推进时清空；汇总用 observationsByExercise）。
    public private(set) var completedInCurrentExercise: [CompletedSetObservation] = []
    public private(set) var observationsByExercise: [String: [CompletedSetObservation]] = [:]
    public private(set) var skippedSets: [SkippedSet] = []
    public private(set) var skippedExercises: [SkippedExercise] = []
    public private(set) var replacements: [Replacement] = []
    public private(set) var endReason: SessionEndReason?
    /// Hold = 暂停引擎微调、按计划值；跨组延续、不跨动作。
    public private(set) var isHolding: Bool = false
    /// 当前组的疼痛预登记（打勾时并入 observation）。
    public private(set) var painReportedForCurrentSet: Bool = false
    /// 当前动作内被跳过的组数（指针 = 完成数 + 跳过数）。
    public private(set) var skippedInCurrentExercise: Int = 0

    private var phaseBeforeConfirm: Phase = .activeSet
    private let catalog: ExerciseCatalog

    public init(prescription: TodayPrescription, catalog: ExerciseCatalog = .minimal) {
        self.prescription = prescription
        self.plan = SessionSetPlanner.expand(prescription)
        self.catalog = catalog
    }

    // MARK: - 派生

    public var currentExercise: ExerciseSetPlan? {
        plan.exercises.indices.contains(exerciseIndex) ? plan.exercises[exerciseIndex] : nil
    }

    public var currentRecommendation: NextSetRecommendation? {
        guard let exercise = effectiveCurrentExercise else { return nil }
        return NextSetEngine.recommend(plan: exercise, completed: completedInCurrentExercise)
    }

    /// 跳过的组从计划头部移除后的有效计划（推荐与完成判定都以它为准）。
    private var effectiveCurrentExercise: ExerciseSetPlan? {
        guard let exercise = currentExercise else { return nil }
        guard skippedInCurrentExercise > 0 else { return exercise }
        return ExerciseSetPlan(
            exerciseId: exercise.exerciseId,
            restSeconds: exercise.restSeconds,
            repLowerBound: exercise.repLowerBound,
            repUpperBound: exercise.repUpperBound,
            sets: Array(exercise.sets.dropFirst(skippedInCurrentExercise))
        )
    }

    private var currentExerciseIsDone: Bool {
        guard let exercise = currentExercise else { return true }
        return completedInCurrentExercise.count + skippedInCurrentExercise >= exercise.sets.count
    }

    /// 当前组目标重量：Hold 开启 → 计划值；否则引擎建议。
    public var currentTargetWeightKg: Double? {
        guard let exercise = currentExercise, !exercise.sets.isEmpty else { return nil }
        let pointer = completedInCurrentExercise.count + skippedInCurrentExercise
        let plannedIndex = min(pointer, exercise.sets.count - 1)
        let planned = exercise.sets[plannedIndex].targetWeightKg
        if isHolding { return planned }
        return currentRecommendation?.targetWeightKg ?? planned
    }

    public var restSecondsPlanned: Int { currentExercise?.restSeconds ?? 0 }

    public var progress: Progress {
        Progress(
            exerciseNumber: min(exerciseIndex + 1, plan.exercises.count),
            exerciseTotal: plan.exercises.count,
            setNumber: min(completedInCurrentExercise.count + skippedInCurrentExercise + 1, currentExercise?.sets.count ?? 1),
            setTotal: currentExercise?.sets.count ?? 0
        )
    }

    /// 替换候选：同替代族，排除当日全部已排动作。
    public var replacementCandidates: [String] {
        guard let exercise = currentExercise else { return [] }
        return ExerciseReplacementEngine.candidates(
            for: exercise.exerciseId,
            catalog: catalog,
            excluding: Set(plan.exercises.map(\.exerciseId))
        )
    }

    // MARK: - 事件

    public mutating func logSet(_ observation: CompletedSetObservation) {
        guard phase == .activeSet, let exercise = currentExercise else { return }
        let merged = painReportedForCurrentSet
            ? CompletedSetObservation(
                weightKg: observation.weightKg, reps: observation.reps,
                rir: observation.rir, painReported: true
              )
            : observation
        completedInCurrentExercise.append(merged)
        observationsByExercise[exercise.exerciseId, default: []].append(merged)
        painReportedForCurrentSet = false

        if currentExerciseIsDone {
            if exerciseIndex >= plan.exercises.count - 1 {
                finishSession(reason: .completedAll) // 最后动作最后一组：直接小结（原型口径）
            } else {
                phase = .resting // 动作间休息后推进
            }
        } else {
            phase = .resting
        }
    }

    public mutating func restFinished() {
        guard phase == .resting else { return }
        if currentExerciseIsDone {
            advanceExercise()
        }
        phase = .activeSet
    }

    public mutating func skipSet(reason: SetSkipReason) {
        guard phase == .activeSet, let exercise = currentExercise else { return }
        let setIndex = completedInCurrentExercise.count + skippedInCurrentExercise + 1
        skippedSets.append(SkippedSet(exerciseId: exercise.exerciseId, setIndex: setIndex, reason: reason))
        skippedInCurrentExercise += 1
        // 跳过不计完成、不休息，指针直接越过当前组。
        if currentExerciseIsDone {
            if exerciseIndex >= plan.exercises.count - 1 {
                finishSession(reason: .completedAll)
            } else {
                advanceExercise()
            }
        }
    }

    public mutating func skipExercise(reason: SetSkipReason) {
        guard phase == .activeSet, let exercise = currentExercise else { return }
        skippedExercises.append(SkippedExercise(exerciseId: exercise.exerciseId, reason: reason))
        if exerciseIndex >= plan.exercises.count - 1 {
            finishSession(reason: .completedAll)
        } else {
            advanceExercise()
        }
    }

    public mutating func replaceCurrentExercise(with newExerciseId: String) {
        guard phase == .activeSet, let exercise = currentExercise,
              replacementCandidates.contains(newExerciseId) else { return }
        replacements.append(Replacement(originalExerciseId: exercise.exerciseId, actualExerciseId: newExerciseId))
        var exercises = plan.exercises
        exercises[exerciseIndex] = ExerciseSetPlan(
            exerciseId: newExerciseId,
            restSeconds: exercise.restSeconds,
            repLowerBound: exercise.repLowerBound,
            repUpperBound: exercise.repUpperBound,
            sets: exercise.sets
        )
        plan = SessionSetPlan(dayCode: plan.dayCode, exercises: exercises)
    }

    public mutating func toggleHold() {
        guard phase == .activeSet || phase == .resting else { return }
        isHolding.toggle()
    }

    public mutating func reportPain() {
        guard phase == .activeSet else { return }
        painReportedForCurrentSet = true
    }

    public mutating func requestFinish() {
        guard phase == .activeSet || phase == .resting else { return }
        phaseBeforeConfirm = phase
        phase = .confirmEnd
    }

    public mutating func keepTraining() {
        guard phase == .confirmEnd else { return }
        phase = phaseBeforeConfirm
    }

    public mutating func confirmEnd(reason: SessionEndReason) {
        guard phase == .confirmEnd else { return }
        finishSession(reason: reason)
    }

    // MARK: - 私有

    private mutating func advanceExercise() {
        exerciseIndex += 1
        completedInCurrentExercise = []
        skippedInCurrentExercise = 0
        isHolding = false
        painReportedForCurrentSet = false
    }

    private mutating func finishSession(reason: SessionEndReason) {
        endReason = reason
        phase = .summary
    }

}
