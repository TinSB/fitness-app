// ReviewPromptPolicy 合同：守「只在用户获得价值后、每版本最多一次、失败读版本不打扰」。
// 这是评分请求节流的唯一真源，逐条钉死，避免将来改坏成「一装就弹 / 每场都弹」。

import XCTest
import RedeDomain

final class ReviewPromptPolicyTests: XCTestCase {

    private let policy = ReviewPromptPolicy(minimumCompletedSessions: 3)

    // MARK: 价值阈值

    func testBelowThresholdNeverAsks() {
        XCTAssertFalse(policy.shouldRequestReview(
            completedSessionCount: 0, lastRequestedVersion: nil, currentVersion: "1.9"))
        XCTAssertFalse(policy.shouldRequestReview(
            completedSessionCount: 2, lastRequestedVersion: nil, currentVersion: "1.9"))
    }

    func testAtThresholdFirstTimeAsks() {
        XCTAssertTrue(policy.shouldRequestReview(
            completedSessionCount: 3, lastRequestedVersion: nil, currentVersion: "1.9"))
    }

    func testAboveThresholdFirstTimeAsks() {
        XCTAssertTrue(policy.shouldRequestReview(
            completedSessionCount: 10, lastRequestedVersion: nil, currentVersion: "1.9"))
    }

    // MARK: 每版本一次

    func testAlreadyAskedThisVersionDoesNotAsk() {
        XCTAssertFalse(policy.shouldRequestReview(
            completedSessionCount: 10, lastRequestedVersion: "1.9", currentVersion: "1.9"))
    }

    func testAskedOnOlderVersionAsksAgain() {
        XCTAssertTrue(policy.shouldRequestReview(
            completedSessionCount: 10, lastRequestedVersion: "1.8", currentVersion: "1.9"))
    }

    // MARK: 防御

    func testEmptyCurrentVersionNeverAsks() {
        // Bundle 版本读取失败时绝不弹，即使阈值已满足。
        XCTAssertFalse(policy.shouldRequestReview(
            completedSessionCount: 10, lastRequestedVersion: nil, currentVersion: ""))
    }

    // MARK: 阈值边界与初始化

    func testThresholdBoundary() {
        let p = ReviewPromptPolicy(minimumCompletedSessions: 5)
        XCTAssertFalse(p.shouldRequestReview(
            completedSessionCount: 4, lastRequestedVersion: nil, currentVersion: "1.9"))
        XCTAssertTrue(p.shouldRequestReview(
            completedSessionCount: 5, lastRequestedVersion: nil, currentVersion: "1.9"))
    }

    func testInitClampsThresholdToAtLeastOne() {
        let p = ReviewPromptPolicy(minimumCompletedSessions: 0)
        XCTAssertEqual(p.minimumCompletedSessions, 1)
        XCTAssertFalse(p.shouldRequestReview(
            completedSessionCount: 0, lastRequestedVersion: nil, currentVersion: "1.9"))
        XCTAssertTrue(p.shouldRequestReview(
            completedSessionCount: 1, lastRequestedVersion: nil, currentVersion: "1.9"))
    }

    func testDefaultThresholdIsThree() {
        XCTAssertEqual(ReviewPromptPolicy().minimumCompletedSessions, 3)
    }
}
