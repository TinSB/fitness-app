// WeightUnit — iOS-2B AppData Swift Models V1.
//
// Display unit only. Storage is always kilograms — see Contract
// Freeze §8 and Agent 5 §3.6. Model layer never coerces between
// units; the iOS-5+ view layer formats values for display.

import Foundation

public enum WeightUnit: String, Codable, CaseIterable, Equatable, Hashable, Sendable {
    case kg
    case lb
}
