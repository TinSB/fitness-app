// AppDataStore — canonical AppData 的存取合同。
//
// load 的三态必须分明：nil = 还没有数据（首写引导）；AppData = 可读；
// 抛 .unreadable = 磁盘上有用户数据但读不懂——此时任何写入都被禁止
// （系统逻辑 §5：不覆盖 unreadable user data）。

import Foundation
import RedeDomain

public enum AppDataStoreError: Error {
    /// 文件存在但无法解码——是用户数据，绝不覆盖。
    case unreadable(underlying: Error)
    case writeFailed(underlying: Error)
    case backupFailed(underlying: Error)
}

public protocol AppDataStore {
    /// nil 表示尚无 canonical 文档（合法的首写前状态）。
    func load() throws -> AppData?
    /// 原子写入。不负责备份——备份由写闸在 save 前显式编排。
    func save(_ appData: AppData) throws
    /// 把当前磁盘版本复制为带时间戳的备份；无文件时返回 nil。
    @discardableResult
    func backupExisting() throws -> URL?
}
