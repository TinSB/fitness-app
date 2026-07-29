/// FR-SE7 身体部位筛查的 canonical code 白名单。
///
/// 持久化仍使用既有 open-bag `userProfile.injuryFlags: [String]`，本类型只统一
/// DataHealth、写闸与 UI 的合法 code；不新增 schema 或第二真相源。
public enum InjuryFlag: String, CaseIterable, Equatable, Sendable, Codable {
    case knee
    case shoulder
    case lowerBack
    case elbow
    case wrist
    case ankle
    case neck
}
