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
