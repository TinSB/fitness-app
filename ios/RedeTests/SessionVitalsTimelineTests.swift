import XCTest
import RedeDataHealth
import RedeDomain
import RedeHealthKit
import RedeLocalSnapshot
import RedeTrainingDecision
@testable import Rede

// 自有运动记录 A2/B（2026-08-26）的时间轴契约。
//
// 这一层要钉死的是**一条链**：记组那一刻盖的章，要一路活到单场记录页的刻线上。
// 中间经手 canonical 落盘 → DataHealth 净化 → Snapshot 投影 → UI 换算，
// 任何一段把时刻丢了，B 的差异化（把「组」压在心率曲线上）就整块消失，
// 而且**不会有任何报错**——曲线照画，只是没有刻线。所以每一段都要有断言。

final class SessionVitalsTimelineTests: XCTestCase {

    // MARK: - 第一段：落盘

    func testBuilderWritesCompletedAtWhenTheObservationCarriesIt() throws {
        let iso = "2026-08-26T18:04:00Z"
        let session = try buildSession(observations: [
            CompletedSetObservation(weightKg: 60, reps: 8, completedAt: iso)
        ])
        XCTAssertEqual(firstSet(of: session)?["completedAt"]?.asString, iso)
    }

    func testBuilderOmitsCompletedAtEntirelyWhenAbsent() throws {
        // 不写空串：历史里「没有这一位」和「有一位但是空的」是两件事，
        // 后者会让消费端以为拿到了时刻然后解析出 nil，多绕一圈还更难查。
        let session = try buildSession(observations: [CompletedSetObservation(weightKg: 60, reps: 8)])
        XCTAssertNil(firstSet(of: session)?["completedAt"])
    }

    // MARK: - 第二段：净化层透传

    func testCleanViewCarriesSessionAndSetTimestampsThrough() throws {
        let view = CleanAppDataViewBuilder.build(from: try sessionAppData())
        let session = try XCTUnwrap(view.sessions.first)
        XCTAssertEqual(session.startedAt, "2026-08-26T18:00:00Z")
        XCTAssertEqual(session.finishedAt, "2026-08-26T18:42:00Z")
        XCTAssertEqual(session.exercises.first?.sets.first?.completedAt, "2026-08-26T18:04:00Z")
    }

    func testSnapshotProjectionCarriesTimestampsToTheRecord() throws {
        // 从 canonical 一路走到快照，不手搓中间态：手搓 CleanAppDataView 只能证明
        // mapToRecords 会抄字段，证明不了净化层真的把时刻交了出来。
        let view = CleanAppDataViewBuilder.build(from: try sessionAppData())
        let record = try XCTUnwrap(ProgressModel.mapToRecords(view).first)
        XCTAssertEqual(record.startedAtISO, "2026-08-26T18:00:00Z")
        XCTAssertEqual(record.finishedAtISO, "2026-08-26T18:42:00Z")
        XCTAssertEqual(record.exercises.first?.sets.first?.completedAtISO, "2026-08-26T18:04:00Z")
    }

    // MARK: - 第三段：换算成刻线位置

    func testSetMarksAreSecondsFromSessionStartAndSorted() {
        let record = record(start: "2026-08-26T18:00:00Z", setTimes: [
            "2026-08-26T18:10:00Z",   // 600
            "2026-08-26T18:04:00Z",   // 240 —— 故意乱序，落盘顺序不保证时间顺序
        ])
        XCTAssertEqual(ProgressTabView.setMarks(in: record), [240, 600])
    }

    func testSetsWithoutTimestampsAreDroppedNotGuessed() {
        // 本改动之前记的组没有时刻。宁可少画几条刻线，也不按组序号平均分布地猜位置——
        // 猜出来的刻线看起来和真的一样，那才是真的坏。
        let record = SnapshotSessionRecord(
            id: "s1", dateISO: "2026-08-26",
            exercises: [SnapshotExerciseRecord(exerciseId: "bench-press", sets: [
                SnapshotSetRecord(weightKg: 60, reps: 8, completedAtISO: "2026-08-26T18:04:00Z"),
                SnapshotSetRecord(weightKg: 60, reps: 8),
            ])],
            startedAtISO: "2026-08-26T18:00:00Z", finishedAtISO: "2026-08-26T18:42:00Z"
        )
        XCTAssertEqual(ProgressTabView.setMarks(in: record), [240])
    }

    func testNoStartTimeMeansNoMarksAtAll() {
        let record = SnapshotSessionRecord(
            id: "s1", dateISO: "2026-08-26",
            exercises: [SnapshotExerciseRecord(exerciseId: "bench-press", sets: [
                SnapshotSetRecord(weightKg: 60, reps: 8, completedAtISO: "2026-08-26T18:04:00Z"),
            ])]
        )
        XCTAssertTrue(ProgressTabView.setMarks(in: record).isEmpty)
    }

    func testFractionalSecondISOIsAlsoAccepted() {
        // 历史数据里存在带毫秒的时间戳（RedeDomain TypedFieldTests 的样本就是）。
        // 只认一种格式的话，那些场次会安静地失去全部刻线。
        let record = record(start: "2026-08-26T18:00:00.000Z", setTimes: ["2026-08-26T18:02:30.000Z"])
        XCTAssertEqual(ProgressTabView.setMarks(in: record), [150])
    }

    // MARK: - 有没有东西可显示

    func testVitalsWithOnlyDurationDoesNotClaimToHaveHeartRate() {
        // 只有时长时整块不出现：时长在别处已经有了，单独占一块只是噪音。
        XCTAssertFalse(SessionVitals(durationSeconds: 2520).hasHeartRateOrEnergy)
        XCTAssertTrue(SessionVitals(durationSeconds: 2520, averageHeartRate: 128).hasHeartRateOrEnergy)
        XCTAssertTrue(SessionVitals(durationSeconds: 2520, activeEnergyKcal: 342).hasHeartRateOrEnergy)
    }

    // MARK: - 辅助

    /// 走真实处方引擎造 flow（同 EndToEndWriteTests）：手搓 flow 会绕开
    /// observations 的真实写入路径，那样这条测试就不再证明落盘链路。
    private func buildSession(observations: [CompletedSetObservation]) throws -> TrainingSession {
        let empty = try AppData(decoding: .object(["schemaVersion": .int(8)]))
        let view = CleanAppDataViewBuilder.build(from: empty)
        let input = try CleanTrainingDecisionInput.make(from: view, todayISO: "2026-08-26")
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        for observation in observations {
            flow.logSet(observation)
            flow.restFinished()
        }
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)
        return CompletedSessionBuilder.build(
            from: flow, sessionId: "s1", dateISO: "2026-08-26",
            startedAtISO: "2026-08-26T18:00:00Z", finishedAtISO: "2026-08-26T18:42:00Z",
            durationMinutes: 42
        )
    }

    /// 一场带全部时刻的 canonical 数据。
    private func sessionAppData() throws -> AppData {
        try AppData(decoding: .object([
            "schemaVersion": .int(8),
            "history": .array([.object([
                "id": .string("s1"),
                "date": .string("2026-08-26"),
                "completed": .bool(true),
                "startedAt": .string("2026-08-26T18:00:00Z"),
                "finishedAt": .string("2026-08-26T18:42:00Z"),
                "exercises": .array([.object([
                    "id": .string("e1"),
                    "exerciseId": .string("bench-press"),
                    "sets": .array([.object([
                        "id": .string("set1"),
                        "setIndex": .int(1),
                        "exerciseId": .string("bench-press"),
                        "weight": .double(60),
                        "reps": .int(8),
                        "done": .bool(true),
                        "completedAt": .string("2026-08-26T18:04:00Z"),
                    ])]),
                ])]),
            ])]),
        ]))
    }

    private func firstSet(of session: TrainingSession) -> [String: JSONValue]? {
        session.storage["exercises"]?.asArray?.first?.asObject?["sets"]?.asArray?.first?.asObject
    }

    private func record(start: String, setTimes: [String]) -> SnapshotSessionRecord {
        SnapshotSessionRecord(
            id: "s1", dateISO: "2026-08-26",
            exercises: [SnapshotExerciseRecord(
                exerciseId: "bench-press",
                sets: setTimes.map { SnapshotSetRecord(weightKg: 60, reps: 8, completedAtISO: $0) }
            )],
            startedAtISO: start, finishedAtISO: nil
        )
    }
}
