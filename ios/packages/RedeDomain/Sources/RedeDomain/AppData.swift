// AppData — 本地 JSON canonical source of truth 的内存形态（系统逻辑 §3/§4）。
//
// 设计：storage 把解码到的整棵 JSON 对象 verbatim 持有（open-bag preserving——
// 未知字段在任何层级都不丢）；MVP 子集（profile / program / 完成训练 / logged sets)
// 是 storage 之上的类型化只读视图。编码即原样回写 storage，往返无损由构造保证。
//
// 这是唯一的模型（M1-1 边界：不引入第二套）。变更语义不在本层——canonical 写入
// 必须经 M1-2 的 gated writer（系统逻辑 §1 唯一写闸）。

public struct AppData: Equatable, Sendable {
    public enum DecodingFailure: Error, Equatable {
        case rootNotAnObject
    }

    /// 整棵 JSON 对象，含全部未知字段，verbatim。
    public let storage: [String: JSONValue]
    public let schemaVersion: Int

    public init(decoding value: JSONValue) throws {
        guard let object = value.asObject else { throw DecodingFailure.rootNotAnObject }
        // 迁移**先于** validate（系统逻辑 §3/§6.5）：decode 是唯一反序列化边界，旧版 root 在此
        // 升级到 current 再校验。纯内存、纯加性、不碰磁盘——磁盘只由已备份的写闸改写（schema-migration-guard）。
        let migrated = SchemaMigrator.migrate(root: object)
        self.schemaVersion = try SchemaVersion.validate(root: migrated)
        self.storage = migrated
    }

    // MARK: MVP 类型化只读视图

    /// 完成训练历史。非对象元素在视图中跳过，但在 storage 中原样保留。
    public var history: [TrainingSession] {
        guard let array = storage["history"]?.asArray else { return [] }
        return array.compactMap { element in
            element.asObject.map(TrainingSession.init(storage:))
        }
    }

    public var userProfile: UserProfile {
        UserProfile(storage: storage["userProfile"]?.asObject ?? [:])
    }

    public var programTemplate: ProgramTemplate {
        ProgramTemplate(storage: storage["programTemplate"]?.asObject ?? [:])
    }

    /// 周期化引擎配置（系统逻辑 §6.5，schema 9 落库）。字段缺失 → 安全默认（关闭、4 周块、无锚点）。
    public var mesocycle: MesocycleConfig {
        let obj = storage["mesocycle"]?.asObject ?? [:]
        return MesocycleConfig(
            enabled: obj["enabled"]?.asBool ?? false,
            // 默认 4 周（语义同 RedeTrainingDecision.Mesocycle.defaultBlockLengthWeeks；
            // 跨包不引入耦合，故在域层内联此常量）。
            blockLengthWeeks: obj["blockLengthWeeks"]?.asInt ?? 4,
            blockStartISO: obj["blockStartISO"]?.asString
        )
    }

    /// FR-NT1 休息结束提醒偏好（open-bag 加性，缺=关；不 seed、无 schema bump）。授权态由系统持有、不落库。
    public var notificationRestEndEnabled: Bool {
        storage["notifications"]?.asObject?["restEndEnabled"]?.asBool ?? false
    }

    /// FR-NT2 每周训练提醒偏好（同上；UI/调度接线见后续 slice）。
    public var notificationWeeklyEnabled: Bool {
        storage["notifications"]?.asObject?["weeklyEnabled"]?.asBool ?? false
    }

    /// FR-PL3/4 已采纳的计划调整记录（open-bag 加性，缺=无；不 seed、无 schema bump）。
    /// 单条最近一次（无栈）；`fromDaysPerWeek` 供 FR-PL4 单步回滚恢复，UI 据此显示「可撤」。
    public var planAdjustment: PlanAdjustmentRecord? {
        guard let obj = storage["planAdjustment"]?.asObject,
              let kind = obj["kind"]?.asString,
              let from = obj["fromDaysPerWeek"]?.asInt,
              let to = obj["toDaysPerWeek"]?.asInt else { return nil }
        return PlanAdjustmentRecord(kind: kind, fromDaysPerWeek: from, toDaysPerWeek: to)
    }

    /// FR-T5 换动作前瞻覆盖（schema 11）：originalId → actualId 的只读映射。
    /// 缺容器/非字符串值跳过；空 = 无覆盖（schema 10 及更早天然空，零行为回归）。
    public var exerciseSubstitutions: [String: String] {
        guard let obj = storage["exerciseSubstitutions"]?.asObject else { return [:] }
        return obj.compactMapValues { $0.asString }
    }

    /// FR-TR6「只换这次」临时换动作（open-bag 加性，缺=空；不 bump schema、不 seed）：
    /// originalId → {actualId, dateISO}。只对 dateISO == 当天有效，次日由 app 层按今日过滤后自动失效。
    /// 缺容器/缺字段/空串跳过（防御读）。空 = 无临时覆盖（旧库天然空，零行为回归）。
    public var oneTimeSubstitutions: [String: OneTimeSubstitution] {
        guard let obj = storage["oneTimeSubstitutions"]?.asObject else { return [:] }
        var out: [String: OneTimeSubstitution] = [:]
        for (originalId, value) in obj {
            guard !originalId.isEmpty,
                  let o = value.asObject,
                  let actualId = o["actualId"]?.asString, !actualId.isEmpty,
                  let dateISO = o["dateISO"]?.asString, !dateISO.isEmpty
            else { continue }
            out[originalId] = OneTimeSubstitution(actualId: actualId, dateISO: dateISO)
        }
        return out
    }

    /// FR-TR7「今天换一天练」临时训练日覆盖（open-bag 加性，缺=nil；不 bump schema）：
    /// {dayCode, dateISO}。只对 dateISO == 当天有效，今天的处方用该 dayCode 而非轮转默认；次日 app 层按今日过滤后失效。
    /// 缺容器/缺字段/空串 → nil（防御读）。
    public var oneTimeDayOverride: OneTimeDayOverride? {
        guard let o = storage["oneTimeDayOverride"]?.asObject,
              let dayCode = o["dayCode"]?.asString, !dayCode.isEmpty,
              let dateISO = o["dateISO"]?.asString, !dateISO.isEmpty
        else { return nil }
        return OneTimeDayOverride(dayCode: dayCode, dateISO: dateISO)
    }

    /// FR-TR7 轮转场次偏移（open-bag 加性，缺=0；不 bump schema）：临时换天那次完成时 −1，抵消该场次对
    /// 「今天=序列[场次数%长度]」轮转的推进，使被跳过的训练日下一场自动补回。缺/非整数 → 0（零行为回归）。
    public var rotationOffset: Int {
        storage["rotationOffset"]?.asInt ?? 0
    }

    /// FR-T5 已采纳补量的 ISO 周集合（schema 11）。缺容器/内层 → 空（防御读，审查 M-1）。
    public var volumeBoostWeeks: [String] {
        guard let arr = storage["coachAdjustments"]?.asObject?["volumeBoosts"]?.asArray else { return [] }
        return arr.compactMap { $0.asObject?["weekStartISO"]?.asString }
    }

    /// FR-T5 教练动作 dismiss 计数（schema 11）：actionKey → 累计 dismiss 次数（喂降频）。
    /// 缺容器/内层 → 空（防御读，审查 M-1）。
    public var coachDismissals: [String: Int] {
        guard let arr = storage["coachState"]?.asObject?["dismissed"]?.asArray else { return [:] }
        var out: [String: Int] = [:]
        for element in arr {
            if let key = element.asObject?["actionKey"]?.asString {
                out[key] = element.asObject?["count"]?.asInt ?? 0
            }
        }
        return out
    }

    /// FR-PL6/PL7 用户自定义训练计划（open-bag 加性，缺=nil；不 seed、无 schema bump）。
    /// 每日动作覆盖（有序=训练顺序）+ 可选自定义日序。本层只做**结构**防御读（缺容器/脏 item 跳过、
    /// 空清单的日丢弃、全空→nil）；**合法性**（exerciseId∈catalog、数值范围、日序须为默认日序排列）
    /// 由 RedeDataHealth/app 层 clean view 校验并优雅降级（Master §8：raw 不直接进引擎）。
    public var planCustomization: PlanCustomization? {
        guard let obj = storage["planCustomization"]?.asObject else { return nil }
        var dayPlans: [String: CustomDayPlan] = [:]
        if let dp = obj["dayPlans"]?.asObject {
            for (dayCode, value) in dp {
                guard !dayCode.isEmpty, let arr = value.asObject?["exercises"]?.asArray else { continue }
                let items: [CustomExerciseItem] = arr.compactMap { element in
                    guard let o = element.asObject,
                          let id = o["exerciseId"]?.asString, !id.isEmpty else { return nil }
                    return CustomExerciseItem(
                        exerciseId: id,
                        sets: o["sets"]?.asInt,
                        repMin: o["repMin"]?.asInt,
                        repMax: o["repMax"]?.asInt,
                        rest: o["rest"]?.asInt,
                        crossFamily: o["crossFamily"]?.asBool ?? false
                    )
                }
                if !items.isEmpty { dayPlans[dayCode] = CustomDayPlan(exercises: items) }
            }
        }
        let rawSequence = obj["daySequence"]?.asArray?.compactMap { $0.asString }
        let daySequence = (rawSequence?.isEmpty == false) ? rawSequence : nil
        // 全空（无任何当日覆盖且无自定义日序）→ 视为无自定义（与缺容器同义）。
        if dayPlans.isEmpty && daySequence == nil { return nil }
        return PlanCustomization(dayPlans: dayPlans, daySequence: daySequence)
    }
}

/// 顶层 `mesocycle` 的类型化只读视图（不存"当前第几周"——相位永远从 blockStartISO + 今日现算）。
/// FR-PL3/4 已采纳计划调整的类型化只读记录（canonical，open-bag 落库）。引擎提案类型在
/// RedeTrainingDecision，本记录是域层落库镜像（plain 字段、不跨包依赖）。
public struct PlanAdjustmentRecord: Equatable, Sendable {
    public let kind: String            // 如 "reduceFrequency"
    public let fromDaysPerWeek: Int    // 采纳前周计划天数（FR-PL4 回滚恢复用）
    public let toDaysPerWeek: Int      // 采纳后周计划天数
    public init(kind: String, fromDaysPerWeek: Int, toDaysPerWeek: Int) {
        self.kind = kind
        self.fromDaysPerWeek = fromDaysPerWeek
        self.toDaysPerWeek = toDaysPerWeek
    }
}

/// FR-PL6/PL7 用户自定义训练计划的域层只读镜像（plain 字段、不跨包依赖引擎/目录）。
/// 用户决定「练哪个动作、什么顺序、训练日先后」；引擎仍决定「多重/几次/进阶/裁决」（决策在前不破坏）。
/// 取代旧的单一引擎模板硬编码的"不可改"——但默认 nil = 完全沿用引擎模板（零行为回归）。
public struct CustomExerciseItem: Equatable, Sendable {
    public let exerciseId: String
    public let sets: Int?         // nil = 用引擎默认槽位组数
    public let repMin: Int?       // nil = 用引擎默认次数下限
    public let repMax: Int?       // nil = 用引擎默认次数上限
    public let rest: Int?         // nil = 用引擎默认休息
    public let crossFamily: Bool  // 跨族换动作标记（FR-PL6：跨族需用户确认；留痕供护栏/审计）。
    // 注（审查 MINOR）：false 不落盘、读时缺=false——消费方只能感知 true；若将来需区分
    // 「明确设 false」与「从未设」，改 Bool? 并同步 encodeCustomItem。当前 true-only 留痕足够。

    public init(exerciseId: String, sets: Int? = nil, repMin: Int? = nil,
                repMax: Int? = nil, rest: Int? = nil, crossFamily: Bool = false) {
        self.exerciseId = exerciseId
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
        self.rest = rest
        self.crossFamily = crossFamily
    }
}

public struct CustomDayPlan: Equatable, Sendable {
    public let exercises: [CustomExerciseItem]   // 有序：数组顺序 = 训练顺序（FR-PL7①）

    public init(exercises: [CustomExerciseItem]) {
        self.exercises = exercises
    }
}

public struct PlanCustomization: Equatable, Sendable {
    public let dayPlans: [String: CustomDayPlan]   // dayCode → 当日动作覆盖（FR-PL6）
    public let daySequence: [String]?              // 自定义日序（FR-PL7②）；nil = 引擎默认日序

    public init(dayPlans: [String: CustomDayPlan], daySequence: [String]?) {
        self.dayPlans = dayPlans
        self.daySequence = daySequence
    }
}

/// FR-TR6「只换这次」临时换动作（open-bag，date-scoped）：把某动作只在 `dateISO` 当天换成 `actualId`。
public struct OneTimeSubstitution: Equatable, Sendable {
    public let actualId: String   // 当天临时换成的动作 id
    public let dateISO: String    // 生效日期（yyyy-MM-dd）；只对当天有效，次日自动失效

    public init(actualId: String, dateISO: String) {
        self.actualId = actualId
        self.dateISO = dateISO
    }
}

/// FR-TR7「今天换一天练」临时训练日覆盖（open-bag，date-scoped）：`dateISO` 当天的训练日改为 `dayCode`。
public struct OneTimeDayOverride: Equatable, Sendable {
    public let dayCode: String    // 当天临时改练的训练日 code（须为本分化日序的成员）
    public let dateISO: String    // 生效日期（yyyy-MM-dd）；只对当天有效，次日自动失效

    public init(dayCode: String, dateISO: String) {
        self.dayCode = dayCode
        self.dateISO = dateISO
    }
}

public struct MesocycleConfig: Equatable, Sendable {
    /// 计划周期化是否生效（默认 false = 零行为回归）。
    public let enabled: Bool
    /// 累积块长（周）。存库便于未来改 6 周，不改引擎契约。
    public let blockLengthWeeks: Int
    /// 可选块锚点（防腐烂：消费侧默认从真历史重算，此处为未来手动覆盖 / 显示预留；nil = 从历史算）。
    public let blockStartISO: String?

    public init(enabled: Bool, blockLengthWeeks: Int, blockStartISO: String?) {
        self.enabled = enabled
        self.blockLengthWeeks = blockLengthWeeks
        self.blockStartISO = blockStartISO
    }
}

extension AppData: Codable {
    public init(from decoder: Decoder) throws {
        try self.init(decoding: JSONValue(from: decoder))
    }

    public func encode(to encoder: Encoder) throws {
        try JSONValue.object(storage).encode(to: encoder)
    }
}
