// RedeTrainingDecision — package version constant.
//
// iOS-4B1 lands the TrainingDecision golden TYPE SKELETON in this package
// (Codable-style decode/encode for the 10 training-decision parity goldens).
// No engine logic — the decision algorithm port arrives in iOS-4B2+. This
// file holds only the version constant, matching the other local packages.

public enum RedeTrainingDecisionVersion {
    public static let value = "0.0.1-bootstrap"
}
