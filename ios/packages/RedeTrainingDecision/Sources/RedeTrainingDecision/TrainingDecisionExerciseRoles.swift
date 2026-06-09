// iOS-4B5 Exercise Prescription + Volume Floor V1 — exercise role classification.
//
// Swift port of roleOf (retired-web-reference). PURE.
//
// IMPORTANT (verified against the goldens): roleOf runs its English-token regex on
// the LOWERCASED display NAME. The seed templates' names are Chinese (e.g. 平板卧推),
// so the regex never matches and BOTH push-a "compound" movements fall through to
// `secondary-compound` (NOT main-compound). machine -> accessory. This is distinct
// from prescribeExercise's `mainCompound` flag, which keys on orderPriority.

import Foundation

/// `ExerciseRole` (trainingDecisionTypes.ts:40).
public enum ExerciseRole: String, Equatable, Sendable {
    case mainCompound = "main-compound"
    case secondaryCompound = "secondary-compound"
    case accessory
    case isolation
}

enum TrainingDecisionExerciseRoles {
    /// roleOf (trainingDecisionEngine.ts:109). `kind`/`name` lowercased; the regex
    /// `/(bench|squat|deadlift|press|row|pull|chin|dip)/` is tested on the name.
    static func roleOf(kind: String?, name: String?) -> ExerciseRole {
        let k = (kind ?? "").lowercased()
        let n = (name ?? "").lowercased()
        if k == "compound" {
            return matchesMainCompoundName(n) ? .mainCompound : .secondaryCompound
        }
        if k == "machine" { return .accessory }
        if k == "isolation" { return .isolation }
        return .accessory
    }

    private static let mainCompoundTokens = ["bench", "squat", "deadlift", "press", "row", "pull", "chin", "dip"]

    private static func matchesMainCompoundName(_ lowercasedName: String) -> Bool {
        mainCompoundTokens.contains { lowercasedName.contains($0) }
    }
}
