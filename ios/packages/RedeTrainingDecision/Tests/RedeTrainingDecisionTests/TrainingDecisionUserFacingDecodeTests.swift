// iOS-4B1 — userFacing surface decode tests (assertion 5 + surface coverage).

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionUserFacingDecodeTests: XCTestCase {
    private let expectedSurfaces = ["today", "plan", "training", "focus", "progress", "record", "explanation"]

    // (5) All 7 userFacing surfaces decode for every golden.
    func testAllSevenSurfacesDecodeForEveryGolden() throws {
        for id in TrainingDecisionGoldens.allIds {
            let d = try TrainingDecisionGoldens.decode(id)
            let uf = d.userFacing
            XCTAssertNotNil(uf.today, "\(id) today")
            XCTAssertNotNil(uf.plan, "\(id) plan")
            XCTAssertNotNil(uf.training, "\(id) training")
            XCTAssertNotNil(uf.focus, "\(id) focus")
            XCTAssertNotNil(uf.progress, "\(id) progress")
            XCTAssertNotNil(uf.record, "\(id) record")
            XCTAssertNotNil(uf.explanation, "\(id) explanation")
        }
    }

    // Each surface carries its surfaceId discriminator matching its key.
    func testEverySurfaceCarriesMatchingSurfaceId() throws {
        for id in TrainingDecisionGoldens.allIds {
            let d = try TrainingDecisionGoldens.decode(id)
            XCTAssertEqual(d.userFacing.today?.surfaceId, "today", "\(id)")
            XCTAssertEqual(d.userFacing.plan?.surfaceId, "plan", "\(id)")
            XCTAssertEqual(d.userFacing.training?.surfaceId, "training", "\(id)")
            XCTAssertEqual(d.userFacing.focus?.surfaceId, "focus", "\(id)")
            XCTAssertEqual(d.userFacing.progress?.surfaceId, "progress", "\(id)")
            XCTAssertEqual(d.userFacing.record?.surfaceId, "record", "\(id)")
            XCTAssertEqual(d.userFacing.explanation?.surfaceId, "explanation", "\(id)")
        }
    }

    // The common typed accessors (headline) resolve on the today surface.
    func testCommonSurfaceFieldsAreReadable() throws {
        let d = try TrainingDecisionGoldens.decode("severe-rest-v1")
        XCTAssertNotNil(d.userFacing.today?.headline)
        // micro open-bag is preserved (e.g. { phaseLabel }).
        XCTAssertNotNil(d.userFacing.today?.micro)
    }

    // severe-rest-v1's today surface carries the optional riskBadge open-bag
    // field (present in only 1/10 goldens) without breaking the other 9.
    func testOptionalRiskBadgeFieldCapturedWhenPresent() throws {
        let severe = try TrainingDecisionGoldens.decode("severe-rest-v1")
        XCTAssertNotNil(severe.userFacing.today?.field("riskBadge"),
                        "severe-rest today should carry riskBadge open-bag field")
        let normal = try TrainingDecisionGoldens.decode("normal-session-v1")
        XCTAssertNil(normal.userFacing.today?.field("riskBadge"))
    }
}
