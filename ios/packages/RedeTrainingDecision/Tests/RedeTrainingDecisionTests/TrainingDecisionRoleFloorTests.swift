// iOS-4B5 — roleOf + role/kind floor unit tests. Drives the pure helpers via @testable.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionRoleFloorTests: XCTestCase {

    // MARK: - roleOf (English regex on the LOWERCASED name)

    func test_roleOf_chinese_compound_falls_through_to_secondary() {
        // The seed-template Chinese names never match the English token regex.
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "compound", name: "平板卧推"), .secondaryCompound)
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "compound", name: "上斜哑铃卧推"), .secondaryCompound)
    }

    func test_roleOf_english_compound_token_is_main_compound() {
        // An English name containing a token DOES classify as main-compound.
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "compound", name: "Barbell Bench Press"), .mainCompound)
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "compound", name: "Back SQUAT"), .mainCompound) // lowercased
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "compound", name: "Pendlay row"), .mainCompound)
    }

    func test_roleOf_machine_isolation_default() {
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "machine", name: "器械推胸"), .accessory)
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "isolation", name: "哑铃侧平举"), .isolation)
        XCTAssertEqual(TrainingDecisionExerciseRoles.roleOf(kind: "barbell", name: "something"), .accessory) // unknown kind
    }

    // MARK: - ROLE_FLOORS + exerciseRoleFloors + kindFloors

    func test_role_floors_constants() {
        XCTAssertEqual(TrainingDecisionRoleFloors.normal, [.mainCompound: 1, .secondaryCompound: 1, .accessory: 1, .isolation: 1])
        XCTAssertEqual(TrainingDecisionRoleFloors.reentry, [.mainCompound: 2, .secondaryCompound: 2, .accessory: 1, .isolation: 1])
    }

    func test_exerciseRoleFloors_by_intent() {
        XCTAssertEqual(TrainingDecisionRoleFloors.exerciseRoleFloors(intent: .reentryProductive), TrainingDecisionRoleFloors.reentry)
        for intent in [SessionIntent.normalSession, .controlledReload, .deloadWeek, .severeRest] {
            XCTAssertEqual(TrainingDecisionRoleFloors.exerciseRoleFloors(intent: intent), TrainingDecisionRoleFloors.normal)
        }
    }

    func test_kindFloors_derivation() {
        let n = TrainingDecisionRoleFloors.kindFloors(TrainingDecisionRoleFloors.normal)
        XCTAssertEqual(n, .init(compound: 1, machine: 1, isolation: 1))
        let r = TrainingDecisionRoleFloors.kindFloors(TrainingDecisionRoleFloors.reentry)
        XCTAssertEqual(r, .init(compound: 2, machine: 1, isolation: 1)) // compound = max(main 2, secondary 2)
        XCTAssertEqual(TrainingDecisionRoleFloors.floor(for: "compound", r), 2)
        XCTAssertEqual(TrainingDecisionRoleFloors.floor(for: "machine", r), 1)
        XCTAssertEqual(TrainingDecisionRoleFloors.floor(for: "isolation", r), 1)
        XCTAssertEqual(TrainingDecisionRoleFloors.floor(for: "barbell", r), 1) // unknown -> 1
    }
}
