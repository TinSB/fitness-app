// JSONFileAppDataStore — canonical AppData 的本地 JSON 文件存储
// （Master Architecture §6：每装机恰一份 canonical 文档，存于本地 JSON）。
//
// 原子性合同：Data.write(options: [.atomic]) —— 系统先写临时文件再原子换名，
// 进程中断不会留下半个文件。备份命名带可排序时间戳，同刻冲突用序号消歧。

import Foundation
import RedeDomain

public struct JSONFileAppDataStore: AppDataStore {
    public let fileURL: URL

    public init(fileURL: URL) {
        self.fileURL = fileURL
    }

    public func load() throws -> AppData? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        do {
            let data = try Data(contentsOf: fileURL)
            return try JSONDecoder().decode(AppData.self, from: data)
        } catch {
            throw AppDataStoreError.unreadable(underlying: error)
        }
    }

    public func save(_ appData: AppData) throws {
        do {
            let data = try JSONEncoder().encode(appData)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            throw AppDataStoreError.writeFailed(underlying: error)
        }
    }

    @discardableResult
    public func backupExisting() throws -> URL? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }

        let stamp = Self.backupTimestamp()
        let directory = fileURL.deletingLastPathComponent()
        let base = "\(fileURL.lastPathComponent).backup-\(stamp)"
        var backupURL = directory.appendingPathComponent(base, isDirectory: false)
        var disambiguator = 1
        while FileManager.default.fileExists(atPath: backupURL.path) {
            backupURL = directory.appendingPathComponent("\(base)-\(disambiguator)", isDirectory: false)
            disambiguator += 1
        }

        do {
            try FileManager.default.copyItem(at: fileURL, to: backupURL)
            return backupURL
        } catch {
            throw AppDataStoreError.backupFailed(underlying: error)
        }
    }

    /// 词法可排序时间戳（UTC），如 20260609-231530.123。
    private static func backupTimestamp() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyyMMdd-HHmmss.SSS"
        return formatter.string(from: Date())
    }
}
