// iOS-4B1 — stable TrainingDecision enums. These mirror the locked TS string
// unions for typed inspection. The decoded `TrainingDecision` stores these as
// raw `String` fields (so a future TS-added enum value never breaks decode)
// and exposes computed enum accessors for callers/tests that want the typed
// form. No engine logic — these are pure value enums.

import Foundation

/// `decisionVersion` literal. The current engine only emits `v2`.
public enum DecisionVersion: String, CaseIterable, Equatable, Sendable {
    case v2
}

/// `sessionIntent` — the 5 locked TS intents.
public enum SessionIntent: String, CaseIterable, Equatable, Sendable {
    case normalSession = "normal-session"
    case reentryProductive = "reentry-productive"
    case controlledReload = "controlled-reload"
    case deloadWeek = "deload-week"
    case severeRest = "severe-rest"
}

/// `activePhase` — the 6 locked TS effective phases.
public enum ActivePhase: String, CaseIterable, Equatable, Sendable {
    case base
    case build
    case overload
    case deload
    case reentry
    case restart
}

/// `riskLevel` — the 5 locked TS risk levels.
public enum RiskLevel: String, CaseIterable, Equatable, Sendable {
    case none
    case low
    case moderate
    case high
    case severe
}

/// `volumeMode` — the 5 locked TS volume modes.
public enum VolumeMode: String, CaseIterable, Equatable, Sendable {
    case expand
    case hold
    case trim
    case reentryFloor = "reentry-floor"
    case severeCut = "severe-cut"
}

/// `intensityMode` — the locked TS intensity modes.
public enum IntensityMode: String, CaseIterable, Equatable, Sendable {
    case expand
    case hold
    case cap
    case cut
}

/// `progressionMode` — the locked TS progression modes.
public enum ProgressionMode: String, CaseIterable, Equatable, Sendable {
    case progress
    case hold
    case pullBack = "pull-back"
    case reload
}
