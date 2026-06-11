// ExerciseCatalog — 动作事实唯一权威（系统逻辑 §6.1；内容系统合同
// docs/REDE_EXERCISE_CONTENT_SYSTEM.md，P0 拍板 2026-06-11）。
//
// P0 内容系统基建：
// - 单一真源 = 包内 Resources/exercises.json（启动解码，零网络）；
//   31 条 1:1 自原硬编码数组迁移，golden 证明行为零变化。
// - 展示名（nameZh/nameEn）随规格原文「本地化展示名是动作事实」迁入目录；
//   RedeL10n 不再维护动作名字典。
// - 匹配去顺序化：filter → (rank, id) 升序取首——文件顺序不再是合同，
//   rank 才是。调 rank = 调产品行为，必须显式改 golden 留痕。
// - id 永生：只可 deprecated，不可删除（用户历史引用必须永远可解析）。
//
// 肌群贡献权重与禁忌提示 P0 仍缺席：按 §6.1 红线如实声明 limitation。
// 重量口径（系统逻辑 §153）：哑铃/单边 = 单只哑铃重量；杠铃 = 总杠重（含杆）；
// cable/machine = 配重片读数。

import Foundation

public struct ExerciseCatalogEntry: Equatable, Sendable, Codable {
    public let id: String
    /// 本地化展示名（动作事实，规格原文）。
    public let nameZh: String
    public let nameEn: String
    public let movementPattern: String
    public let primaryMuscle: String
    public let secondaryMuscles: [String]
    /// 器械注册表内取值（MVP：barbell / dumbbell / cable / machine）。
    public let equipment: String
    /// compound / machine / isolation（训练学角色，沿 legacy 词汇）
    public let kind: String
    public let substitutionGroup: String
    public let startWeightKg: Double
    /// 匹配优先级（升序）；匹配 = filter → (rank, id) 排序，与文件顺序无关。
    public let rank: Int
    /// 弃用不删除（id 永生合同）。
    public let deprecated: Bool

    public init(
        id: String, nameZh: String = "", nameEn: String = "",
        movementPattern: String, primaryMuscle: String,
        secondaryMuscles: [String] = [], equipment: String, kind: String,
        substitutionGroup: String, startWeightKg: Double,
        rank: Int, deprecated: Bool = false   // rank 无默认值：忘传=编译错（审查 M2）
    ) {
        self.id = id
        self.nameZh = nameZh
        self.nameEn = nameEn
        self.movementPattern = movementPattern
        self.primaryMuscle = primaryMuscle
        self.secondaryMuscles = secondaryMuscles
        self.equipment = equipment
        self.kind = kind
        self.substitutionGroup = substitutionGroup
        self.startWeightKg = startWeightKg
        self.rank = rank
        self.deprecated = deprecated
    }

    enum CodingKeys: String, CodingKey {
        case id, nameZh, nameEn, movementPattern, primaryMuscle, secondaryMuscles
        case equipment, kind, substitutionGroup, startWeightKg, rank, deprecated
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        nameZh = try c.decode(String.self, forKey: .nameZh)
        nameEn = try c.decode(String.self, forKey: .nameEn)
        movementPattern = try c.decode(String.self, forKey: .movementPattern)
        primaryMuscle = try c.decode(String.self, forKey: .primaryMuscle)
        secondaryMuscles = try c.decodeIfPresent([String].self, forKey: .secondaryMuscles) ?? []
        equipment = try c.decode(String.self, forKey: .equipment)
        kind = try c.decode(String.self, forKey: .kind)
        substitutionGroup = try c.decode(String.self, forKey: .substitutionGroup)
        startWeightKg = try c.decode(Double.self, forKey: .startWeightKg)
        rank = try c.decode(Int.self, forKey: .rank)
        deprecated = try c.decodeIfPresent(Bool.self, forKey: .deprecated) ?? false
    }
}

public struct ExerciseCatalog: Equatable, Sendable, Codable {
    public let catalogVersion: String
    public let exercises: [ExerciseCatalogEntry]

    /// 兼容旧 API 名（matching/tests 普遍使用 entries）。
    public var entries: [ExerciseCatalogEntry] { exercises }

    public init(catalogVersion: String, entries: [ExerciseCatalogEntry]) {
        self.catalogVersion = catalogVersion
        self.exercises = entries
    }

    public func entry(id: String) -> ExerciseCatalogEntry? {
        exercises.first { $0.id == id }
    }

    /// 本地化展示名（"zh" → nameZh，其余 → nameEn）；未知 id 回退裸 id（如实）。
    public func displayName(_ id: String, localeCode: String) -> String {
        guard let entry = entry(id: id) else { return id }
        let name = localeCode == "zh" ? entry.nameZh : entry.nameEn
        return name.isEmpty ? id : name
    }

    /// 单一真源：包内 exercises.json。解码失败 = 构建配置错误（CI 合同测试拦截），
    /// 不做静默回退——宁可炸在开发期，不给用户错目录。
    public static let minimal: ExerciseCatalog = {
        guard let url = Bundle.module.url(forResource: "exercises", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalog = try? JSONDecoder().decode(ExerciseCatalog.self, from: data)
        else {
            fatalError("exercises.json 缺失或解码失败——目录资源构建配置错误")
        }
        return catalog
    }()
}
