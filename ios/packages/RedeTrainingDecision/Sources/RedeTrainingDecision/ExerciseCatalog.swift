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
    /// 器械注册表内取值（EquipmentRegistry.allClasses；MVP `machine` 为
    /// plate-loaded/selectorized 合并档，P1 拆分=原 id 原地改值，禁止换 id）。
    public let equipment: String
    /// 训练学角色：compound（主项复合）/ accessory（辅助容量）/ isolation（孤立）。
    /// Blocker schema PR（2026-06-11）：原第三档 "machine" 改名 accessory——
    /// 它承载的是角色语义（leg-press=辅助 vs hack-squat=主项），不是器械；
    /// 器械轨道稳定性独立成 isGuided。
    public let kind: String
    /// 替代族（§6.2 升一等公民 2026-06-11）：首元素 = 主族（引擎 P1 仅消费主族，
    /// 行为与单值时代等价）；副族留给替换候选扩展（填数据须 owner 审定）。
    public let substitutionGroups: [String]
    /// 兼容访问器：主族。
    public var substitutionGroup: String { substitutionGroups.first ?? "" }
    public let startWeightKg: Double
    /// 负重语义（§6.1 Blocker）：external / bodyweight / bodyweight-plus /
    /// assisted / band。非 external 条目在对应引擎支持落地前禁止进处方/替换
    /// （匹配与候选层硬过滤）——assisted 数字=辅助量、越大越轻，直接走现有
    /// 渐进/疼痛瀑布会方向反转（安全红线）。
    public let loadType: String
    /// 吨位换算系数（owner 拍板 B 案 2026-06-11）：吨位 = 重量×次数×loadFactor。
    /// 双哑铃动作（口径记单只）= 2；杠铃/绳索/器械（记总阻力）与单哑铃双手持 = 1。
    /// 仅作用于统计展示（小结/进展吨位）——处方/渐进重量永不乘它。
    public let loadFactor: Double
    /// 力学等价变体的共享渐进档案指针（§6.2 占位，默认 nil = 各自渐进）；引擎暂不消费。
    public let progressionKey: String?
    /// 器械轨道稳定（固定轨迹）；目录事实，引擎暂不消费（P1 校准/展示挂点）。
    public let isGuided: Bool
    /// 匹配优先级（升序）；匹配 = filter → (rank, id) 排序，与文件顺序无关。
    public let rank: Int
    /// 弃用不删除（id 永生合同）。
    public let deprecated: Bool
    /// 真弃用时的继任指针（渐进历史延续挂点，P1 占位）。
    public let replacedBy: String?
    /// 禁忌提示 / 证据置信标签（规格要求字段；P1 wave 填充落数据）。
    public let contraindicationHint: String?
    public let evidenceTag: String?
    /// FR-EX2 技术要点（双语自由 prose；缺 = 详情页不显示「技术要点」区块、零回归）。
    public let techniqueCuesZh: [String]?
    public let techniqueCuesEn: [String]?
    /// FR-EX2 循证来源 URL（与 evidenceTag 配对，已对抗核验真实可访问；缺 = 不显示链接）。
    public let evidenceUrl: String?

    public init(
        id: String, nameZh: String = "", nameEn: String = "",
        movementPattern: String, primaryMuscle: String,
        secondaryMuscles: [String] = [], equipment: String, kind: String,
        substitutionGroups: [String], startWeightKg: Double,
        loadType: String = "external",
        loadFactor: Double = 1.0, progressionKey: String? = nil,
        isGuided: Bool = false,
        rank: Int, deprecated: Bool = false,   // rank 无默认值：忘传=编译错（审查 M2）
        replacedBy: String? = nil,
        contraindicationHint: String? = nil, evidenceTag: String? = nil,
        techniqueCuesZh: [String]? = nil, techniqueCuesEn: [String]? = nil,
        evidenceUrl: String? = nil
    ) {
        self.id = id
        self.nameZh = nameZh
        self.nameEn = nameEn
        self.movementPattern = movementPattern
        self.primaryMuscle = primaryMuscle
        self.secondaryMuscles = secondaryMuscles
        self.equipment = equipment
        self.kind = kind
        self.substitutionGroups = substitutionGroups
        self.startWeightKg = startWeightKg
        self.loadType = loadType
        self.loadFactor = loadFactor
        self.progressionKey = progressionKey
        self.isGuided = isGuided
        self.rank = rank
        self.deprecated = deprecated
        self.replacedBy = replacedBy
        self.contraindicationHint = contraindicationHint
        self.evidenceTag = evidenceTag
        self.techniqueCuesZh = techniqueCuesZh
        self.techniqueCuesEn = techniqueCuesEn
        self.evidenceUrl = evidenceUrl
    }

    enum CodingKeys: String, CodingKey {
        case id, nameZh, nameEn, movementPattern, primaryMuscle, secondaryMuscles
        case equipment, kind, substitutionGroups, startWeightKg, rank, deprecated
        case loadType, loadFactor, progressionKey, isGuided, replacedBy
        case contraindicationHint, evidenceTag
        case techniqueCuesZh, techniqueCuesEn, evidenceUrl
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
        substitutionGroups = try c.decode([String].self, forKey: .substitutionGroups)
        startWeightKg = try c.decode(Double.self, forKey: .startWeightKg)
        // loadType / loadFactor 强制显式（内容事实不许靠默认值溜进目录，同 rank
        // 无默认值的 M2 教训）；步长已移交 LoadGrid（器械×单位）；其余可缺省。严格 decode 只作用于
        // 包内 exercises.json（唯一被解码的目录文件，与 bundle 同 PR 演进，无历史
        // 遗留文件需迁移）——缺字段=构建错误，fatal 于开发期（审查 M1 边界澄清）。
        loadType = try c.decode(String.self, forKey: .loadType)
        loadFactor = try c.decode(Double.self, forKey: .loadFactor)
        progressionKey = try c.decodeIfPresent(String.self, forKey: .progressionKey)
        isGuided = try c.decodeIfPresent(Bool.self, forKey: .isGuided) ?? false
        rank = try c.decode(Int.self, forKey: .rank)
        deprecated = try c.decodeIfPresent(Bool.self, forKey: .deprecated) ?? false
        replacedBy = try c.decodeIfPresent(String.self, forKey: .replacedBy)
        contraindicationHint = try c.decodeIfPresent(String.self, forKey: .contraindicationHint)
        evidenceTag = try c.decodeIfPresent(String.self, forKey: .evidenceTag)
        techniqueCuesZh = try c.decodeIfPresent([String].self, forKey: .techniqueCuesZh)
        techniqueCuesEn = try c.decodeIfPresent([String].self, forKey: .techniqueCuesEn)
        evidenceUrl = try c.decodeIfPresent(String.self, forKey: .evidenceUrl)
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
