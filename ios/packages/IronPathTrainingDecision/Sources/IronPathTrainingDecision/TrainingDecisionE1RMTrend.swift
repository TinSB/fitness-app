// iOS-4B3 Readiness + e1RM Slice V1 — e1RM trend.
//
// Swift port of isE1rmTrendUp (retired-web-reference). This is
// the OTHER input (besides recoveryHigh) the controlled-reload sessionIntent branch
// needs. PURE — reads only history exercise set weights. No clock, no AppData.
//
// Logic (verbatim): need >= 4 completed sessions; collect each exercise's top set
// weight (> 0) across all completed sessions; need >= 4 such tops; trend is up when
// the mean of the last 3 tops exceeds the mean of the rest.

import Foundation
import IronPathDomain

enum TrainingDecisionE1RMTrend {
    static func isE1rmTrendUp(history: [TrainingSession]) -> Bool {
        if history.count < 4 { return false }

        var tops: [Double] = []
        for session in history {
            if session.completed == false { continue }
            for exercise in session.exercises ?? [] {
                let sets = exercise.sets ?? []
                let top = sets
                    .map { setWeight($0) }
                    .reduce(0.0) { Swift.max($0, $1) }
                if top > 0 { tops.append(top) }
            }
        }

        if tops.count < 4 { return false }
        let recentSlice = tops.suffix(3)
        let recent = recentSlice.reduce(0.0, +) / 3.0
        let olderSlice = tops.prefix(tops.count - 3)
        let older = olderSlice.reduce(0.0, +) / Double(Swift.max(1, tops.count - 3))
        return recent > older
    }

    /// `Number(set.weight) || 0` — read the NumberRepr weight as Double, 0 when absent.
    private static func setWeight(_ set: TrainingSetLog) -> Double {
        set.weight?.doubleValue ?? 0
    }
}
