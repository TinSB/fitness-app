// iOS-4B5 — prescription-internal unit tests (prescribeSets / conservativeLevel /
// contraindicated / the set pipeline + floors) + engine-level no-template behavior.
// Drives the pure helpers via @testable.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionExercisePrescriptionParityTests: XCTestCase {

    private func ex(_ id: String, _ name: String, _ kind: String, sets: Int, _ repMin: Int = 6, _ repMax: Int = 10) -> TrainingDecisionTemplateExercise {
        TrainingDecisionTemplateExercise(id: id, name: name, muscle: "胸", kind: kind, sets: sets, repMin: repMin, repMax: repMax)
    }
    private func status(sleep: String = "一般", energy: String = "中") -> TodayStatus {
        TodayStatus(sleep: sleep, energy: energy, time: "60", soreness: ["无"])
    }
    private func readiness(_ level: ReadinessLevel, _ adj: ReadinessTrainingAdjustment) -> ReadinessResult {
        ReadinessResult(score: 64, level: level, trainingAdjustment: adj, reasons: [])
    }

    // MARK: - prescribeExercise hybrid clamp

    func test_prescribeSets_hybrid_clamp() {
        XCTAssertEqual(TrainingDecisionExercisePrescription.prescribeSets(kind: "compound", baseSets: 3, orderPriority: 1), 3) // mainCompound clamp(3,4)
        XCTAssertEqual(TrainingDecisionExercisePrescription.prescribeSets(kind: "compound", baseSets: 1, orderPriority: 1), 3) // clamp up to 3
        XCTAssertEqual(TrainingDecisionExercisePrescription.prescribeSets(kind: "compound", baseSets: 3, orderPriority: 3), 3) // op>1 -> secondary clamp(2,4)
        XCTAssertEqual(TrainingDecisionExercisePrescription.prescribeSets(kind: "machine", baseSets: 2, orderPriority: 3), 2)
        XCTAssertEqual(TrainingDecisionExercisePrescription.prescribeSets(kind: "isolation", baseSets: 4, orderPriority: 7), 4)
        XCTAssertEqual(TrainingDecisionExercisePrescription.prescribeSets(kind: "isolation", baseSets: 6, orderPriority: 7), 4) // clamp down to 4
        XCTAssertEqual(TrainingDecisionExercisePrescription.prescribeSets(kind: "isolation", baseSets: 1, orderPriority: 7), 2) // clamp up to 2
    }

    // MARK: - contraindicated + conservativeLevel

    func test_contraindicated_chain() {
        let corr = ["upper_crossed", "scapular_control", "core_control"]
        XCTAssertTrue(TrainingDecisionExercisePrescription.isContraindicated(id: "bench-press", correctionPriority: corr))
        XCTAssertTrue(TrainingDecisionExercisePrescription.isContraindicated(id: "machine-chest-press", correctionPriority: corr))
        XCTAssertFalse(TrainingDecisionExercisePrescription.isContraindicated(id: "cable-fly", correctionPriority: corr)) // no contraindications
        XCTAssertFalse(TrainingDecisionExercisePrescription.isContraindicated(id: "lateral-raise", correctionPriority: corr))
        XCTAssertFalse(TrainingDecisionExercisePrescription.isContraindicated(id: "unknown-exercise", correctionPriority: corr))
    }

    func test_conservativeLevel_table() {
        // readiness yellow(+1)/red(+2); deload watch(+1); contraindicated(+2).
        XCTAssertEqual(TrainingDecisionExercisePrescription.conservativeLevel(readinessLevel: .high, deloadLevel: .none, contraindicated: false), 0)
        XCTAssertEqual(TrainingDecisionExercisePrescription.conservativeLevel(readinessLevel: .medium, deloadLevel: .none, contraindicated: false), 1)
        XCTAssertEqual(TrainingDecisionExercisePrescription.conservativeLevel(readinessLevel: .medium, deloadLevel: .none, contraindicated: true), 3)
        XCTAssertEqual(TrainingDecisionExercisePrescription.conservativeLevel(readinessLevel: .low, deloadLevel: .watch, contraindicated: false), 3)
        XCTAssertEqual(TrainingDecisionExercisePrescription.conservativeLevel(readinessLevel: .low, deloadLevel: .watch, contraindicated: true), 5)
    }

    // MARK: - the IN-ENGINE final floor is load-bearing (max() raising)

    func test_inEngine_floor_raises_compound_under_reentry() {
        // A contraindicated compound at reentry: adaptive cut drops it to 1, the
        // in-engine floor (kind compound = 2 under reentry) raises it back to 2.
        let exReentry = TrainingDecisionExercisePrescription.buildWorkingSetTargets(
            templateExercises: [ex("bench-press", "平板卧推", "compound", sets: 3)],
            todayStatus: status(),
            readiness: readiness(.medium, .conservative),
            deloadLevel: .none,
            finalVolumeMultiplier: 0.65,
            intent: .reentryProductive,
            correctionPriority: ["upper_crossed", "scapular_control", "core_control"]
        )
        XCTAssertEqual(exReentry.targets.first?.targetSets, 2, "reentry floor must lift the adaptive-cut compound back to 2")

        // Same inputs but NORMAL intent (floor 1) -> the floor does NOT lift -> 1.
        let exNormal = TrainingDecisionExercisePrescription.buildWorkingSetTargets(
            templateExercises: [ex("bench-press", "平板卧推", "compound", sets: 3)],
            todayStatus: status(),
            readiness: readiness(.medium, .conservative),
            deloadLevel: .none,
            finalVolumeMultiplier: 0.65,
            intent: .normalSession,
            correctionPriority: ["upper_crossed", "scapular_control", "core_control"]
        )
        XCTAssertEqual(exNormal.targets.first?.targetSets, 1, "no reentry floor -> adaptive cut stands at 1")
    }

    // MARK: - finalVolumeMultiplier feeds the set count

    func test_finalVolumeMultiplier_scales_sets() {
        func benchSets(_ mult: Double) -> Int {
            TrainingDecisionExercisePrescription.buildWorkingSetTargets(
                templateExercises: [ex("lateral-raise", "哑铃侧平举", "isolation", sets: 4)],
                todayStatus: status(sleep: "好", energy: "高"), // high readiness, no conservative cut
                readiness: readiness(.high, .normal),
                deloadLevel: .none,
                finalVolumeMultiplier: mult,
                intent: .normalSession,
                correctionPriority: []
            ).targets.first?.targetSets ?? -1
        }
        XCTAssertEqual(benchSets(1.0), 4) // ceil(4*1.0)=4
        XCTAssertEqual(benchSets(0.5), 2) // ceil(4*0.5)=2
        XCTAssertEqual(benchSets(0.3), 2) // ceil(4*0.3=1.2)=2
    }

    // MARK: - engine: no template -> empty perExercise (backward compatible)

    func test_no_template_yields_empty_perExercise() {
        let input = CoreSliceTestKit.makeCleanInput(gap: 2, templateExercises: [])
        let slice = buildTrainingDecisionFromCleanInput(input)
        XCTAssertTrue(slice.perExercise.isEmpty)
        XCTAssertTrue(slice.allTargetSets.isEmpty)
        XCTAssertNil(slice.minTargetSets)
        // The 4B2-4B4 fields are unaffected.
        XCTAssertEqual(slice.sessionIntent, .normalSession)
        XCTAssertEqual(slice.intensityMode, .cap)
    }
}
