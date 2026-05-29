// iOS-4B5 Exercise Prescription + Volume Floor V1 — role / kind volume floors.
//
// Swift port of ROLE_FLOORS_NORMAL / ROLE_FLOORS_REENTRY (trainingDecisionEngine.ts:82-94),
// the intent-based floor selection (line 1937-1938), and the per-kind floors
// (kindFloors, line 1941-1945) that applyStatusRules consumes. PURE.
//
// Two distinct floor maps, derived from the same source but keyed differently:
//   * exerciseRoleFloors — the 4-key ExerciseRole map (the golden `exerciseRoleFloors`
//     field + the OUTER workingSetTargets floor, trainingDecisionEngine.ts:1976).
//   * kindFloors — the 3-key {compound, machine, isolation} map applyStatusRules uses
//     for its IN-ENGINE floor (exercisePrescriptionEngine.ts:380-387, 688-701).

import Foundation

enum TrainingDecisionRoleFloors {
    /// ROLE_FLOORS_NORMAL (trainingDecisionEngine.ts:82) — all 1.
    static let normal: [ExerciseRole: Int] = [
        .mainCompound: 1, .secondaryCompound: 1, .accessory: 1, .isolation: 1,
    ]
    /// ROLE_FLOORS_REENTRY (trainingDecisionEngine.ts:89) — compounds 2, rest 1.
    static let reentry: [ExerciseRole: Int] = [
        .mainCompound: 2, .secondaryCompound: 2, .accessory: 1, .isolation: 1,
    ]

    /// exerciseRoleFloors (trainingDecisionEngine.ts:1937): reentry-productive -> REENTRY.
    static func exerciseRoleFloors(intent: SessionIntent) -> [ExerciseRole: Int] {
        intent == .reentryProductive ? reentry : normal
    }

    /// kindFloors (trainingDecisionEngine.ts:1941): compound = max(main, secondary),
    /// machine = accessory, isolation = isolation.
    struct KindFloors: Equatable { let compound: Int; let machine: Int; let isolation: Int }

    static func kindFloors(_ roleFloors: [ExerciseRole: Int]) -> KindFloors {
        KindFloors(
            compound: max(roleFloors[.mainCompound] ?? 1, roleFloors[.secondaryCompound] ?? 1),
            machine: roleFloors[.accessory] ?? 1,
            isolation: roleFloors[.isolation] ?? 1
        )
    }

    /// setFloorForKind / floorOf (exercisePrescriptionEngine.ts:380-387, 691-695):
    /// the per-kind floor used inside applyStatusRules. Unknown kinds floor to 1.
    static func floor(for kind: String, _ floors: KindFloors) -> Int {
        if kind == "compound" { return floors.compound }
        if kind == "machine" { return floors.machine }
        if kind == "isolation" { return floors.isolation }
        return 1
    }
}
