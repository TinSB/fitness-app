import Foundation

/// A single contributor to the balance score observation.
///
/// This is a package-owned projection rather than canonical training data. Callers map the
/// already-derived muscle profile into these facts before evaluating the policy.
public struct BalanceImprovementContributor: Equatable, Sendable {
    public let id: String
    public let level: Int
    public let trend: MuscleLevelTrend
    public let confidence: EstimateConfidence

    public init(
        id: String,
        level: Int,
        trend: MuscleLevelTrend,
        confidence: EstimateConfidence
    ) {
        self.id = id
        self.level = level
        self.trend = trend
        self.confidence = confidence
    }
}

/// The current raw balance score and the independent-observation fingerprint used for
/// two-observation confirmation.
public struct BalanceImprovementObservation: Equatable, Sendable {
    public let score: Double
    public let completedSessionCount: Int
    public let contributors: [BalanceImprovementContributor]

    public init(
        score: Double,
        completedSessionCount: Int,
        contributors: [BalanceImprovementContributor]
    ) {
        self.score = score
        self.completedSessionCount = completedSessionCount
        self.contributors = contributors
    }
}

/// The stable comparison point. The contributor dictionary also fixes the comparable ID set.
public struct BalanceImprovementReference: Codable, Equatable, Sendable {
    public let score: Double
    public let levelsByContributorID: [String: Int]
    public let medianConfidence: EstimateConfidence

    public init(
        score: Double,
        levelsByContributorID: [String: Int],
        medianConfidence: EstimateConfidence
    ) {
        self.score = score
        self.levelsByContributorID = levelsByContributorID
        self.medianConfidence = medianConfidence
    }

    private enum CodingKeys: String, CodingKey {
        case score
        case levelsByContributorID
        case medianConfidenceRaw
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        score = try container.decode(Double.self, forKey: .score)
        levelsByContributorID = try container.decode(
            [String: Int].self,
            forKey: .levelsByContributorID
        )
        let rawValue = try container.decode(String.self, forKey: .medianConfidenceRaw)
        guard let confidence = EstimateConfidence(rawValue: rawValue) else {
            throw DecodingError.dataCorruptedError(
                forKey: .medianConfidenceRaw,
                in: container,
                debugDescription: "Unknown balance reference confidence: \(rawValue)"
            )
        }
        medianConfidence = confidence
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(score, forKey: .score)
        try container.encode(levelsByContributorID, forKey: .levelsByContributorID)
        try container.encode(medianConfidence.rawValue, forKey: .medianConfidenceRaw)
    }
}

/// A first qualifying observation waiting for a strictly newer completed-session count.
public struct BalanceImprovementCandidate: Codable, Equatable, Sendable {
    public let score: Double
    public let completedSessionCount: Int

    public init(score: Double, completedSessionCount: Int) {
        self.score = score
        self.completedSessionCount = completedSessionCount
    }
}

/// Persistable derived-only state. A missing reference means the next qualified observation seeds it.
public struct BalanceImprovementState: Codable, Equatable, Sendable {
    public let reference: BalanceImprovementReference?
    public let candidate: BalanceImprovementCandidate?

    public init(
        reference: BalanceImprovementReference? = nil,
        candidate: BalanceImprovementCandidate? = nil
    ) {
        self.reference = reference
        self.candidate = candidate
    }
}

/// Confirmed facts used to create a balance milestone and its share-card content.
public struct BalanceImprovementEvent: Equatable, Sendable {
    public let fromScore: Double
    public let toScore: Double
    public let directionIDs: [String]

    public init(fromScore: Double, toScore: Double, directionIDs: [String]) {
        self.fromScore = fromScore
        self.toScore = toScore
        self.directionIDs = directionIDs
    }
}

public struct BalanceImprovementPolicyResult: Equatable, Sendable {
    public let state: BalanceImprovementState
    public let confirmedEvent: BalanceImprovementEvent?

    public init(state: BalanceImprovementState, confirmedEvent: BalanceImprovementEvent?) {
        self.state = state
        self.confirmedEvent = confirmedEvent
    }
}

/// Stable-reference, two-independent-observation policy for balance improvements.
public enum BalanceImprovementPolicy {
    public static let minimumRawScoreDelta = 10.0
    public static let maximumDirectionCount = 2

    public static func evaluate(
        previousState: BalanceImprovementState,
        observation: BalanceImprovementObservation
    ) -> BalanceImprovementPolicyResult {
        // A stale projection cannot confirm, clear, or otherwise rewrite a newer candidate.
        if let candidate = previousState.candidate,
           observation.completedSessionCount < candidate.completedSessionCount {
            return BalanceImprovementPolicyResult(
                state: previousState,
                confirmedEvent: nil
            )
        }

        guard let facts = CurrentFacts(observation: observation) else {
            return BalanceImprovementPolicyResult(
                state: BalanceImprovementState(
                    reference: previousState.reference,
                    candidate: nil
                ),
                confirmedEvent: nil
            )
        }

        guard confidenceRank(facts.medianConfidence) >= confidenceRank(.medium) else {
            // A low-confidence current observation invalidates a pending confirmation, but it
            // cannot overwrite a previously qualified reference.
            return BalanceImprovementPolicyResult(
                state: BalanceImprovementState(
                    reference: qualifiedReference(previousState.reference),
                    candidate: nil
                ),
                confirmedEvent: nil
            )
        }

        guard let reference = qualifiedReference(previousState.reference) else {
            return BalanceImprovementPolicyResult(
                state: BalanceImprovementState(
                    reference: facts.makeReference(score: observation.score),
                    candidate: nil
                ),
                confirmedEvent: nil
            )
        }

        let referenceIDs = Set(reference.levelsByContributorID.keys)
        guard referenceIDs == facts.contributorIDs else {
            // A changed contributor population is a new score scale, not an improvement.
            return BalanceImprovementPolicyResult(
                state: BalanceImprovementState(
                    reference: facts.makeReference(score: observation.score),
                    candidate: nil
                ),
                confirmedEvent: nil
            )
        }

        if let candidate = previousState.candidate,
           observation.completedSessionCount == candidate.completedSessionCount {
            // Re-reading any of the app's consumers over the same completed-session state is
            // not an independent observation and cannot confirm or clear that candidate.
            return BalanceImprovementPolicyResult(
                state: previousState,
                confirmedEvent: nil
            )
        }

        if observation.score < reference.score {
            // Qualified trough tracking is the only non-event movement of a comparable reference.
            return BalanceImprovementPolicyResult(
                state: BalanceImprovementState(
                    reference: facts.makeReference(score: observation.score),
                    candidate: nil
                ),
                confirmedEvent: nil
            )
        }

        let directions = directionIDs(reference: reference, current: facts)
        let isEligible = observation.score - reference.score >= minimumRawScoreDelta
            && !directions.isEmpty

        if previousState.candidate != nil {
            guard isEligible else {
                // This is necessarily a newer completed-session observation because stale and
                // equal fingerprints returned above.
                return BalanceImprovementPolicyResult(
                    state: BalanceImprovementState(reference: reference, candidate: nil),
                    confirmedEvent: nil
                )
            }

            let event = BalanceImprovementEvent(
                fromScore: reference.score,
                toScore: observation.score,
                directionIDs: directions
            )
            return BalanceImprovementPolicyResult(
                state: BalanceImprovementState(
                    reference: facts.makeReference(score: observation.score),
                    candidate: nil
                ),
                confirmedEvent: event
            )
        }

        guard isEligible else {
            // Upward observations below the full contract keep the stable reference unchanged.
            return BalanceImprovementPolicyResult(
                state: BalanceImprovementState(reference: reference, candidate: nil),
                confirmedEvent: nil
            )
        }

        return BalanceImprovementPolicyResult(
            state: BalanceImprovementState(
                reference: reference,
                candidate: BalanceImprovementCandidate(
                    score: observation.score,
                    completedSessionCount: observation.completedSessionCount
                )
            ),
            confirmedEvent: nil
        )
    }

    private struct CurrentFacts {
        let contributorsByID: [String: BalanceImprovementContributor]
        let medianConfidence: EstimateConfidence

        init?(observation: BalanceImprovementObservation) {
            guard observation.score.isFinite,
                  observation.completedSessionCount >= 0,
                  !observation.contributors.isEmpty else {
                return nil
            }

            var indexed: [String: BalanceImprovementContributor] = [:]
            for contributor in observation.contributors {
                guard !contributor.id.isEmpty, indexed[contributor.id] == nil else {
                    return nil
                }
                indexed[contributor.id] = contributor
            }

            contributorsByID = indexed
            medianConfidence = BalanceImprovementPolicy.medianConfidence(
                observation.contributors.map(\.confidence)
            )
        }

        var contributorIDs: Set<String> {
            Set(contributorsByID.keys)
        }

        func makeReference(score: Double) -> BalanceImprovementReference {
            BalanceImprovementReference(
                score: score,
                levelsByContributorID: contributorsByID.mapValues(\.level),
                medianConfidence: medianConfidence
            )
        }
    }

    private static func qualifiedReference(
        _ reference: BalanceImprovementReference?
    ) -> BalanceImprovementReference? {
        guard let reference,
              reference.score.isFinite,
              !reference.levelsByContributorID.isEmpty,
              reference.levelsByContributorID.keys.allSatisfy({ !$0.isEmpty }),
              confidenceRank(reference.medianConfidence) >= confidenceRank(.medium) else {
            return nil
        }
        return reference
    }

    private static func directionIDs(
        reference: BalanceImprovementReference,
        current: CurrentFacts
    ) -> [String] {
        let sortedLevels = reference.levelsByContributorID.values.sorted()
        guard !sortedLevels.isEmpty else { return [] }
        let middle = sortedLevels.count / 2
        let medianLevel = sortedLevels.count.isMultiple(of: 2)
            ? Double(sortedLevels[middle - 1] + sortedLevels[middle]) / 2
            : Double(sortedLevels[middle])

        return current.contributorsByID.values
            .compactMap { contributor -> (id: String, increase: Int)? in
                guard let referenceLevel = reference.levelsByContributorID[contributor.id],
                      Double(referenceLevel) < medianLevel,
                      contributor.level > referenceLevel,
                      contributor.trend == .rising,
                      confidenceRank(contributor.confidence) >= confidenceRank(.medium) else {
                    return nil
                }
                return (contributor.id, contributor.level - referenceLevel)
            }
            .sorted {
                if $0.increase != $1.increase {
                    return $0.increase > $1.increase
                }
                return $0.id < $1.id
            }
            .prefix(maximumDirectionCount)
            .map(\.id)
    }

    private static func medianConfidence(
        _ values: [EstimateConfidence]
    ) -> EstimateConfidence {
        let ranked = values.map(confidenceRank).sorted()
        let medianRank = ranked[(ranked.count - 1) / 2]
        switch medianRank {
        case 2: return .high
        case 1: return .medium
        default: return .low
        }
    }

    private static func confidenceRank(_ confidence: EstimateConfidence) -> Int {
        switch confidence {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        }
    }
}
