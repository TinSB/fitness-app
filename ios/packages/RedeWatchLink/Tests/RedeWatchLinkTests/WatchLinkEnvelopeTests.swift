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
