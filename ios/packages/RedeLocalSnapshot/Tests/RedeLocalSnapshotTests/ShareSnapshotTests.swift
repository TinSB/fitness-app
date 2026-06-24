// ShareSnapshot / SharePrivacyFilter 契约（FR-SH1 S0）：
//  - 时长有损分桶（精确秒不可还原 → 只暴露区间，§9.3 禁"精确时间"）；
//  - patterns 去重保序 + 截断 6；负值防御；
//  - 类型层只含允许字段（禁止字段结构性缺失——编译期保证，注释钉死）。
import XCTest
@testable import RedeLocalSnapshot

final class ShareSnapshotTests: XCTestCase {

    // MARK: 时长分桶（有损、精确秒不泄露）

    func testDurationBandBoundaries() {
        XCTAssertEqual(ShareDurationBand.from(seconds: 0), .under30)
        XCTAssertEqual(ShareDurationBand.from(seconds: 29 * 60), .under30)
        XCTAssertEqual(ShareDurationBand.from(seconds: 30 * 60), .m30to45)
        XCTAssertEqual(ShareDurationBand.from(seconds: 44 * 60 + 59), .m30to45)
        XCTAssertEqual(ShareDurationBand.from(seconds: 45 * 60), .m45to60)
        XCTAssertEqual(ShareDurationBand.from(seconds: 60 * 60), .m60to90)
        XCTAssertEqual(ShareDurationBand.from(seconds: 89 * 60), .m60to90)
        XCTAssertEqual(ShareDurationBand.from(seconds: 90 * 60), .over90)
        XCTAssertEqual(ShareDurationBand.from(seconds: 200 * 60), .over90)
    }

    func testDurationBandDefensiveNegative() {
        XCTAssertEqual(ShareDurationBand.from(seconds: -1000), .under30)
    }

    func testExactDurationNotRecoverable() {
        // 两个不同的精确秒（都落 60-90 档）→ 同一区间，无法从卡反推精确时长。
        let a = SharePrivacyFilter.workoutSummary(generatedDateISO: "2026-06-24", dayCode: "push-a",
            exerciseCount: 5, setCount: 18, durationSeconds: 61 * 60 + 7, patterns: ["horizontal-press"], hadPR: false)
        let b = SharePrivacyFilter.workoutSummary(generatedDateISO: "2026-06-24", dayCode: "push-a",
            exerciseCount: 5, setCount: 18, durationSeconds: 88 * 60 + 51, patterns: ["horizontal-press"], hadPR: false)
        guard case let .workoutSummary(wa) = a.content, case let .workoutSummary(wb) = b.content else {
            return XCTFail("应为 workoutSummary")
        }
        XCTAssertEqual(wa.durationBand, .m60to90)
        XCTAssertEqual(wa.durationBand, wb.durationBand, "不同精确秒落同档 → 不可还原精确时长")
    }

    // MARK: patterns 去重保序 + 截断

    func testPatternsDedupedOrderedAndCapped() {
        let p = ["a", "b", "a", "c", "", "d", "e", "f", "g", "h"] // 含重复 + 空 + 超 6
        let snap = SharePrivacyFilter.workoutSummary(generatedDateISO: "2026-06-24", dayCode: nil,
            exerciseCount: 8, setCount: 24, durationSeconds: 3000, patterns: p, hadPR: true)
        guard case let .workoutSummary(w) = snap.content else { return XCTFail() }
        XCTAssertEqual(w.patterns, ["a", "b", "c", "d", "e", "f"], "去重保序 + 截断至 6 + 丢空")
        XCTAssertTrue(w.hadPR)
    }

    // MARK: 负值防御

    func testNegativeCountsClampedToZero() {
        let snap = SharePrivacyFilter.workoutSummary(generatedDateISO: "2026-06-24", dayCode: "pull-a",
            exerciseCount: -3, setCount: -5, durationSeconds: 2700, patterns: [], hadPR: false)
        guard case let .workoutSummary(w) = snap.content else { return XCTFail() }
        XCTAssertEqual(w.exerciseCount, 0)
        XCTAssertEqual(w.setCount, 0)
    }

    // MARK: PR 卡

    func testPersonalRecordCardCarriesOnlyAllowedFields() {
        let snap = SharePrivacyFilter.personalRecord(generatedDateISO: "2026-06-24",
            exerciseId: "bench-press", weightKg: 102.5, reps: 5, isEstimated: false)
        guard case let .personalRecord(pr) = snap.content else { return XCTFail("应为 personalRecord") }
        XCTAssertEqual(pr.exerciseId, "bench-press")
        XCTAssertEqual(pr.weightKg, 102.5)
        XCTAssertEqual(pr.reps, 5)
        XCTAssertFalse(pr.isEstimated)
        XCTAssertEqual(snap.generatedDateISO, "2026-06-24")
    }

    func testPersonalRecordNegativeWeightClamped() {
        let snap = SharePrivacyFilter.personalRecord(generatedDateISO: "2026-06-24",
            exerciseId: "x", weightKg: -50, reps: -2, isEstimated: true)
        guard case let .personalRecord(pr) = snap.content else { return XCTFail() }
        XCTAssertEqual(pr.weightKg, 0)
        XCTAssertEqual(pr.reps, 0)
        XCTAssertTrue(pr.isEstimated)
    }

    /// PR 卡同样的禁止字段哨兵（weightKg 是允许的 PR 摘要；禁的是 bodyweight/rir/pain 等，审查 MINOR）。
    func testNoForbiddenFieldsInPersonalRecord() {
        let pr = ShareSnapshot.PersonalRecord(exerciseId: "bench-press", weightKg: 102.5, reps: 5, isEstimated: false)
        let names = Set(Mirror(reflecting: pr).children.compactMap { $0.label?.lowercased() })
        for forbidden in ["bodyweight", "bodyweightkg", "rir", "pain", "location", "gym", "timestamp", "preciseseconds", "durationseconds", "failed"] {
            XCTAssertFalse(names.contains(forbidden), "PersonalRecord 不应含敏感字段 \(forbidden)")
        }
    }

    // MARK: 隐私结构性保证（编译期 + 显式断言意图）
    // ShareSnapshot 的 WorkoutSummary/PersonalRecord **不声明** 体重/RIR/疼痛/精确时间/位置/
    // 器械品牌/失败组/个人标识字段——禁止数据无处可存。下面用 Mirror 断言字段集合不含敏感名，
    // 作为"将来有人误加敏感字段"的回归哨兵。
    func testNoForbiddenFieldsInWorkoutSummary() {
        let w = ShareSnapshot.WorkoutSummary(dayCode: "push-a", exerciseCount: 5, setCount: 18,
            durationBand: .m45to60, patterns: ["horizontal-press"], hadPR: true)
        let names = Set(Mirror(reflecting: w).children.compactMap { $0.label?.lowercased() })
        for forbidden in ["bodyweight", "weightkg", "rir", "pain", "location", "gym", "timestamp", "preciseseconds", "durationseconds", "failed"] {
            XCTAssertFalse(names.contains(forbidden), "WorkoutSummary 不应含敏感字段 \(forbidden)")
        }
    }
}
