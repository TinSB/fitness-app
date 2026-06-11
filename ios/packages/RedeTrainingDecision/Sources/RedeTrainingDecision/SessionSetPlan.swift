// SessionSetPlan — 逐组处方（M3-1）：把动作级处方展开成可执行的组序列。
//
// MVP 组形 = straight sets（每组同重同次）——§6.3 的组形学习（ascending/
// top-backoff/wave、SetExecutionModel）与热身生成明示后置，本层只做确定性
// 展开。全 typed、kg 口径、零文案；输出纯派生，永不写回 AppData。

public struct PlannedSet: Equatable, Sendable {
    /// 1 起算的组号。
    public let index: Int
    public let targetWeightKg: Double
    public let targetReps: Int
    public let targetRir: Double

    public init(index: Int, targetWeightKg: Double, targetReps: Int, targetRir: Double) {
        self.index = index
        self.targetWeightKg = targetWeightKg
        self.targetReps = targetReps
        self.targetRir = targetRir
    }
}

public struct ExerciseSetPlan: Equatable, Sendable {
    public let exerciseId: String
    public let restSeconds: Int
    public let repLowerBound: Int
    public let repUpperBound: Int
    /// 渐进一档（kg，随处方自目录透传）：组内安全瀑布与快改档位的量子。
    /// 生产路径必须从处方透传（SessionSetPlanner/TrainFlowState 均显式传）；
    /// init 默认 2.5 仅为测试构造便利，不得在生产代码依赖。
    public let stepKg: Double
    public let sets: [PlannedSet]

    public init(exerciseId: String, restSeconds: Int, repLowerBound: Int, repUpperBound: Int, stepKg: Double = 2.5, sets: [PlannedSet]) {
        self.exerciseId = exerciseId
        self.restSeconds = restSeconds
        self.repLowerBound = repLowerBound
        self.repUpperBound = repUpperBound
        self.stepKg = stepKg
        self.sets = sets
    }
}

public struct SessionSetPlan: Equatable, Sendable {
    public let dayCode: String
    public let exercises: [ExerciseSetPlan]

    public init(dayCode: String, exercises: [ExerciseSetPlan]) {
        self.dayCode = dayCode
        self.exercises = exercises
    }
}

public enum SessionSetPlanner {
    /// 确定性展开：同处方必同序列（straight sets）。
    public static func expand(_ prescription: TodayPrescription) -> SessionSetPlan {
        let exercises = prescription.exercises.map { exercise in
            ExerciseSetPlan(
                exerciseId: exercise.exerciseId,
                restSeconds: exercise.restSeconds,
                repLowerBound: exercise.repLowerBound,
                repUpperBound: exercise.repUpperBound,
                stepKg: exercise.progressionStepKg,
                // 前置条件：处方引擎保证 sets ≥ 1（deload 调制下限 2）；max 仅作防御。
                sets: (1...max(1, exercise.sets)).map { index in
                    PlannedSet(
                        index: index,
                        targetWeightKg: exercise.targetWeightKg,
                        targetReps: exercise.targetReps,
                        targetRir: exercise.targetRir
                    )
                }
            )
        }
        return SessionSetPlan(dayCode: prescription.dayCode, exercises: exercises)
    }
}
