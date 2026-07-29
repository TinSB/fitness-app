import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct InjuryAcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class InjuryFlagsWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-injury-flags-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(
            store: JSONFileAppDataStore(fileURL: fileURL),
            gate: InjuryAcceptAllGate()
        )
    }

    func testWritesSelectedFlagsAndClearsToEmptyArrayThroughCanonicalWriter() throws {
        let existing = #"""
        {"schemaVersion":8,"futureKey":1,
         "userProfile":{"name":"样例","unitSystem":"lb"}}
        """#
        try Data(existing.utf8).write(to: fileURL)

        let selected = try makeWriter().applyInjuryFlags(["wrist", "knee", "wrist", "shoulder"])
        XCTAssertEqual(
            selected.userProfile.injuryFlags,
            ["knee", "shoulder", "wrist"],
            "写闸按 InjuryFlag 固定顺序去重"
        )
        XCTAssertEqual(selected.userProfile.name, "样例")
        XCTAssertEqual(selected.userProfile.unitSystem, "lb")
        XCTAssertEqual(selected.storage["futureKey"]?.asInt, 1)

        let cleared = try makeWriter().applyInjuryFlags([])
        XCTAssertEqual(cleared.userProfile.injuryFlags, [])
        XCTAssertEqual(
            cleared.storage["userProfile"]?.asObject?["injuryFlags"],
            .array([])
        )

        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.userProfile.injuryFlags, [])
    }

    func testRejectsUnknownFlagWithoutChangingExistingBytes() throws {
        let existing = #"{"schemaVersion":8,"userProfile":{"injuryFlags":["knee"]}}"#
        try Data(existing.utf8).write(to: fileURL)
        let before = try Data(contentsOf: fileURL)

        XCTAssertThrowsError(try makeWriter().applyInjuryFlags(["knee", "space-knee"])) { error in
            XCTAssertEqual(
                error as? ScreeningWriteError,
                .unknownInjuryFlag("space-knee")
            )
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), before)
    }

    func testRejectsNonObjectUserProfileWithoutChangingExistingBytes() throws {
        for rawProfile in [#""legacy-profile""#, #"[{"legacy":true}]"#] {
            let existing = #"{"schemaVersion":8,"userProfile":\#(rawProfile)}"#
            try Data(existing.utf8).write(to: fileURL)
            let before = try Data(contentsOf: fileURL)

            XCTAssertThrowsError(
                try makeWriter().applyInjuryFlags(["knee"]),
                "非 object userProfile 必须诚实失败：\(rawProfile)"
            ) { error in
                XCTAssertEqual(error as? ScreeningWriteError, .profileNotObject)
            }
            XCTAssertEqual(
                try Data(contentsOf: fileURL),
                before,
                "失败不得覆盖或重写既有 userProfile：\(rawProfile)"
            )
        }
    }
}
