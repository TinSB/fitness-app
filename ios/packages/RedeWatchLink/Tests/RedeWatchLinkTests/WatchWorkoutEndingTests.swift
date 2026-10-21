import XCTest
@testable import RedeWatchLink

// 表上体能训练怎么收尾（Master v3.10，owner 2026-10-20：「记过组就保存到最后一组为止，没练才丢弃；
// 系统停掉会话时保存已采集部分」）。
final class WatchWorkoutEndingTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)

    func testThePhonesOwnVerdictStillDecides() {
        XCTAssertEqual(WatchWorkoutEnding.decide(.completed, lastSetAt: nil, sessionStart: start), .save(endAt: nil),
                       "手机说练完了：写进健康，结束在此刻")
        XCTAssertEqual(WatchWorkoutEnding.decide(.abandoned, lastSetAt: start.addingTimeInterval(600), sessionStart: start),
                       .discard, "手机说放弃：什么都不存，健康里也不写")
    }

    func testWithoutThePhoneATrainedSessionIsSavedUpToTheLastSet() {
        // 手机在储物柜里 / app 被划掉：练了 40 分钟、最后一组在 40 分钟处，60 分钟后表自己收——
        // 写进健康、结束在最后一组（以前整场丢弃）。
        let lastSet = start.addingTimeInterval(40 * 60)
        XCTAssertEqual(WatchWorkoutEnding.decide(.unknown, lastSetAt: lastSet, sessionStart: start),
                       .save(endAt: lastSet))
    }

    func testWithoutThePhoneAnUntrainedSessionIsStillDiscarded() {
        // 一组都没记（开了就放下、被手机拉起后手机马上被划掉）：丢弃，不写一条空训练。
        XCTAssertEqual(WatchWorkoutEnding.decide(.unknown, lastSetAt: nil, sessionStart: start), .discard)
        // 最后一组在这场会话开始之前（属于会话之前）：这一场里没练过。
        XCTAssertEqual(WatchWorkoutEnding.decide(.unknown, lastSetAt: start.addingTimeInterval(-60), sessionStart: start),
                       .discard)
        // 没有会话：无从收起。
        XCTAssertEqual(WatchWorkoutEnding.decide(.unknown, lastSetAt: start, sessionStart: nil), .discard)
    }

    func testASystemStoppedSessionIsSavedUpToTheStopWhenTrained() {
        // 开了苹果自带的体能训练，系统把 Rede 这场停了：记过组就写到停的那一刻（数据一直采到那时）。
        let lastSet = start.addingTimeInterval(20 * 60)
        let stopped = start.addingTimeInterval(25 * 60)
        XCTAssertEqual(WatchWorkoutEnding.decide(.unknown, lastSetAt: lastSet, sessionStart: start, stoppedAt: stopped),
                       .save(endAt: stopped))
        XCTAssertEqual(WatchWorkoutEnding.decide(.unknown, lastSetAt: nil, sessionStart: start, stoppedAt: stopped),
                       .discard, "还没练就被停：丢弃")
    }

    func testTheLaterOfThePhoneAndWatchLastSetWins() {
        let phone = start.addingTimeInterval(600)
        let watch = start.addingTimeInterval(900)
        XCTAssertEqual(WatchWorkoutEnding.latest(phone, watch), watch)
        XCTAssertEqual(WatchWorkoutEnding.latest(phone, nil), phone)
        XCTAssertEqual(WatchWorkoutEnding.latest(nil, watch), watch)
        XCTAssertNil(WatchWorkoutEnding.latest(nil, nil))
    }

    func testLastSetLoggedAtIsOptionalForOldPhonesAndSurvivesRoundTrip() throws {
        let rx = WatchPrescription(dateISO: "2026-10-20", dayTitle: "拉 A", exercises: [], trainingInProgress: true,
                                   lastSetLoggedAt: start)
        let back = try XCTUnwrap(WatchPrescription(decoding: XCTUnwrap(rx.encoded)))
        XCTAssertEqual(back.lastSetLoggedAt, start)
        let legacy = #"{"dateISO":"2026-10-20","dayTitle":"","exercises":[],"trainingInProgress":true}"#
        XCTAssertNil(try XCTUnwrap(WatchPrescription(decoding: Data(legacy.utf8))).lastSetLoggedAt, "旧手机不带这一位")
    }
}
