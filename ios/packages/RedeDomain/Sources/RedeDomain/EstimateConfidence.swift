// EstimateConfidence — PA-S1 PA Domain Types V1.
//
// Mirrors the legacy web implementation `EstimateConfidence` union at
// `retired web reference` (`'low' | 'medium' | 'high'`).
// A frozen, closed three-value confidence band shared by the PA
// (Plan-Adaptive) recommendation / draft / preview types.
//
// Closed enum (same paradigm as `WeightUnit`): callers that decode a
// `confidence` FIELD use the lossless "extracted-set" pattern (only
// promote the key out of `_unknown` when the raw token parses cleanly),
// so an unrecognised future token round-trips verbatim from the open
// bag rather than being silently dropped.

import Foundation

public enum EstimateConfidence: String, Codable, CaseIterable, Equatable, Hashable, Sendable {
    case low
    case medium
    case high
}
