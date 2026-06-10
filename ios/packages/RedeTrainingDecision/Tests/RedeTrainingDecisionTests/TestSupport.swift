import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

enum TestSupport {
    static func fixtureURL(_ name: String) -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
            .appendingPathComponent(name)
    }

    /// 由 AppData JSON 走完整读路径（DataHealth 投影 → branded input）。
    static func makeInput(appDataJSON: String, todayISO: String) throws -> CleanTrainingDecisionInput {
        let appData = try JSONDecoder().decode(AppData.self, from: Data(appDataJSON.utf8))
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        return try CleanTrainingDecisionInput.make(from: cleanView, todayISO: todayISO)
    }

    /// 生成 history JSON：每个日期一条最小完成 session（squat 100×5 @rir 2，可覆写 rir）。
    static func historyJSON(dates: [String], rir: String = "2") -> String {
        let sessions = dates.enumerated().map { index, date in
            #"{"id": "s\#(index)", "date": "\#(date)", "completed": true, "exercises": [{"exerciseId": "squat", "sets": [{"weight": 100, "reps": 5, "rir": \#(rir)}]}]}"#
        }
        return "[" + sessions.joined(separator: ",") + "]"
    }

    static func appDataJSON(historyDates: [String], rir: String = "2", program: String? = nil) -> String {
        var parts = ["\"schemaVersion\": 8", "\"history\": \(historyJSON(dates: historyDates, rir: rir))"]
        if let program { parts.append("\"programTemplate\": \(program)") }
        return "{" + parts.joined(separator: ", ") + "}"
    }
}
