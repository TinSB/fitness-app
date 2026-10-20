import XCTest
import RedeDataHealth
@testable import RedeTrainingDecision

final class SessionExerciseEditPlannerTests: XCTestCase {
    func testSamePrimaryMuscleBorrowsFirstQueuedTargetsAndFullRepRange() throws {
        // Fixture 有意让分支 1 与众数分支输出全不同（钉住「donor 优先」），
        // 并放两个同肌群 donor（钉住「取当日队列第一个」）：
        // reps 众数 = 12（平票前即多数）≠ donor1 的 6；rest 众数 = 60 ≠ donor1 的 180；
        // 当前动作是异肌群（biceps），其 RIR=3 ≠ donor1 的 1。
        let catalog = makeCatalog([
            entry("arms-current", muscle: "biceps", start: 10),
            entry("chest-first", muscle: "chest", start: 20),
            entry("chest-second", muscle: "chest", start: 25),
            entry("arms-tail", muscle: "triceps", start: 15),
            entry("chest-new", muscle: "chest", start: 12.5),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("arms-current", reps: 12, rir: 3, rest: 60, lower: 10, upper: 15, weight: 10),
            plan("chest-first", reps: 6, rir: 1, rest: 180, lower: 5, upper: 8, weight: 40),
            plan("chest-second", reps: 10, rir: 2, rest: 90, lower: 8, upper: 12, weight: 30),
            plan("arms-tail", reps: 12, rir: 3, rest: 60, lower: 10, upper: 15, weight: 15),
        ])

        let result = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "chest-new",
            sessionPlan: sessionPlan,
            currentExerciseIndex: 0,
            sessions: [],
            catalog: catalog,
            allowedEquipment: nil,
            loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))

        XCTAssertEqual(result.exerciseId, "chest-new")
        XCTAssertEqual(result.restSeconds, 180, "must borrow donor #1 rest, not mode 60")
        XCTAssertEqual(result.repLowerBound, 5, "must borrow donor #1 range, not mode donor 8-12")
        XCTAssertEqual(result.repUpperBound, 8)
        XCTAssertEqual(result.sets.count, 3)
        XCTAssertEqual(result.sets.map(\.targetReps), [6, 6, 6], "must borrow donor #1 reps, not mode 12")
        XCTAssertEqual(result.sets.map(\.targetRir), [1, 1, 1], "must borrow donor #1 RIR, not current exercise 3")
        XCTAssertEqual(result.sets.map(\.targetWeightKg), [12.5, 12.5, 12.5])
    }

    func testNoPrimaryMuscleMatchUsesConservativeModesAndFirstMatchingRepDonor() throws {
        let catalog = makeCatalog([
            entry("first-eight", muscle: "chest", start: 20),
            entry("first-ten", muscle: "back", start: 20),
            entry("second-ten", muscle: "shoulders", start: 20),
            entry("second-eight", muscle: "biceps", start: 20),
            entry("legs-new", muscle: "quads", start: 30),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("first-eight", reps: 8, rir: 3, rest: 60, lower: 6, upper: 9),
            plan("first-ten", reps: 10, rir: 1, rest: 90, lower: 8, upper: 12),
            plan("second-ten", reps: 10, rir: 2, rest: 60, lower: 10, upper: 15),
            plan("second-eight", reps: 8, rir: 2, rest: 90, lower: 7, upper: 10),
        ])

        let result = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "legs-new",
            sessionPlan: sessionPlan,
            currentExerciseIndex: 0,
            sessions: [],
            catalog: catalog,
            allowedEquipment: nil,
            loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))

        XCTAssertEqual(result.sets.map(\.targetReps), [8, 8, 8],
                       "target reps mode tie must choose the smaller value")
        XCTAssertEqual(result.restSeconds, 90,
                       "rest mode tie must choose the larger value")
        XCTAssertEqual(result.sets.map(\.targetRir), [3, 3, 3],
                       "RIR must come from the current exercise")
        XCTAssertEqual(result.repLowerBound, 6)
        XCTAssertEqual(result.repUpperBound, 9,
                       "rep bounds must come from the first queued plan matching the winning target reps")
    }

    func testHistoryUsesLatestCanonicalSessionAndNoHistoryRespectsLoadSemantics() throws {
        let catalog = makeCatalog([
            entry("external-new", muscle: "chest", start: 11),
            entry("bodyweight-new", muscle: "chest", equipment: "bodyweight", start: 0, loadType: "bodyweight"),
            entry("assisted-new", muscle: "back", equipment: "selectorized", start: 35, loadType: "assisted"),
            entry("donor", muscle: "arms", start: 10),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("donor", reps: 10, rir: 2, rest: 75, lower: 8, upper: 12),
        ])
        let sessions = [
            session("older", date: "2026-07-01", exerciseId: "external-new", weights: [15, 17.5]),
            session("same-day-first", date: "2026-07-02", exerciseId: "external-new", weights: [20]),
            session("same-day-last", date: "2026-07-02", exerciseId: "external-new", weights: [22.5, 25]),
        ]

        let historical = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "external-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: sessions, catalog: catalog, allowedEquipment: nil, loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))
        XCTAssertEqual(historical.sets.map(\.targetWeightKg), [25, 25, 25])

        let bodyweight = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "bodyweight-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: [], catalog: catalog, allowedEquipment: nil, loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))
        XCTAssertEqual(bodyweight.sets.map(\.targetWeightKg), [0, 0, 0])

        let assisted = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "assisted-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: [], catalog: catalog, allowedEquipment: nil, loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))
        XCTAssertEqual(assisted.stepKg, 5)
        // 与今日处方的首练定档同一规则：没自报水平 → 辅助 ×0.5（35 → 17.5 → 吸附 20）。
        XCTAssertEqual(assisted.sets.map(\.targetWeightKg), [20, 20, 20])
    }

    // 2026-10-20 引擎审查第二批：加练 / 换动作的起始重量直接用今日处方的同一套规则（TodayPrescriptionEngine
    // .sessionEditStartLoadKg）：首练先验、按 staleness 判回归（整体停练 / 搁置；按轮换隔两周的不算）。
    func testStartingLoadAppliesBeginnerPriorAndComebackDiscountLikeTodaysPrescription() throws {
        let catalog = makeCatalog([
            entry("row", muscle: "back", equipment: "barbell", start: 50),
            entry("assisted-pull", muscle: "back", equipment: "selectorized", start: 30, loadType: "assisted"),
        ])
        func start(_ id: String, _ sessions: [CleanTrainingSession], level: String?, today: String) -> Double? {
            SessionExerciseEditPlanner.startingLoadKg(exerciseId: id, sessions: sessions, catalog: catalog,
                                                      trainingLevel: level, todayISO: today, repLowerBound: 8)
        }
        // 没做过：新手 ×0.5（以前直接给目录 50，主计划同一动作只给 25）。
        XCTAssertEqual(start("row", [], level: "beginner", today: "2026-07-03"), 25)
        XCTAssertEqual(start("assisted-pull", [], level: "beginner", today: "2026-07-03"), 45, "辅助反向：新手多帮 ×1.5")
        // 做过：最近一场最重的那组；中间整体停练两周以上按停练回归打折，至少降一格。
        let last = [session("last", date: "2026-07-01", exerciseId: "row", weights: [55, 60])]
        XCTAssertEqual(start("row", last, level: "beginner", today: "2026-07-10"), 60, "9 天：不打折")
        XCTAssertEqual(start("row", last, level: "beginner", today: "2026-07-17"), 55, "16 天：×0.9 → 54 → 吸附 55")
        XCTAssertEqual(start("row", last, level: "beginner", today: "2026-07-25"), 50, "24 天：×0.85 → 51 → 50")
        XCTAssertEqual(start("row", last, level: "beginner", today: "2026-08-31"), 45, "两个月：×0.75 → 45")
        // 辅助器械与今日处方一样：回归时多帮一档（数字是辅助量，越大越轻），不乘折扣。
        let assisted = [session("a", date: "2026-07-01", exerciseId: "assisted-pull", weights: [25])]
        XCTAssertEqual(start("assisted-pull", assisted, level: "beginner", today: "2026-08-31"), 30)
        // 按轮换本来就隔两周才轮到一次（中间一直在练别的）：不算回归，照搬（与今日处方的 staleness 一致；
        // 只看「这个动作自己隔了多久」会给轮换动作打折，审查 2026-10-20）。
        let rotation = last + ["2026-07-03", "2026-07-06", "2026-07-08", "2026-07-11", "2026-07-13", "2026-07-15"].map {
            session("other-\($0)", date: $0, exerciseId: "leg-press", weights: [100])
        }
        XCTAssertEqual(start("row", rotation, level: "beginner", today: "2026-07-17"), 60, "16 天没做、但一直在练：不打折")
    }

    // 2026-10-18：中途换动作的起始负重与临时加动作同一规则（换动作事件建立时解析一次）。
    func testStartingLoadForSwapUsesHistoryThenCatalogAndZeroForBodyweight() throws {
        let catalog = makeCatalog([
            entry("external-new", muscle: "chest", start: 11),
            entry("bodyweight-new", muscle: "chest", equipment: "bodyweight", start: 0, loadType: "bodyweight"),
        ])
        let sessions = [
            session("older", date: "2026-07-01", exerciseId: "external-new", weights: [15, 17.5]),
            session("latest", date: "2026-07-02", exerciseId: "external-new", weights: [22.5, 25]),
            session("dirty-bw", date: "2026-07-02", exerciseId: "bodyweight-new", weights: [80]),
        ]
        XCTAssertEqual(SessionExerciseEditPlanner.startingLoadKg(
            exerciseId: "external-new", sessions: sessions, catalog: catalog, trainingLevel: nil, todayISO: "2026-07-03", repLowerBound: 8), 25, "最近一场的最大工作重")
        XCTAssertEqual(SessionExerciseEditPlanner.startingLoadKg(
            exerciseId: "external-new", sessions: [], catalog: catalog, trainingLevel: nil, todayISO: "2026-07-03", repLowerBound: 8), 10, "无历史 → 目录起步对齐 2.5 档（11 → 10）")
        XCTAssertEqual(SessionExerciseEditPlanner.startingLoadKg(
            exerciseId: "bodyweight-new", sessions: sessions, catalog: catalog, trainingLevel: nil, todayISO: "2026-07-03", repLowerBound: 8), 0, "自重不借脏历史")
        XCTAssertNil(SessionExerciseEditPlanner.startingLoadKg(
            exerciseId: "not-in-catalog", sessions: sessions, catalog: catalog, trainingLevel: nil, todayISO: "2026-07-03", repLowerBound: 8))
    }

    func testBodyweightAndBandDirtyHistoryNeverBorrowsWeight() throws {
        // 防线与 prescribeBodyweight/replace 同口径：自重/弹力带无重量轴，
        // 即使 canonical 里有修复前遗留的脏重量（「自重 80kg」审计 MAJOR 形态），
        // add 路径也必须恒 0，不许把污染循环重新打开。
        let catalog = makeCatalog([
            entry("bodyweight-new", muscle: "chest", equipment: "bodyweight", start: 0, loadType: "bodyweight"),
            entry("band-new", muscle: "back", equipment: "band", start: 0, loadType: "band"),
            entry("donor", muscle: "arms", start: 10),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("donor", reps: 10, rir: 2, rest: 75, lower: 8, upper: 12),
        ])
        let dirty = [
            session("dirty-bw", date: "2026-07-20", exerciseId: "bodyweight-new", weights: [80]),
            session("dirty-band", date: "2026-07-21", exerciseId: "band-new", weights: [35]),
        ]

        let bodyweight = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "bodyweight-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: dirty, catalog: catalog, allowedEquipment: nil, loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))
        XCTAssertEqual(bodyweight.sets.map(\.targetWeightKg), [0, 0, 0])

        let band = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "band-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: dirty, catalog: catalog, allowedEquipment: nil, loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))
        XCTAssertEqual(band.sets.map(\.targetWeightKg), [0, 0, 0])
    }

    func testCandidatesExcludeScheduledUnsupportedDeprecatedAndUnavailableEquipment() {
        let catalog = makeCatalog([
            entry("scheduled", muscle: "chest", start: 20),
            entry("allowed", muscle: "biceps", start: 10),
            entry("wrong-equipment", muscle: "back", equipment: "barbell", start: 40),
            entry("deprecated", muscle: "quads", start: 30, deprecated: true),
            entry("unsupported", muscle: "shoulders", start: 10, loadType: "future-load"),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("scheduled", reps: 8, rir: 2, rest: 90, lower: 6, upper: 10),
        ])

        XCTAssertEqual(
            SessionExerciseEditPlanner.availableExercises(
                sessionPlan: sessionPlan,
                catalog: catalog,
                allowedEquipment: ["dumbbell"]
            ).map(\.id),
            ["allowed"]
        )
        XCTAssertNil(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "scheduled", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: [], catalog: catalog, allowedEquipment: ["dumbbell"], loadUnit: .kg,
            trainingLevel: nil, todayISO: "2026-07-03"
        ))
    }

    private func makeCatalog(_ entries: [ExerciseCatalogEntry]) -> ExerciseCatalog {
        ExerciseCatalog(catalogVersion: "session-edit-test", entries: entries)
    }

    private func entry(
        _ id: String,
        muscle: String,
        equipment: String = "dumbbell",
        start: Double,
        loadType: String = "external",
        deprecated: Bool = false
    ) -> ExerciseCatalogEntry {
        ExerciseCatalogEntry(
            id: id,
            movementPattern: "test-pattern",
            primaryMuscle: muscle,
            equipment: equipment,
            kind: "accessory",
            substitutionGroups: ["test-\(muscle)"],
            startWeightKg: start,
            loadType: loadType,
            rank: 10,
            deprecated: deprecated
        )
    }

    private func plan(
        _ id: String,
        reps: Int,
        rir: Double,
        rest: Int,
        lower: Int,
        upper: Int,
        weight: Double = 20
    ) -> ExerciseSetPlan {
        ExerciseSetPlan(
            exerciseId: id,
            restSeconds: rest,
            repLowerBound: lower,
            repUpperBound: upper,
            stepKg: 2.5,
            loadType: "external",
            sets: (1...3).map {
                PlannedSet(index: $0, targetWeightKg: weight, targetReps: reps, targetRir: rir)
            }
        )
    }

    private func session(
        _ id: String,
        date: String,
        exerciseId: String,
        weights: [Double]
    ) -> CleanTrainingSession {
        CleanTrainingSession(
            id: id,
            date: date,
            exercises: [
                CleanExercise(
                    exerciseId: exerciseId,
                    sets: weights.map { CleanLoggedSet(weight: $0, reps: 8, rir: 2) }
                ),
            ]
        )
    }
}
