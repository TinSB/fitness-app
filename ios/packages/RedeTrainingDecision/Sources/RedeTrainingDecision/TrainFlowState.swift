// TrainFlowState — 专注训练流状态机（M3-2，纯值类型 reducer）。
//
// app 层只持有它（@Observable 包装）+ 跑休息计时器与渲染；全部状态转移在
// 这里发生且有测试。负重决策不在本层——下一组目标来自 NextSetEngine
// （Hold 开启时回计划值=「暂停引擎微调」，跨组延续、不跨动作）。
// 跳过/替换/疼痛是 typed 留痕事实，M3-3 随完成写入经唯一写闸落盘。
// 无 IO/clock：休息倒计时的「时间流逝」由 app 层驱动，这里只存计划秒数。

public struct SessionExerciseAddition: Equatable, Sendable {
    public let exerciseId: String
    /// 0-based 会话队列位置；只作 completed-session open-bag 审计。
    public let position: Int
}

public struct SessionExerciseRemoval: Equatable, Sendable, Codable {
    public enum Action: String, Equatable, Sendable, Codable {
        case remove
        case restore
    }

    /// 0-based 会话队列位置；快照 + 位置共同防止重复 id 被整批误删。
    public let index: Int
    public let exercise: ExerciseSetPlan
    public let action: Action

    public init(index: Int, exercise: ExerciseSetPlan, action: Action) {
        self.index = index
        self.exercise = exercise
        self.action = action
    }

    public var restoring: SessionExerciseRemoval {
        SessionExerciseRemoval(index: index, exercise: exercise, action: .restore)
    }

    fileprivate var removing: SessionExerciseRemoval {
        SessionExerciseRemoval(index: index, exercise: exercise, action: .remove)
    }
}

/// 训练流事件（draft = 处方 + 事件日志；恢复 = 重放，M3-4/FR-TR9）。
public enum TrainFlowEvent: Equatable, Sendable, Codable {
    case logSet(CompletedSetObservation)
    case restFinished
    case skipSet(SetSkipReason)
    case skipExercise(SetSkipReason)
    case replaceExercise(String)
    case moveExerciseToCurrent(String)
    case addExercise(ExerciseSetPlan)
    case removeExercise(SessionExerciseRemoval)
    case adjustRemainingSets(Int)
    case reportPain
    case toggleHold
    case requestFinish
    case keepTraining
    case confirmEnd(SessionEndReason)
}

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
    /// FR-TR14 S2：仅作本场完成落盘 open-bag 审计；不进入处方/轮转/verdict。
    public private(set) var addedExercises: [SessionExerciseAddition] = []
    public private(set) var removedExercises: [SessionExerciseRemoval] = []
    public private(set) var endReason: SessionEndReason?
    /// Hold = 暂停引擎微调、按计划值；跨组延续、不跨动作。
    public private(set) var isHolding: Bool = false
    /// 当前组的疼痛预登记（打勾时并入 observation）。
    public private(set) var painReportedForCurrentSet: Bool = false
    /// 当前动作内被跳过的组数（指针 = 完成数 + 跳过数）。
    public private(set) var skippedInCurrentExercise: Int = 0
    /// 被接受的事件日志（draft 持久化用；被 guard 拒绝的事件不记录）。
    public private(set) var events: [TrainFlowEvent] = []
    /// FR-TR10 热身指针（当前动作已走过的热身步数）。**纯内存引导态**——不进 events、不进
    /// observationsByExercise、不落库（绝不毒化 NextSetEngine / 污染统计）；中断恢复时随工作组指针
    /// 重新生成（热身瞬态，不参与 replay）。热身是 .activeSet 上的 UI 叠加，不新增状态机相位 → 既有
    /// 流转/守卫/replay/落库零改动（零回归核心设计，切片2）。
    public private(set) var warmupPointer: Int = 0

    private var phaseBeforeConfirm: Phase = .activeSet
    private let catalog: ExerciseCatalog
    /// FR-EQ1（2026-06-11）：器械白名单（nil=不过滤），换动作候选据此过滤。
    private let allowedEquipment: Set<String>?
    /// 档位系统（2026-06-13）：换动作时按用户单位重算新动作的真实档位步长。
    private let loadUnit: LoadUnit

    public init(prescription: TodayPrescription, catalog: ExerciseCatalog = .minimal, allowedEquipment: Set<String>? = nil, loadUnit: LoadUnit = .kg) {
        self.prescription = prescription
        self.plan = SessionSetPlanner.expand(prescription)
        self.catalog = catalog
        self.allowedEquipment = allowedEquipment
        self.loadUnit = loadUnit
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
            stepKg: exercise.stepKg,
            loadType: exercise.loadType,
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
            excluding: Set(plan.exercises.map(\.exerciseId)),
            allowedEquipment: allowedEquipment
        )
    }

    /// 当前尚无正式事实时，可把后续已排且全计划唯一的动作提到现在练。
    /// 这是本次 session 的顺序调整，不是动作替换；候选顺序与当前队列一致。
    public var moveToCurrentCandidates: [String] {
        guard phase == .activeSet,
              completedInCurrentExercise.isEmpty,
              skippedInCurrentExercise == 0,
              !painReportedForCurrentSet,
              plan.exercises.indices.contains(exerciseIndex)
        else { return [] }

        let counts = Dictionary(grouping: plan.exercises, by: \.exerciseId)
            .mapValues(\.count)
        return plan.exercises.dropFirst(exerciseIndex + 1).compactMap { exercise in
            counts[exercise.exerciseId] == 1 ? exercise.exerciseId : nil
        }
    }

    // MARK: - 热身（FR-TR10 · 流内临时引导，不落库）

    /// 当前动作的保守热身阶梯（按计划工作重 + 目录动作事实生成）。纯派生、确定性。
    public var warmupStepsForCurrentExercise: [WarmupStep] {
        guard let exercise = currentExercise, let work = exercise.sets.first?.targetWeightKg else { return [] }
        let entry = catalog.entry(id: exercise.exerciseId)
        return WarmupLadderEngine.generate(
            workWeightKg: work,
            loadType: exercise.loadType,
            equipment: entry?.equipment ?? "",
            kind: entry?.kind ?? "",
            startWeightKg: entry?.startWeightKg ?? 0,
            unit: loadUnit
        )
    }

    /// 是否处于热身：动作开头（尚未做/跳任何工作组）且热身未走完。phase 仍是 .activeSet——
    /// 热身是 UI 叠加引导、不改状态机相位，UI 据此先渲染热身卡再渲染首个工作组。
    public var isWarmingUp: Bool {
        phase == .activeSet
            && completedInCurrentExercise.isEmpty
            && skippedInCurrentExercise == 0
            && warmupPointer < warmupStepsForCurrentExercise.count
    }

    /// 当前热身步（isWarmingUp 时非 nil）。
    public var currentWarmupStep: WarmupStep? {
        let steps = warmupStepsForCurrentExercise
        return warmupPointer < steps.count ? steps[warmupPointer] : nil
    }

    /// 热身打勾：推进到下一热身步。**不落库、不进事件日志、不碰工作组记录**。
    public mutating func advanceWarmupStep() {
        guard isWarmingUp else { return }
        warmupPointer += 1
    }

    /// 跳过全部热身：直接进首个工作组。**不落库、不进事件日志**（跳过偏好学习后置为独立 slice）。
    public mutating func skipAllWarmup() {
        guard isWarmingUp else { return }
        warmupPointer = warmupStepsForCurrentExercise.count
    }

    // MARK: - 事件

    public mutating func logSet(_ observation: CompletedSetObservation) {
        guard phase == .activeSet, let exercise = currentExercise else { return }
        events.append(.logSet(observation))
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
        events.append(.restFinished)
        if currentExerciseIsDone {
            advanceExercise()
        }
        phase = .activeSet
    }

    public mutating func skipSet(reason: SetSkipReason) {
        guard phase == .activeSet, let exercise = currentExercise else { return }
        events.append(.skipSet(reason))
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
        events.append(.skipExercise(reason))
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
        events.append(.replaceExercise(newExerciseId))
        replacements.append(Replacement(originalExerciseId: exercise.exerciseId, actualExerciseId: newExerciseId))
        let newEntry = catalog.entry(id: newExerciseId)
        let newLoadType = newEntry?.loadType ?? exercise.loadType
        // 步长跟动作走（LoadGrid，2026-06-13）；负重自重(equipment=bodyweight step 为 0)
        // 取挂片档；查不到器械=保守沿用原值。
        let newStep: Double = {
            guard let newEntry else { return exercise.stepKg }
            if newLoadType == "bodyweight-plus" { return LoadGrid.addedLoadStepKg(unit: loadUnit) }
            return LoadGrid.stepKg(equipment: newEntry.equipment, unit: loadUnit)
        }()
        // 换动作重算（wave-9/11，owner 拍板）：换到辅助器械(辅助量)或负重自重(外挂负重)时，
        // 原动作负重无意义（辅助方向反转、自重无重量轴），用目录默认值重置（下限守护防归零）。
        // external→external 沿用原负重不变（零回归面）。
        let newSets: [PlannedSet]
        if (newLoadType == "assisted" || newLoadType == "bodyweight-plus"), let newEntry {
            let defaultLoad = max(newStep, (newEntry.startWeightKg / newStep).rounded() * newStep)
            newSets = exercise.sets.map {
                PlannedSet(index: $0.index, targetWeightKg: defaultLoad, targetReps: $0.targetReps, targetRir: $0.targetRir)
            }
        } else if newLoadType == "bodyweight" || newLoadType == "band" {
            // 换到纯自重/弹力带：无重量轴，每组重量必须归 0——否则原动作负重（如 80kg）会随 PlannedSet
            // 落进 observations、被 CompletedSessionBuilder 写成"自重 80kg"脏历史，污染下次自重处方（审计 MAJOR）。
            newSets = exercise.sets.map {
                PlannedSet(index: $0.index, targetWeightKg: 0, targetReps: $0.targetReps, targetRir: $0.targetRir)
            }
        } else {
            newSets = exercise.sets
        }
        var exercises = plan.exercises
        exercises[exerciseIndex] = ExerciseSetPlan(
            exerciseId: newExerciseId,
            restSeconds: exercise.restSeconds,
            repLowerBound: exercise.repLowerBound,
            repUpperBound: exercise.repUpperBound,
            stepKg: newStep,
            loadType: newLoadType,
            sets: newSets
        )
        plan = SessionSetPlan(dayCode: plan.dayCode, exercises: exercises)
    }

    /// 把一个尚未开始的后续已排动作稳定移动到当前位置。
    /// `[A, B, C, D]` 当前 A、选择 C → `[C, A, B, D]`；动作计划参数原样保留。
    public mutating func moveExerciseToCurrent(_ exerciseId: String) {
        guard moveToCurrentCandidates.contains(exerciseId),
              let targetIndex = plan.exercises.indices.dropFirst(exerciseIndex + 1)
                .first(where: { plan.exercises[$0].exerciseId == exerciseId })
        else { return }

        var exercises = plan.exercises
        let target = exercises.remove(at: targetIndex)
        exercises.insert(target, at: exerciseIndex)

        events.append(.moveExerciseToCurrent(exerciseId))
        plan = SessionSetPlan(dayCode: plan.dayCode, exercises: exercises)
        completedInCurrentExercise = []
        skippedInCurrentExercise = 0
        isHolding = false
        painReportedForCurrentSet = false
        warmupPointer = 0
    }

    /// 临时加动作：payload 已在事件创建前解析完成；replay 不重查 canonical 历史。
    /// 插入永远紧跟当前动作，同一 exercise id 在本场只允许一份。
    public mutating func addExercise(_ exercise: ExerciseSetPlan) {
        guard phase == .activeSet,
              plan.exercises.indices.contains(exerciseIndex),
              !plan.exercises.contains(where: { $0.exerciseId == exercise.exerciseId }),
              isValidAdHocPayload(exercise)
        else { return }

        let insertionIndex = exerciseIndex + 1
        var exercises = plan.exercises
        exercises.insert(exercise, at: insertionIndex)
        events.append(.addExercise(exercise))
        addedExercises.append(SessionExerciseAddition(
            exerciseId: exercise.exerciseId,
            position: insertionIndex
        ))
        plan = SessionSetPlan(dayCode: plan.dayCode, exercises: exercises)
    }

    /// 只为 activeSet 的未来位置生成精确快照；当前/完成前缀/缺失位置一律不可移除。
    public func removal(at index: Int) -> SessionExerciseRemoval? {
        guard phase == .activeSet,
              index > exerciseIndex,
              plan.exercises.indices.contains(index)
        else { return nil }
        return SessionExerciseRemoval(index: index, exercise: plan.exercises[index], action: .remove)
    }

    /// remove 与 sheet 内立即 undo 共用同一 typed event 类；restore 只接受最后一层
    /// 精确快照，保持单层/LIFO。关 sheet 或进程终止后 UI 不再暴露 restoring event。
    public mutating func removeExercise(_ removal: SessionExerciseRemoval) {
        guard phase == .activeSet, removal.index > exerciseIndex else { return }
        var exercises = plan.exercises
        switch removal.action {
        case .remove:
            guard exercises.indices.contains(removal.index),
                  exercises[removal.index] == removal.exercise
            else { return }
            exercises.remove(at: removal.index)
            removedExercises.append(removal)
        case .restore:
            guard removal.index <= exercises.count,
                  removedExercises.last == removal.removing
            else { return }
            exercises.insert(removal.exercise, at: removal.index)
            removedExercises.removeLast()
        }
        events.append(.removeExercise(removal))
        plan = SessionSetPlan(dayCode: plan.dayCode, exercises: exercises)
    }

    /// 当前动作剩余组 ±1：只裁剪/复制未完成尾部，已完成/已跳过前缀永不变；
    /// 至少保留 1 个剩余组，总组数最多 8。
    public mutating func adjustRemainingSets(_ delta: Int) {
        guard phase == .activeSet,
              delta == -1 || delta == 1,
              plan.exercises.indices.contains(exerciseIndex),
              var exercise = currentExercise
        else { return }

        let pointer = completedInCurrentExercise.count + skippedInCurrentExercise
        let remaining = exercise.sets.count - pointer
        var sets = exercise.sets
        if delta < 0 {
            guard remaining > 1 else { return }
            sets.removeLast()
        } else {
            guard sets.count < 8, !sets.isEmpty else { return }
            let sourceIndex = min(pointer, sets.count - 1)
            let source = sets[sourceIndex]
            let recommendation = currentRecommendation
            sets.append(PlannedSet(
                index: sets.count + 1,
                targetWeightKg: currentTargetWeightKg ?? source.targetWeightKg,
                targetReps: recommendation?.targetReps ?? source.targetReps,
                targetRir: recommendation?.targetRir ?? source.targetRir
            ))
        }

        exercise = ExerciseSetPlan(
            exerciseId: exercise.exerciseId,
            restSeconds: exercise.restSeconds,
            repLowerBound: exercise.repLowerBound,
            repUpperBound: exercise.repUpperBound,
            stepKg: exercise.stepKg,
            loadType: exercise.loadType,
            sets: sets
        )
        var exercises = plan.exercises
        exercises[exerciseIndex] = exercise
        events.append(.adjustRemainingSets(delta))
        plan = SessionSetPlan(dayCode: plan.dayCode, exercises: exercises)
    }

    public mutating func toggleHold() {
        guard phase == .activeSet || phase == .resting else { return }
        events.append(.toggleHold)
        isHolding.toggle()
    }

    public mutating func reportPain() {
        guard phase == .activeSet else { return }
        events.append(.reportPain)
        painReportedForCurrentSet = true
    }

    public mutating func requestFinish() {
        guard phase == .activeSet || phase == .resting else { return }
        events.append(.requestFinish)
        phaseBeforeConfirm = phase
        phase = .confirmEnd
    }

    public mutating func keepTraining() {
        guard phase == .confirmEnd else { return }
        events.append(.keepTraining)
        phase = phaseBeforeConfirm
    }

    public mutating func confirmEnd(reason: SessionEndReason) {
        guard phase == .confirmEnd else { return }
        events.append(.confirmEnd(reason))
        finishSession(reason: reason)
    }

    /// 恢复（M3-4）：同处方重放事件——reducer 确定性保证恢复态 ≡ 中断态。
    /// 防御：任何事件在重放中被 guard 拒绝（如 catalog 改版致替换候选变化）
    /// 即返回 nil——宁可不恢复，绝不恢复到错误状态。
    public static func restore(
        prescription: TodayPrescription,
        events: [TrainFlowEvent],
        catalog: ExerciseCatalog = .minimal,
        allowedEquipment: Set<String>? = nil,
        loadUnit: LoadUnit = .kg
    ) -> TrainFlowState? {
        var state = TrainFlowState(prescription: prescription, catalog: catalog, allowedEquipment: allowedEquipment, loadUnit: loadUnit)
        for event in events {
            switch event {
            case .logSet(let observation): state.logSet(observation)
            case .restFinished: state.restFinished()
            case .skipSet(let reason): state.skipSet(reason: reason)
            case .skipExercise(let reason): state.skipExercise(reason: reason)
            case .replaceExercise(let id): state.replaceCurrentExercise(with: id)
            case .moveExerciseToCurrent(let id): state.moveExerciseToCurrent(id)
            case .addExercise(let exercise): state.addExercise(exercise)
            case .removeExercise(let removal): state.removeExercise(removal)
            case .adjustRemainingSets(let delta): state.adjustRemainingSets(delta)
            case .reportPain: state.reportPain()
            case .toggleHold: state.toggleHold()
            case .requestFinish: state.requestFinish()
            case .keepTraining: state.keepTraining()
            case .confirmEnd(let reason): state.confirmEnd(reason: reason)
            }
        }
        guard state.events == events else { return nil }
        return state
    }

    // MARK: - 私有

    private func isValidAdHocPayload(_ exercise: ExerciseSetPlan) -> Bool {
        guard let entry = catalog.entry(id: exercise.exerciseId),
              !entry.deprecated,
              EquipmentRegistry.prescribableLoadTypes.contains(entry.loadType),
              allowedEquipment == nil || allowedEquipment!.contains(entry.equipment),
              entry.loadType == exercise.loadType,
              exercise.restSeconds > 0,
              exercise.repLowerBound > 0,
              exercise.repUpperBound >= exercise.repLowerBound,
              exercise.sets.count == SessionExerciseEditPlanner.adHocSetCount
        else { return false }
        return exercise.sets.enumerated().allSatisfy { offset, set in
            set.index == offset + 1
                && set.targetWeightKg.isFinite
                && set.targetWeightKg >= 0
                && set.targetReps > 0
                && set.targetRir.isFinite
        }
    }

    private mutating func advanceExercise() {
        exerciseIndex += 1
        completedInCurrentExercise = []
        skippedInCurrentExercise = 0
        isHolding = false
        painReportedForCurrentSet = false
        warmupPointer = 0 // 新动作重新进入其热身（内存态，不进 events/落库）
    }

    private mutating func finishSession(reason: SessionEndReason) {
        endReason = reason
        phase = .summary
    }

}
