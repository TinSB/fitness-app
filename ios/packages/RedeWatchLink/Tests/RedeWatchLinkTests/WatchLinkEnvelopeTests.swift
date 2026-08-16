import XCTest
@testable import RedeWatchLink

// 信封是纯的，可以单测。WCSession 那层不测——它要真机/模拟器配对，
// 属于切片 2 的实跑验收，不是单测能覆盖的东西。
final class WatchLinkEnvelopeTests: XCTestCase {

    func testRoundTripThroughDictionary() {
        let e = WatchLinkEnvelope(kind: "ping", sentAtISO: "2026-08-12T10:00:00Z",
                                  body: ["from": "watch", "n": "1"])
        let back = WatchLinkEnvelope(dictionary: e.dictionary)
        XCTAssertEqual(back, e)
    }

    func testDictionaryIsPropertyListSafe() {
        // WCSession 只接受 plist 兼容类型。混进非 plist 类型会在发送时抛，
        // 而且错误信息很含糊——所以这里直接把契约钉住。
        let d = WatchLinkEnvelope(kind: "ping", sentAtISO: "t", body: ["a": "b"]).dictionary
        XCTAssertTrue(PropertyListSerialization.propertyList(d, isValidFor: .binary),
                      "信封字典必须是 plist 兼容的，否则 WCSession 发送会抛")
    }

    func testIncompleteDictionaryIsRejectedWholesale() {
        // 半个信封比没有更糟：接收端会以为自己拿到了完整数据。
        XCTAssertNil(WatchLinkEnvelope(dictionary: [:]))
        XCTAssertNil(WatchLinkEnvelope(dictionary: ["k": "ping"]))              // 缺时间
        XCTAssertNil(WatchLinkEnvelope(dictionary: ["t": "2026-08-12"]))        // 缺 kind
        XCTAssertNil(WatchLinkEnvelope(dictionary: ["k": 1, "t": "x"]))         // kind 类型错
    }

    func testMissingBodyDegradesToEmptyNotNil() {
        // body 缺失是合法的（ping 就不带 body）——不该整封作废。
        let e = WatchLinkEnvelope(dictionary: ["k": "ping", "t": "2026-08-12T10:00:00Z"])
        XCTAssertEqual(e?.kind, "ping")
        XCTAssertEqual(e?.body, [:])
    }

    func testUnknownKindSurvivesDecoding() {
        // 向前兼容：表和手机版本可能不同步，旧端收到新 kind 必须能安静解出来再丢弃，
        // 而不是解码失败。判断交给上层。
        let e = WatchLinkEnvelope(dictionary: ["k": "somethingFromTheFuture", "t": "x"])
        XCTAssertEqual(e?.kind, "somethingFromTheFuture")
    }
}

// 切片 3：结构化载荷。信封多了一个 Data 字段，plist 安全这条契约不能被它破坏。
final class WatchPrescriptionTests: XCTestCase {

    private var sample: WatchPrescription {
        WatchPrescription(dateISO: "2026-08-15", dayTitle: "上肢", exercises: [
            .init(exerciseId: "bench-press", name: "卧推", setsText: "4 组", targetText: "60 kg · ×8-10"),
            .init(exerciseId: "pull-up", name: "引体向上", setsText: "3 组", targetText: "自重 · ×8")
        ])
    }

    func testRoundTripThroughEnvelope() {
        let e = WatchLinkEnvelope(kind: WatchLinkKind.prescription, sentAtISO: "t",
                                  payload: sample.encoded)
        let back = WatchLinkEnvelope(dictionary: e.dictionary)
        XCTAssertEqual(back, e)
        XCTAssertEqual(back.flatMap { $0.payload }.flatMap(WatchPrescription.init(decoding:)), sample)
    }

    func testEnvelopeWithPayloadStaysPropertyListSafe() {
        // WCSession 只接受 plist 兼容类型。Data 是合法的，但这条必须由测试钉住——
        // 一旦有人把 payload 换成别的类型，发送会在运行时抛，而且错误信息很含糊。
        let d = WatchLinkEnvelope(kind: WatchLinkKind.prescription, sentAtISO: "t",
                                  payload: sample.encoded).dictionary
        XCTAssertTrue(PropertyListSerialization.propertyList(d, isValidFor: .binary))
    }

    func testEnvelopeWithoutPayloadOmitsTheKey() {
        // ping/pong 不带载荷，字典里就不该出现这个键。
        let d = WatchLinkEnvelope(kind: "ping", sentAtISO: "t").dictionary
        XCTAssertNil(d["p"])
        XCTAssertNil(WatchLinkEnvelope(dictionary: d)?.payload)
    }

    func testRestDayIsAnEmptyListNotAMissingPayload() {
        // 休息日必须是「空清单」而不是「不推」：不推的话表上会继续显示昨天的动作。
        let rest = WatchPrescription(dateISO: "2026-08-15", dayTitle: "", exercises: [])
        let back = rest.encoded.flatMap(WatchPrescription.init(decoding:))
        XCTAssertEqual(back?.exercises.count, 0)
        XCTAssertEqual(back?.dateISO, "2026-08-15")
    }

    func testGarbagePayloadDecodesToNilInsteadOfCrashing() {
        // 版本不同步时表可能收到看不懂的载荷。必须安静失败——表上显示「等手机」，不是崩。
        XCTAssertNil(WatchPrescription(decoding: Data([0x00, 0x01, 0x02])))
    }
}

// 切片 4：表 → 手机的已完成组。
final class WatchLoggedSetTests: XCTestCase {

    private var sample: WatchLoggedSet {
        WatchLoggedSet(exerciseId: "bench-press", setNumber: 2, weightKg: 37.5,
                       reps: 8, rir: 2, loggedAtISO: "2026-08-15T10:00:00Z")
    }

    func testRoundTripThroughEnvelope() {
        let e = WatchLinkEnvelope(kind: WatchLinkKind.loggedSet, sentAtISO: "t", payload: sample.encoded)
        let back = WatchLinkEnvelope(dictionary: e.dictionary)
        XCTAssertEqual(back.flatMap { $0.payload }.flatMap(WatchLoggedSet.init(decoding:)), sample)
    }

    func testIdempotencyKeyIsCarriedBackUnchanged() {
        // 手机只在「正是此刻等的那一组」时接受。这两个字段就是那个判断的全部依据——
        // 少任何一个，两块屏同时开着时同一组会落盘两次。
        let active = WatchPrescription.Active(
            exerciseId: "squat", exerciseName: "深蹲", setNumber: 3, setTotal: 4,
            exerciseNumber: 1, exerciseTotal: 5, targetText: "80 kg × 5",
            targetWeightKg: 80, targetReps: 5, targetRir: 2, isResting: false)
        let logged = WatchLoggedSet(exerciseId: active.exerciseId, setNumber: active.setNumber,
                                    weightKg: active.targetWeightKg, reps: 4,
                                    rir: active.targetRir, loggedAtISO: "t")
        XCTAssertEqual(logged.exerciseId, active.exerciseId)
        XCTAssertEqual(logged.setNumber, active.setNumber)
        XCTAssertEqual(logged.weightKg, active.targetWeightKg)
        XCTAssertEqual(logged.rir, active.targetRir)
        XCTAssertNotEqual(logged.reps, active.targetReps)
    }

    func testUnrecordedRirRoundTripsAsNil() {
        // v2：表上选「—」= 不记 RIR。nil 必须原样过桥，不能在解码那头变成 0——
        // 0 是「力竭」，和「没记」是两回事，引擎对两者的处理不同。
        let set = WatchLoggedSet(exerciseId: "squat", setNumber: 1, weightKg: 82.5,
                                 reps: 5, rir: nil, loggedAtISO: "t")
        let back = set.encoded.flatMap(WatchLoggedSet.init(decoding:))
        XCTAssertEqual(back, set)
        XCTAssertNil(back?.rir)
    }

    func testLegacyLoggedSetWithRirStillDecodes() {
        // 旧表恒带 rir；新手机必须照旧解出来。
        let legacy = #"{"exerciseId":"squat","setNumber":1,"weightKg":80,"reps":5,"rir":2,"loggedAtISO":"t","isWarmup":false}"#
        let back = WatchLoggedSet(decoding: Data(legacy.utf8))
        XCTAssertEqual(back?.rir, 2)
    }
}

// v2：表 → 手机的遥控命令。
final class WatchCommandTests: XCTestCase {

    func testRoundTripThroughEnvelope() {
        let cmd = WatchCommand(action: .restAdd30, exerciseId: "squat", sentAtISO: "t")
        let e = WatchLinkEnvelope(kind: WatchLinkKind.command, sentAtISO: "t", payload: cmd.encoded)
        let back = WatchLinkEnvelope(dictionary: e.dictionary)
        XCTAssertEqual(back.flatMap { $0.payload }.flatMap(WatchCommand.init(decoding:)), cmd)
        XCTAssertTrue(PropertyListSerialization.propertyList(e.dictionary, isValidFor: .binary))
    }

    func testAutoFlagDistinguishesNaturalRestEndFromManualSkip() {
        // 手机据 auto 决定撤不撤「休息结束」通知：自然到点不撤（正该此刻送达），手动提前要撤。
        let natural = WatchCommand(action: .restSkip, exerciseId: "squat", auto: true, sentAtISO: "t")
        let manual = WatchCommand(action: .restSkip, exerciseId: "squat", sentAtISO: "t")
        XCTAssertTrue(natural.encoded.flatMap(WatchCommand.init(decoding:))?.auto == true)
        XCTAssertFalse(manual.encoded.flatMap(WatchCommand.init(decoding:))?.auto == true)
    }

    func testSkipSetCarriesReasonAndSetNumberAndLegacyCommandsDecodeWithoutThem() {
        // v3.2：跳过本组带理由码 + 组号（幂等键）。旧表发来的命令没有这两位，也照样解出来。
        let skip = WatchCommand(action: .skipSet, exerciseId: "squat", sentAtISO: "t",
                                reason: "equipmentBusy", setNumber: 2)
        let back = skip.encoded.flatMap(WatchCommand.init(decoding:))
        XCTAssertEqual(back?.reason, "equipmentBusy")
        XCTAssertEqual(back?.setNumber, 2)
        let legacy = #"{"action":"restAdd30","exerciseId":"squat","auto":false,"sentAtISO":"t"}"#
        let old = WatchCommand(decoding: Data(legacy.utf8))
        XCTAssertEqual(old?.action, .restAdd30)
        XCTAssertNil(old?.reason); XCTAssertNil(old?.setNumber)
        XCTAssertEqual(WatchCommand(action: .restPauseToggle, exerciseId: "squat", sentAtISO: "t")
            .encoded.flatMap(WatchCommand.init(decoding:))?.action, .restPauseToggle)
    }

    func testUnknownActionFromANewerWatchDecodesToNilNotCrash() {
        // 向前兼容：更新的表可能发来手机还不认识的命令，安静丢弃。
        let future = #"{"action":"teleport","exerciseId":"squat","auto":false,"sentAtISO":"t"}"#
        XCTAssertNil(WatchCommand(decoding: Data(future.utf8)))
    }
}

// 切片 4 起的 active 载荷 + v2 的可调素材。版本不同步是常态（表 app 随手机 app 更新但不一定同刻），
// 所以每加一个字段都要钉一条「旧载荷仍解得出」。
final class WatchActivePayloadTests: XCTestCase {

    func testActiveSurvivesPrescriptionRoundTrip() {
        let rx = WatchPrescription(
            dateISO: "2026-08-15", dayTitle: "上肢", exercises: [],
            active: .init(exerciseId: "squat", exerciseName: "深蹲", setNumber: 1, setTotal: 3,
                          exerciseNumber: 1, exerciseTotal: 4, targetText: "80 kg × 5",
                          targetWeightKg: 80, targetReps: 5, targetRir: 2, isResting: true))
        XCTAssertEqual(rx.encoded.flatMap(WatchPrescription.init(decoding:)), rx)
    }

    func testOlderPayloadWithoutActiveStillDecodes() {
        // 表和手机版本可能不同步：表是旧版、手机推了带 active 的新载荷，反之亦然。
        // 少一个可选字段绝不能整份解不出来——那会让表变空白。
        let legacy = #"{"dateISO":"2026-08-15","dayTitle":"上肢","exercises":[]}"#
        let back = WatchPrescription(decoding: Data(legacy.utf8))
        XCTAssertEqual(back?.dateISO, "2026-08-15")
        XCTAssertNil(back?.active)
        XCTAssertNil(back?.localeCode)
        XCTAssertNil(back?.completedSetsToday)
    }

    func testCompletedSetsTodaySurvivesRoundTrip() {
        // v3.2：今天练完了 → 表上清单头显示「今天练完了 · N 组」。
        let rx = WatchPrescription(dateISO: "2026-08-16", dayTitle: "上肢", exercises: [], completedSetsToday: 22)
        XCTAssertEqual(rx.encoded.flatMap(WatchPrescription.init(decoding:))?.completedSetsToday, 22)
    }

    // MARK: - v2：表上可调三个量

    func testAdjustLadderAndLocaleSurviveRoundTrip() {
        let rx = WatchPrescription(
            dateISO: "2026-08-15", dayTitle: "上肢", exercises: [],
            active: .init(exerciseId: "squat", exerciseName: "深蹲", setNumber: 1, setTotal: 3,
                          exerciseNumber: 1, exerciseTotal: 4, targetText: "80 kg × 5",
                          targetWeightKg: 80, targetReps: 5, targetRir: 2, isResting: false,
                          adjust: .init(weightRungs: [.init(kg: 77.5, text: "77.5"),
                                                      .init(kg: 80, text: "80"),
                                                      .init(kg: 82.5, text: "82.5")],
                                        weightCaption: "kg")),
            localeCode: "zh")
        let back = rx.encoded.flatMap(WatchPrescription.init(decoding:))
        XCTAssertEqual(back, rx)
        XCTAssertEqual(back?.active?.adjust?.weightRungs.map(\.text), ["77.5", "80", "82.5"])
        XCTAssertEqual(back?.localeCode, "zh")
    }

    func testOlderActiveWithoutAdjustStillDecodes() {
        // 旧手机推的 active 没有 adjust——表必须照常显示、退回只调次数，不能整份作废。
        let legacy = #"""
        {"dateISO":"2026-08-15","dayTitle":"上肢","exercises":[],
         "active":{"exerciseId":"squat","exerciseName":"深蹲","setNumber":1,"setTotal":3,
                   "exerciseNumber":1,"exerciseTotal":4,"targetText":"80 kg × 5",
                   "targetWeightKg":80,"targetReps":5,"targetRir":2,"isResting":false,
                   "restTotalSeconds":0,"isWarmup":false}}
        """#
        let back = WatchPrescription(decoding: Data(legacy.utf8))
        XCTAssertEqual(back?.active?.exerciseId, "squat")
        XCTAssertNil(back?.active?.adjust)
    }

    func testRestPreviewTextIsOptionalAndSurvivesRoundTrip() {
        // v3：休息屏那一行由手机渲染；旧载荷没有它也照常解出（表退回「下一组 + 目标串」）。
        let withPreview = WatchPrescription.Active(
            exerciseId: "squat", exerciseName: "深蹲", setNumber: 3, setTotal: 3,
            exerciseNumber: 1, exerciseTotal: 4, targetText: "80 kg × 0",
            targetWeightKg: 80, targetReps: 0, targetRir: 2, isResting: true,
            restPreviewText: "接下来 · 高位下拉")
        let data = try? JSONEncoder().encode(withPreview)
        let back = data.flatMap { try? JSONDecoder().decode(WatchPrescription.Active.self, from: $0) }
        XCTAssertEqual(back?.restPreviewText, "接下来 · 高位下拉")
        let legacy = #"{"exerciseId":"squat","exerciseName":"深蹲","setNumber":1,"setTotal":3,"exerciseNumber":1,"exerciseTotal":4,"targetText":"80 kg × 5","targetWeightKg":80,"targetReps":5,"targetRir":2,"isResting":true,"restTotalSeconds":90,"isWarmup":false}"#
        XCTAssertNil((try? JSONDecoder().decode(WatchPrescription.Active.self, from: Data(legacy.utf8)))?.restPreviewText)
    }

    func testRepBasedExerciseHasNoWeightRungs() {
        // 自重 / 弹力带没有重量轴：空梯子是合法且有意义的，表上据此隐藏重量瓦片。
        let adjust = WatchPrescription.Adjust(weightRungs: [], weightCaption: "")
        let data = try? JSONEncoder().encode(adjust)
        let back = data.flatMap { try? JSONDecoder().decode(WatchPrescription.Adjust.self, from: $0) }
        XCTAssertEqual(back?.weightRungs.isEmpty, true)
    }
}
