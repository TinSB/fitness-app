// iOS-4B5 Exercise Prescription + Volume Floor V1 — per-exercise target-set pipeline.
//
// Swift port of the SET-COUNT subset of the prescription path:
//   * prescribeExercise hybrid clamp (exercisePrescriptionEngine.ts:129-260, hybrid
//     else-chain only) — strength/hypertrophy branches + weekly-budget DEFERRED
//     (the fixtures are all hybrid + weeklyPrescription null).
//   * the applyStatusRules set pipeline (exercisePrescriptionEngine.ts:359-719):
//       step1  max(kindFloor, ceil(prescribed * externalVolumeMultiplier))   (400-405)
//       (425)  trainingAdjustment==conservative || energy==低  -> non-compound -1
//       (436)  sleep差 && energy低                              -> isolation -1
//       (480 / adaptiveFeedbackEngine.ts:370-399) adaptive cut by conservativeLevel
//       (688-701) IN-ENGINE final floor max(kindFloor, sets)  (load-bearing for reentry)
//   * the OUTER workingSetTargets floor (trainingDecisionEngine.ts:1968-1983):
//       targetSets = max(adjustedSets, exerciseRoleFloors[roleOf(kind,name)])
//
// DEFERRED (inert for the 9 goldens — soreness '无', no pain history, no calibration,
// time=60, no mature fineTune data; documented golden-neutral): time<=30 (416),
// poorSleep+time<=30 (449), poorSleepDays>=2 (459), recovery (469), painPattern (519),
// statusHitsMuscle (562), adaptiveCalibration bias (571), fineTune trust override (628).
// applyDeloadStrategy is SKIPPED (TS passes suppressInternalDeloadStrategy:true) — but
// deload.level is still consumed by the adaptive conservativeLevel. PURE; no clock.

import Foundation
import IronPathDomain

/// A raw template exercise the prescription consumes; the engine enriches
/// orderPriority / contraindications / linkedIssues via the bounded knowledge map.
public struct TrainingDecisionTemplateExercise: Equatable, Sendable {
    public let id: String
    public let name: String
    public let muscle: String
    public let kind: String
    public let sets: Int
    public let repMin: Int
    public let repMax: Int

    public init(id: String, name: String, muscle: String, kind: String, sets: Int, repMin: Int, repMax: Int) {
        self.id = id
        self.name = name
        self.muscle = muscle
        self.kind = kind
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
    }
}

/// `WorkingSetTarget` subset (trainingDecisionTypes.ts) the golden `perExercise`
/// projection records (exerciseId / role / targetSets).
public struct WorkingSetTarget: Equatable, Sendable {
    public let exerciseId: String
    public let role: ExerciseRole
    public let targetSets: Int

    public init(exerciseId: String, role: ExerciseRole, targetSets: Int) {
        self.exerciseId = exerciseId
        self.role = role
        self.targetSets = targetSets
    }
}

enum TrainingDecisionExercisePrescription {
    private static func clamp(_ value: Int, _ lo: Int, _ hi: Int) -> Int { max(lo, min(hi, value)) }

    /// prescribeExercise (exercisePrescriptionEngine.ts:191-214) — hybrid mode only.
    /// mainCompound = kind=='compound' && orderPriority<=1 -> clamp(3,4); isolation ->
    /// clamp(2,4); else (secondary compound / machine) -> clamp(2,4).
    static func prescribeSets(kind: String, baseSets: Int, orderPriority: Int) -> Int {
        let mainCompound = kind == "compound" && orderPriority <= 1
        if mainCompound { return clamp(baseSets, 3, 4) }
        if kind == "isolation" { return clamp(baseSets, 2, 4) }
        return clamp(baseSets, 2, 4)
    }

    /// `contraindicated` (getExerciseAdaptiveProfile, adaptiveFeedbackEngine.ts:276):
    /// the exercise's contraindications intersect (linkedIssues ∪ correctionPriority).
    static func isContraindicated(id: String, correctionPriority: [String]) -> Bool {
        let contra = TrainingDecisionExerciseKnowledge.contraindications(id: id)
        if contra.isEmpty { return false }
        let active = Set(TrainingDecisionExerciseKnowledge.linkedIssues(id: id)).union(correctionPriority)
        return contra.contains { active.contains($0) }
    }

    /// conservativeLevel (buildAdaptiveConservativeDecision, adaptiveFeedbackEngine.ts:306-347)
    /// — the fixture-relevant terms. readiness.level maps via mapReadinessToSignal
    /// (high->green 0, medium->yellow +1, low->red +2). deload watch/yellow/red ->
    /// +1/+2/+3. contraindicated -> +2. (performanceDrop / painCount / restricted /
    /// issueScore are 0 for the default-screening fixtures and are DEFERRED.)
    static func conservativeLevel(readinessLevel: ReadinessLevel, deloadLevel: DeloadLevel, contraindicated: Bool) -> Int {
        var level = 0
        if readinessLevel == .medium { level += 1 }   // yellow
        if readinessLevel == .low { level += 2 }       // red
        if contraindicated { level += 2 }
        if deloadLevel == .watch { level += 1 }
        if deloadLevel == .yellow { level += 2 }
        if deloadLevel == .red { level += 3 }
        return level
    }

    /// The per-exercise target-set pipeline + workingSetTargets projection.
    static func buildWorkingSetTargets(
        templateExercises: [TrainingDecisionTemplateExercise],
        todayStatus: TodayStatus,
        readiness: ReadinessResult,
        deloadLevel: DeloadLevel,
        finalVolumeMultiplier: Double,
        intent: SessionIntent,
        correctionPriority: [String]
    ) -> (targets: [WorkingSetTarget], exerciseRoleFloors: [ExerciseRole: Int]) {
        let roleFloors = TrainingDecisionRoleFloors.exerciseRoleFloors(intent: intent)
        let kindFloors = TrainingDecisionRoleFloors.kindFloors(roleFloors)
        let lowEnergy = todayStatus.energy == "低"
        let poorSleep = todayStatus.sleep == "差"
        let conservativeOrLowEnergy = readiness.trainingAdjustment == .conservative || lowEnergy

        var targets: [WorkingSetTarget] = []
        for ex in templateExercises {
            let orderPriority = TrainingDecisionExerciseKnowledge.orderPriority(id: ex.id, kind: ex.kind)

            // prescribeExercise (hybrid clamp).
            let prescribed = prescribeSets(kind: ex.kind, baseSets: ex.sets, orderPriority: orderPriority)

            // step1: max(kindFloor, ceil(prescribed * externalVolumeMultiplier)).
            var sets = max(
                TrainingDecisionRoleFloors.floor(for: ex.kind, kindFloors),
                Int((Double(prescribed) * finalVolumeMultiplier).rounded(.up))
            )

            // (425) conservative / low-energy: non-compound -1.
            if conservativeOrLowEnergy && ex.kind != "compound" {
                sets = max(1, sets - 1)
            }

            // (436) sleep差 && energy低: isolation -1.
            if poorSleep && lowEnergy && ex.kind == "isolation" {
                sets = max(1, sets - 1)
            }

            // (adaptiveFeedbackEngine.ts:395-399) conservativeLevel set cut.
            let contraindicated = isContraindicated(id: ex.id, correctionPriority: correctionPriority)
            let cl = conservativeLevel(readinessLevel: readiness.level, deloadLevel: deloadLevel, contraindicated: contraindicated)
            if cl >= 4 {
                sets = max(1, sets - (ex.kind == "isolation" ? 1 : 2))
            } else if cl >= 2 {
                sets = max(1, sets - (ex.kind == "isolation" ? 0 : 1))
            }

            // (688-701) in-engine final floor — lifts reentry/restart compounds back up.
            sets = max(TrainingDecisionRoleFloors.floor(for: ex.kind, kindFloors), sets)

            // (trainingDecisionEngine.ts:1976) OUTER workingSetTargets role floor.
            let role = TrainingDecisionExerciseRoles.roleOf(kind: ex.kind, name: ex.name)
            let targetSets = max(sets, roleFloors[role] ?? 1)
            targets.append(WorkingSetTarget(exerciseId: ex.id, role: role, targetSets: targetSets))
        }
        return (targets, roleFloors)
    }
}
