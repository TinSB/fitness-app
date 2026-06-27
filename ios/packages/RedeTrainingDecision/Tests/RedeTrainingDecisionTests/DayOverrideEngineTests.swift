// FR-TR7「今天换一天练」引擎契约：plan() 的 dayCodeOverride（今日临时换训练日）+ rotationOffset（抵消临时
// 换天那场对「今天=序列[场次数%长度]」轮转的推进，使被跳过的日下一场补回）。默认 nil/0 = 现状（golden 零回归）。

import XCTest
@testable import RedeTrainingDecision

final class DayOverrideEngineTests: XCTestCase {
    // upper-lower：0 场历史 → 今天 = 序列[0%2] = upper。
    private let ulJSON = #"{"schemaVersion": 8, "programTemplate": {"splitType": "upper-lower", "daysPerWeek": 4}}"#

    private func dayCode(override: String? = nil, offset: Int = 0) throws -> String {
        let input = try TestSupport.makeInput(appDataJSON: ulJSON, todayISO: "2026-06-26")
        let verdict = TodayVerdictEngine.evaluate(input)
        let p = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input, verdict: verdict, dayCodeOverride: override, rotationOffset: offset))
        return p.dayCode
    }

    func testDefaultsEqualCurrentRotation() throws {
        XCTAssertEqual(try dayCode(), "upper", "默认 override=nil/offset=0 = 现状轮转（0 场 → 序列[0] = upper）")
    }

    func testDayCodeOverrideForcesValidDay() throws {
        XCTAssertEqual(try dayCode(override: "lower"), "lower", "今日临时覆盖合法成员 → 强制该日")
    }

    func testInvalidOverrideFallsBackToRotation() throws {
        XCTAssertEqual(try dayCode(override: "no-such-day"), "upper", "非本日序成员 → 优雅回退轮转，不崩")
    }

    func testRotationOffsetShiftsCursor() throws {
        // offset −1：序列[((0-1)%2+2)%2] = 序列[1] = lower（=临时换天后，下一场补回被跳过的日的机制）。
        XCTAssertEqual(try dayCode(offset: -1), "lower", "offset −1 把轮转游标回拨一格")
        XCTAssertEqual(try dayCode(offset: -2), "upper", "offset −2 回拨两格（负取模不崩、环绕正确）")
    }

    func testOverrideTakesPrecedenceOverOffset() throws {
        XCTAssertEqual(try dayCode(override: "upper", offset: -1), "upper", "今日覆盖优先于轮转/偏移")
    }
}
