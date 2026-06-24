// RedeHealthKit 纯层契约（FR-PR8 范围 A）。HKBodyWeightReader 是 #if os(iOS) 适配器、
// host 排除（同 RedeNotifications 的 UN 适配器不在 host 测）——这里覆盖值类型 + 协议 seam，
// 真机 HealthKit 读取靠 TestFlight（同通知"送达不可 host 验"先例）。
import XCTest
@testable import RedeHealthKit

final class RedeHealthKitTests: XCTestCase {

    /// 测试用假读取器（验证协议 seam 可被 app 以纯逻辑消费/替换）。
    private struct FakeReader: BodyWeightReading {
        let authorized: Bool
        let sample: BodyWeightSample?
        func requestReadAuthorization() async -> Bool { authorized }
        func latestBodyWeight() async -> BodyWeightSample? { authorized ? sample : nil }
    }

    func testBodyWeightSampleValue() {
        let s = BodyWeightSample(kg: 72.5, dateISO: "2026-06-24")
        XCTAssertEqual(s.kg, 72.5)
        XCTAssertEqual(s.dateISO, "2026-06-24")
        XCTAssertEqual(s, BodyWeightSample(kg: 72.5, dateISO: "2026-06-24"))
    }

    func testAuthorizedReaderReturnsSample() async {
        let reader: BodyWeightReading = FakeReader(authorized: true, sample: BodyWeightSample(kg: 70, dateISO: "2026-06-24"))
        let ok = await reader.requestReadAuthorization()
        XCTAssertTrue(ok)
        let s = await reader.latestBodyWeight()
        XCTAssertEqual(s?.kg, 70)
        XCTAssertEqual(s?.dateISO, "2026-06-24")
    }

    func testUnauthorizedReaderYieldsNil() async {
        let reader: BodyWeightReading = FakeReader(authorized: false, sample: BodyWeightSample(kg: 70, dateISO: "2026-06-24"))
        let ok = await reader.requestReadAuthorization()
        XCTAssertFalse(ok)
        let s = await reader.latestBodyWeight()
        XCTAssertNil(s, "未授权 → 无样本（app 据此显示未连接/无数据）")
    }

    func testAuthorizedButNoDataYieldsNil() async {
        let reader: BodyWeightReading = FakeReader(authorized: true, sample: nil)
        let ok = await reader.requestReadAuthorization()
        XCTAssertTrue(ok)
        let s = await reader.latestBodyWeight()
        XCTAssertNil(s, "已连接但 Apple 健康无体重 → nil（诚实显示无数据）")
    }
}
