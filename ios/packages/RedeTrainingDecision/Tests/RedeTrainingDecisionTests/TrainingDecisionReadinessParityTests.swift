// iOS-4B3 — readiness (subjective) unit tests + the riskLevel table.
// Drives the internal readiness port directly via @testable.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionReadinessParityTests: XCTestCase {

    private func readiness(sleep: String?, energy: String?, soreness: [String] = ["无"], pain: [String] = []) -> ReadinessResult {
        TrainingDecisionReadiness.buildReadinessResult(
            sleep: TrainingDecisionReadiness.mappedSleep(sleep),
            energy: TrainingDecisionReadiness.mappedEnergy(energy),
            sorenessAreas: TrainingDecisionReadiness.actionableSorenessAreas(soreness),
            painAreas: pain,
            useHealthDataForReadiness: nil
        )
    }

    // MARK: - score buckets (the only thing iOS-4B3 asserts against goldens)

    func test_default_status_is_medium_not_low() {
        // DEFAULT_STATUS 一般/中 -> 82-8-6 = 68 -> medium. Never low (no false readiness).
        let r = readiness(sleep: "一般", energy: "中")
        XCTAssertEqual(r.score, 68)
        XCTAssertEqual(r.level, .medium)
    }

    func test_poor_sleep_low_energy_is_low() {
        // controlled-reload-v1 todayStatus 差/低 -> 82-20-18 = 44 -> low -> recoveryHigh.
        let r = readiness(sleep: "差", energy: "低")
        XCTAssertEqual(r.score, 44)
        XCTAssertEqual(r.level, .low)
    }

    func test_good_sleep_high_energy_is_high() {
        let r = readiness(sleep: "好", energy: "高")
        XCTAssertEqual(r.score, 90)
        XCTAssertEqual(r.level, .high)
    }

    func test_nil_or_unknown_sleep_energy_uses_plus4_branch() {
        // Mirrors legacy web schema sleepMap[undefined] -> else (+4) branch.
        XCTAssertEqual(readiness(sleep: nil, energy: nil).score, 90)
    }

    func test_soreness_no_marker_is_dropped() {
        // ['无'] is the no-soreness marker -> 0 actionable -> no penalty.
        XCTAssertEqual(TrainingDecisionReadiness.actionableSorenessAreas(["无"]), [])
        XCTAssertEqual(readiness(sleep: "一般", energy: "中", soreness: ["无"]).score, 68)
        // Two real areas -> -15.
        XCTAssertEqual(readiness(sleep: "一般", energy: "中", soreness: ["肩", "膝"]).score, 68 - 15)
    }

    func test_pain_areas_lower_score_and_drive_recovery() {
        let r = readiness(sleep: "一般", energy: "中", pain: ["肩"])
        XCTAssertEqual(r.score, 68 - 20) // 48 -> low
        XCTAssertEqual(r.level, .low)
        XCTAssertEqual(r.trainingAdjustment, .recovery) // pain present -> recovery
    }

    // MARK: - riskLevelFor table (trainingDecisionEngine.ts:246)

    func test_riskLevelFor_table() {
        XCTAssertEqual(TrainingDecisionReadiness.riskLevelFor(severeFlag: true, readinessLevel: .high, painCount: 0), .severe)
        XCTAssertEqual(TrainingDecisionReadiness.riskLevelFor(severeFlag: false, readinessLevel: .low, painCount: 1), .high)
        XCTAssertEqual(TrainingDecisionReadiness.riskLevelFor(severeFlag: false, readinessLevel: .low, painCount: 0), .moderate)
        XCTAssertEqual(TrainingDecisionReadiness.riskLevelFor(severeFlag: false, readinessLevel: .medium, painCount: 1), .low)
        XCTAssertEqual(TrainingDecisionReadiness.riskLevelFor(severeFlag: false, readinessLevel: .medium, painCount: 0), .none)
    }

    // MARK: - collectPainAreasFromHistory

    func test_collectPainAreas_reads_painFlag_sets() {
        let painSet = TrainingSetLog(weight: .double(60), painFlag: true, painArea: "shoulder")
        let session = TrainingSession(
            id: "p", date: CoreSliceTestKit.dateOnly(daysBefore: 2), completed: true,
            exercises: [ExercisePrescription(id: "e", name: "Bench", sets: [painSet])]
        )
        XCTAssertEqual(TrainingDecisionReadiness.collectPainAreasFromHistory([session]), ["shoulder"])
        // Fixture sessions (no painFlag) -> [].
        XCTAssertEqual(TrainingDecisionReadiness.collectPainAreasFromHistory([CoreSliceTestKit.session(id: "n", gap: 2)]), [])
    }

    // MARK: - stale todayStatus does not invent a low/high readiness

    func test_stale_todayStatus_still_scores_from_subjective() {
        // A stale (6-day-old) DEFAULT status still yields the same medium bucket —
        // staleness is a diagnostic, not a readiness input.
        let input = CoreSliceTestKit.makeCleanInput(
            sessions: [CoreSliceTestKit.session(id: "s1", gap: 2), CoreSliceTestKit.session(id: "s2", gap: 5)],
            todayStatusDaysAgo: 6
        )
        let slice = buildTrainingDecisionFromCleanInput(input)
        XCTAssertEqual(slice.readinessLevel, .medium)
        XCTAssertEqual(slice.riskLevel, .none)
        XCTAssertEqual(slice.sessionIntent, .normalSession)
    }
}
