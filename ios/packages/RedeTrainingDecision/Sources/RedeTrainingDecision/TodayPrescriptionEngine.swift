// TodayPrescriptionEngine — 今日处方（M2-2）：今天练什么、几组、多重、几次。
//
// 纯函数：吃 CleanTrainingDecisionInput + M2-1 裁决（不重复判断练不练），
// 同输入必同输出（goldens 锁定）。日计划不是冻结模板：由「槽位规则 × 目录
// 顺序第一个未用且匹配」从 catalog 现算（FR-ON3：不锁死硬编码模板，可重算）；
// 槽位的组数/次数区间是生成参数，沿 legacy 模板口径（事实性复用，已留痕）。
//
// 最小渐进 = 双重渐进三分支（goldens 锁定阈值）。RIR 一律取 min 口径
// （最差一组）：任何一组打到力竭就不该加重——安全优先于抗噪，这是显式
// 产品拍板（2026-06-09 审查后），改口径必须连 §6.0.1 与 goldens 一起改：
//   全组打满 repMax 且 min RIR ≥ 1.0(含 1.0；无 RIR 数据视为有余力) → +一档，次数重置 repMin；
//   上次力竭(min RIR ≤ 0.5) 或 最高组未到 repMin → −一档；
//   否则持平，次数目标 repMax（区间内推进）。
// 加重无上限（精英重量合法递增，有意为之）。
// 「一档」= 该动作器械×用户单位的真实档位步长（LoadGrid，2026-06-13「宁大勿小」）：
// kg+自由重量=2.5（与旧口径等价，goldens 零变化）；lb=5lb 真实格子；选重机更粗。
// 裁决调制在渐进之后：light ×0.9；deload ×0.8 且组数 −1(下限 2)；rest → 无处方。
// 重量一律按步长取整、下限一档；调制后若取整弹回原重量且原重量 > 一档，
// 强制下调一格——轻练/减载必须真减，小重量动作不得被取整吃掉。
// 组形（top/backoff 拆分）归 M3-1。

import Foundation
import RedeDataHealth

public enum TodayPrescriptionEngine {
    private static let nearFailureMeanRir = 0.5
    private static let progressMinMeanRir = 1.0
    // 自重次数进阶（owner 拍板 2026-06-13）：起步 12、上限 25 提示换难度、下限 8。
    private static let bodyweightStartReps = 12
    private static let bodyweightRepCeiling = 25
    private static let bodyweightRepFloor = 8
    private static let bodyweightRepStep = 2
    private static let lightMultiplier = 0.9
    // 回归协议（2026-07-08，owner 真机 E3）：重启线 21 天 = MLE detraining 窗同源；
    // 深回退线 42 天 = MLE 强度失窗（recentWindowWeeks 6 周）同源。写闸清 offset
    // 残值用同阈值（跨包重复常数，dayNumber 孪生同款纪律，CanonicalSessionWriter 互指）。
    static let comebackRestartGapDays = 21
    static let comebackDeepGapDays = 42
    private static let comebackRestartMultiplier = 0.85
    private static let comebackDeepMultiplier = 0.75
    private static let deloadMultiplier = 0.8

    /// 槽位 = 生成规则：按 pattern（可选 kind/equipment 收窄）在 catalog
    /// 声明顺序里取第一个未用条目。
    struct Slot {
        let pattern: String
        var kind: String?
        /// 槽位器械偏好（类集合）：单器械槽 = 单元素集；「固定器械」槽 =
        /// EquipmentRegistry.machineClasses（machine 拆分后不再有 "machine" 字面量）。
        var equipment: Set<String>?
        let sets: Int
        var repMin: Int
        var repMax: Int
        var rest: Int
        /// 目标 RIR（增肌默认 2；力量塑形把复合主项降到 1，见 strengthShaped）。
        var targetRir: Double = 2.0
        /// 点名主项（模板指定具体动作 id，如 legs-B 硬拉、pull-B 宽握下拉）：通过候选过滤则优先选它，
        /// 否则优雅回退 rank 最小（器械受限时不会卡空）。sticky（用户换动作）仍高于点名。
        var preferredId: String? = nil
        /// 用户自定义计划槽（FR-PL6）：true 时 preferredId = 用户显式选择，优先级**最高**（高于 sticky/
        /// FR-T5 覆盖），放不下则如实 unfilled（绝不替换成别的动作）。默认 false = 现状逻辑（golden 零变化）。
        var userPinned: Bool = false
    }

    /// 力量目标塑形（owner 拍板：增肌默认 + 力量两套）：只重塑**显式复合主项**——降到 3-6 次、
    /// RIR 1、休息 ≥180s（§4 力量列）；孤立/二级/辅助槽保持增肌区间（孤立不为力量服务）。
    /// 非 strength 目标不调用 → 增肌 golden 零变化。
    private static func strengthShaped(_ slot: Slot) -> Slot {
        guard slot.kind == "compound" else { return slot }
        var s = slot
        s.repMin = 3
        s.repMax = 6
        s.targetRir = 1.0
        s.rest = max(slot.rest, 180)
        return s
    }

    static func daySequence(splitType: String?) -> [String] {
        let s = (splitType ?? "").lowercased()
        // 顺序要紧：ppl-ul / full 含 "ppl"/"full" 子串，必须先于通配 push/ppl 判断。
        if s == "full-body" || s.contains("full") {
            // 2-3 天全身：3 个均衡变式轮换（每日覆盖全身，A/B/C 换动作避免重复），每肌群 2-3×/周。
            return ["full-a", "full-b", "full-c"]
        }
        if s == "ppl-ul" {
            // 5 天混合（腿 2×）：复用现有 push-a/pull-a/legs-a/upper/lower 槽位，零新增。
            return ["push-a", "pull-a", "legs-a", "upper", "lower"]
        }
        if s.contains("push") || s.contains("ppl") {
            // 6 天完整 PPL×2：A 日(强度/自由重量) + B 日(容量/变式)，全肌群 2×。
            return ["push-a", "pull-a", "legs-a", "push-b", "pull-b", "legs-b"]
        }
        return ["upper", "lower"]
    }

    /// FR-PL7② 日序编辑器用（public seam，同 defaultDayExerciseIds 先例）：某分化的**默认训练日轮转序**
    /// （编辑起点 = 教练给的日序；恢复默认的目标）。纯模板默认，不含自定义覆盖。
    public static func defaultDaySequence(splitType: String?) -> [String] {
        daySequence(splitType: splitType)
    }

    /// FR-PL7② 护栏预览用（public seam）：给定（可能自定义的）日序 override 与**轮换基数**，算下一个训练日。
    /// 基数必须来自 rotationBase()（含回归重启/weekly 模式）——直接传总场次在两种新模式下会与今日页分叉（审查 S2）。
    /// override 非默认日序排列时回退默认（resolvedDaySequence 内守卫）。空序列 → nil。
    public static func nextDayCode(splitType: String?, daySequenceOverride: [String]?, completedSessionCount: Int) -> String? {
        let seq = resolvedDaySequence(splitType: splitType, override: daySequenceOverride)
        guard !seq.isEmpty else { return nil }
        // 防御：负数取模在 Swift 返回负值会越界崩溃。生产调用恒传 sessions.count(≥0)，但 public seam 须守契约（优雅降级不崩，审查 MINOR）。
        let count = max(0, completedSessionCount)
        return seq[count % seq.count]
    }

    /// FR-PL7② 自定义日序：override 须为默认日序的**排列**（同集合、同长度、仅顺序变）才采用；否则
    /// （nil/空/含未知 dayCode/集合不等）回退默认——优雅降级不崩。只重排已有训练日类型，不造新日。
    /// public：编辑器 seed 当前有效日序（自定义优先、否则默认）共用此口径，杜绝与引擎分叉。
    public static func resolvedDaySequence(splitType: String?, override: [String]?) -> [String] {
        let base = daySequence(splitType: splitType)
        guard let override, !override.isEmpty else { return base }
        guard override.count == base.count, Set(override) == Set(base) else { return base }
        return override
    }

    /// FR-PL6 把用户自定义动作清单转成「钉死 exerciseId 的有序槽位」。逐动作：catalog 查不到 / 已弃用 /
    /// 非可处方 loadType / 越场景白名单 → 优雅丢弃（不替换、不崩）；有效则建 userPinned 槽。组数/次数/
    /// 休息：用户覆盖优先，否则取该 pattern 默认槽参数（无则通用默认）；力量目标对复合主项做强度塑形
    /// （仅塑形用户未覆盖的字段）。引擎仍据此算重量/进阶/裁决（决策在前不破坏）。
    /// 槽位候选过滤（plan() 选材与 defaultDayExerciseIds 共用的唯一口径——抽函数杜绝分叉）：
    /// 器械偏好 ∩ 白名单（空则软化）、accessory-kind 在无固定器械场景软化、pattern 命中、可处方
    /// loadType、未弃用、未在本日用过。去顺序化由调用方按 (rank,id) 取。
    static func slotCandidates(slot: Slot, catalog: ExerciseCatalog, allowed: Set<String>?, usedIds: Set<String>) -> [ExerciseCatalogEntry] {
        let slotEquipment: Set<String>? = slot.equipment.flatMap { pref in
            guard let allowed else { return pref }
            let usable = pref.intersection(allowed)
            return usable.isEmpty ? nil : usable
        }
        let slotKind = slot.kind.flatMap { kind in
            (kind == "accessory" && allowed != nil
                && allowed!.isDisjoint(with: EquipmentRegistry.machineClasses)) ? nil : kind
        }
        return catalog.entries.filter { entry in
            !entry.deprecated
                && EquipmentRegistry.prescribableLoadTypes.contains(entry.loadType)
                && entry.movementPattern == slot.pattern
                && (slotKind == nil || entry.kind == slotKind)
                && (slotEquipment == nil || slotEquipment!.contains(entry.equipment))
                && (allowed == nil || allowed!.contains(entry.equipment))
                && !usedIds.contains(entry.id)
        }
    }

    /// FR-PL6 计划编辑器用：某训练日的**默认动作 id 清单**（编辑起点）。按默认模板槽逐槽取
    /// 点名/(rank,id) 最小（不含 sticky/换动作/自定义——纯模板默认，编辑器以此为"教练给的计划"起点）。
    /// 与 plan() 共用 slotCandidates，口径一致（consistency 测试锁定）。
    public static func defaultDayExerciseIds(dayCode: String, equipmentScenario: String?, catalog: ExerciseCatalog = .minimal) -> [String] {
        let allowed = EquipmentAccess.allowed(for: equipmentScenario)
        var usedIds: Set<String> = []
        var ids: [String] = []
        for slot in slots(dayCode: dayCode) {
            let cands = slotCandidates(slot: slot, catalog: catalog, allowed: allowed, usedIds: usedIds)
            let pinned = slot.preferredId.flatMap { id in cands.first { $0.id == id } }
            guard let pick = pinned ?? cands.min(by: { ($0.rank, $0.id) < ($1.rank, $1.id) }) else { continue }
            usedIds.insert(pick.id)
            ids.append(pick.id)
        }
        return ids
    }

    /// FR-PL6 S9b 添加动作：该训练日**已有 pattern 族**里、当前清单未含的可处方候选 id（按 pattern→rank→id 排序）。
    /// 守器械白名单（FR-EQ1，同 plan 选材口径）。只在已有 pattern 族内增（不造新 pattern 槽——后置；
    /// 跨族换走 swap）。空清单时仍按该 dayCode 的默认 pattern 集给候选（让删空的日能重新加动作）。
    public static func addCandidates(dayCode: String, currentIds: [String], equipmentScenario: String?, catalog: ExerciseCatalog = .minimal) -> [String] {
        let allowed = EquipmentAccess.allowed(for: equipmentScenario)
        let dayPatterns = Set(slots(dayCode: dayCode).map(\.pattern))
        guard !dayPatterns.isEmpty else { return [] }
        let used = Set(currentIds)
        return catalog.entries
            .filter { e in
                !e.deprecated
                    && EquipmentRegistry.prescribableLoadTypes.contains(e.loadType)
                    && dayPatterns.contains(e.movementPattern)
                    && (allowed == nil || allowed!.contains(e.equipment))
                    && !used.contains(e.id)
            }
            .sorted { ($0.movementPattern, $0.rank, $0.id) < ($1.movementPattern, $1.rank, $1.id) }
            .map(\.id)
    }

    /// FR-TR6 换动作：返回**引擎真会接受**的替代候选——即该动作所在槽的 `slotCandidates`（同 pattern +
    /// **守该槽 equipment 偏好**〔如 lower 日复合深蹲槽=machineClasses〕+ 守场景白名单 + 排除已用）。
    /// 关键：`addCandidates`/`ExerciseReplacementEngine.candidates` 只看全局 allowed、**漏了槽 equipment 偏好**，
    /// 会列出引擎换不成的动作（如槽要 machine 却列了杠铃深蹲），用户点了悄无声息回退、像「没实现」。
    /// 槽匹配：取 pattern 相同且 equipment 偏好能容纳本动作器械的第一个槽（精确到本动作真正所在的槽）。
    /// read-only、不碰 plan()（golden 零回归）。自定义日按默认槽近似（保守，honest-check 仍兜底）。
    public static func swapCandidates(for exerciseId: String, dayCode: String, currentIds: [String],
                                      equipmentScenario: String?, catalog: ExerciseCatalog = .minimal) -> [String] {
        guard let entry = catalog.entry(id: exerciseId) else { return [] }
        let allowed = EquipmentAccess.allowed(for: equipmentScenario)
        let daySlots = slots(dayCode: dayCode)
        let slot = daySlots.first { $0.pattern == entry.movementPattern
                                    && ($0.equipment == nil || $0.equipment!.contains(entry.equipment)) }
            ?? daySlots.first { $0.pattern == entry.movementPattern }
        guard let slot else { return [] }
        let used = Set(currentIds).subtracting([exerciseId])   // 排除被换的自己，保留其他已用
        return slotCandidates(slot: slot, catalog: catalog, allowed: allowed, usedIds: used)
            .filter { $0.id != exerciseId }
            .map(\.id)
    }

    private static func customSlots(
        specs: [PlanCustomizationInput.ExerciseSpec],
        baseSlots: [Slot],
        catalog: ExerciseCatalog,
        allowed: Set<String>?,
        isStrength: Bool
    ) -> [Slot] {
        var seenIds: Set<String> = []
        return specs.compactMap { spec in
            // 优雅丢弃：catalog 查不到 / 弃用 / 非可处方 loadType / 越场景白名单 / **同动作重复**（只保首次，
            // 防第二个静默变 unfilled + patternCounts 膨胀污染默认槽 sticky，审查 MAJOR-1）。
            guard let ex = catalog.entry(id: spec.exerciseId), !ex.deprecated,
                  EquipmentRegistry.prescribableLoadTypes.contains(ex.loadType),
                  allowed == nil || allowed!.contains(ex.equipment),
                  seenIds.insert(ex.id).inserted
            else { return nil }
            let base = baseSlots.first { $0.pattern == ex.movementPattern }
            var repMin = spec.repMin ?? base?.repMin ?? 8
            var repMax = spec.repMax ?? base?.repMax ?? 12
            var rest = spec.rest ?? base?.rest ?? 90
            // rir：baseSlots 故意传**未塑形**槽（targetRir 均为默认 2.0）；力量塑形对复合主项在下方单独
            // 置 1.0（孤立/二级保 2.0）。即"自定义槽自己做强度塑形"，不复用 defaultSlots 的已塑形值。
            var rir = base?.targetRir ?? 2.0
            if isStrength && ex.kind == "compound" {
                if spec.repMin == nil { repMin = 3 }
                if spec.repMax == nil { repMax = 6 }
                if spec.rest == nil { rest = max(rest, 180) }
                rir = 1.0
            }
            if repMin > repMax { repMax = repMin }   // 兜底保证区间有效（clean view 已校验，此处防御）
            return Slot(
                pattern: ex.movementPattern,
                kind: ex.kind,
                equipment: nil,                       // 不收窄器械；preferredId + userPinned 精确钉死本动作
                sets: max(1, spec.sets ?? base?.sets ?? 3),
                repMin: max(1, repMin),
                repMax: max(1, repMax),
                rest: max(0, rest),
                targetRir: rir,
                preferredId: ex.id,
                userPinned: true
            )
        }
    }

    static func slots(dayCode: String) -> [Slot] {
        switch dayCode {
        case "push-a":
            return [
                Slot(pattern: "horizontal-press", kind: "compound", sets: 3, repMin: 6, repMax: 8, rest: 180),
                Slot(pattern: "incline-press", sets: 3, repMin: 8, repMax: 10, rest: 120),
                Slot(pattern: "horizontal-press", kind: "accessory", sets: 2, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "fly", sets: 2, repMin: 12, repMax: 15, rest: 75),
                Slot(pattern: "lateral-raise", sets: 4, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "triceps-extension", sets: 3, repMin: 10, repMax: 15, rest: 75),
            ]
        case "pull-a":
            return [
                Slot(pattern: "vertical-pull", kind: "compound", sets: 3, repMin: 8, repMax: 10, rest: 120), // kind:compound → 力量目标也塑形主拉
                Slot(pattern: "horizontal-pull", equipment: ["cable"], sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "horizontal-pull", kind: "compound", equipment: ["barbell"], sets: 3, repMin: 6, repMax: 10, rest: 150), // kind:compound → 杠铃划船力量塑形
                Slot(pattern: "rear-delt", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "curl", sets: 3, repMin: 8, repMax: 12, rest: 75),
                Slot(pattern: "curl", sets: 2, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "shrug", sets: 3, repMin: 10, repMax: 15, rest: 60),
            ]
        case "legs-a":
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: ["barbell"], sets: 4, repMin: 5, repMax: 8, rest: 210),
                Slot(pattern: "hinge", kind: "compound", equipment: ["barbell"], sets: 3, repMin: 6, repMax: 10, rest: 180), // kind:compound → 力量目标塑形 RDL
                Slot(pattern: "squat-pattern", kind: "accessory", sets: 3, repMin: 10, repMax: 15, rest: 120),
                Slot(pattern: "knee-extension", sets: 3, repMin: 12, repMax: 15, rest: 75),
                Slot(pattern: "knee-flexion", sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "calf-raise", sets: 4, repMin: 10, repMax: 20, rest: 60),
                Slot(pattern: "core", sets: 3, repMin: 12, repMax: 20, rest: 60),
            ]
        // B 日（6 天 PPL×2 的容量/变式日）：靠 equipment/kind 约束选到与 A 日不同的动作，
        // 全器械下完全区分；器械受限时优雅软化（可能与 A 重叠，可接受）。详见方案 §3。
        case "push-b":
            return [
                Slot(pattern: "incline-press", equipment: ["barbell"], sets: 4, repMin: 6, repMax: 10, rest: 180), // 上斜杠铃推（主项前置；A 日用上斜哑铃）
                Slot(pattern: "horizontal-press", kind: "compound", equipment: ["dumbbell"], sets: 3, repMin: 8, repMax: 12, rest: 120), // 哑铃平板（A 用杠铃平板）
                Slot(pattern: "vertical-press", sets: 3, repMin: 8, repMax: 12, rest: 120), // 坐姿肩推（补垂直推，A 日缺）
                Slot(pattern: "fly", equipment: EquipmentRegistry.machineClasses, sets: 3, repMin: 12, repMax: 15, rest: 75), // 器械夹胸（A 用绳索飞鸟）
                Slot(pattern: "lateral-raise", equipment: ["cable"], sets: 4, repMin: 12, repMax: 20, rest: 60), // 绳索侧平（A 用哑铃侧平）
                Slot(pattern: "triceps-extension", equipment: ["barbell"], sets: 3, repMin: 8, repMax: 12, rest: 75), // 窄距/杠铃臂屈伸（A 用绳索下压）
            ]
        case "pull-b":
            return [
                Slot(pattern: "horizontal-pull", kind: "compound", equipment: ["dumbbell"], sets: 4, repMin: 8, repMax: 12, rest: 150, preferredId: "chest-supported-db-row"), // 俯身支撑哑铃划船（主项点名；A 用杠铃/绳索划船）
                Slot(pattern: "vertical-pull", kind: "compound", sets: 3, repMin: 8, repMax: 12, rest: 120, preferredId: "wide-grip-pulldown"), // 宽握下拉（点名；A 用高位下拉）
                Slot(pattern: "vertical-pull", kind: "isolation", sets: 3, repMin: 12, repMax: 15, rest: 75), // 直臂下拉（lat 孤立，A 日缺）
                Slot(pattern: "rear-delt", equipment: EquipmentRegistry.machineClasses, sets: 3, repMin: 12, repMax: 20, rest: 60), // 反向蝴蝶机（A 用面拉）
                Slot(pattern: "curl", equipment: ["cable"], sets: 3, repMin: 10, repMax: 15, rest: 75), // 绳索弯举（A 用哑铃弯举）
                Slot(pattern: "shrug", equipment: ["dumbbell"], sets: 3, repMin: 10, repMax: 15, rest: 60), // 哑铃耸肩（A 用杠铃耸肩）
            ]
        case "legs-b":
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: EquipmentRegistry.machineClasses, sets: 4, repMin: 8, repMax: 12, rest: 180), // 哈克深蹲（膝主导主项；A 用杠铃深蹲）
                Slot(pattern: "hinge", kind: "compound", equipment: ["barbell"], sets: 3, repMin: 5, repMax: 8, rest: 210, preferredId: "deadlift"), // 硬拉（后链主项点名 + kind:compound 力量塑形；A 用 RDL）
                Slot(pattern: "squat-pattern", kind: "compound", equipment: ["dumbbell"], sets: 3, repMin: 10, repMax: 15, rest: 90, preferredId: "bulgarian-split-squat"), // 保加利亚分腿蹲（单侧点名）
                Slot(pattern: "knee-flexion", equipment: EquipmentRegistry.machineClasses, sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "knee-extension", sets: 3, repMin: 12, repMax: 20, rest: 75),
                Slot(pattern: "calf-raise", equipment: ["dumbbell"], sets: 4, repMin: 10, repMax: 20, rest: 60), // 哑铃提踵（A 用器械提踵）
                Slot(pattern: "core", equipment: EquipmentRegistry.machineClasses, sets: 3, repMin: 12, repMax: 20, rest: 60), // 器械卷腹（A 用绳索卷腹）
            ]
        // 全身 A/B/C（2-3 天全身）：每日覆盖 股四/后链/胸/背/肩/臂 全身一遍，三变式靠
        // pattern 顺序 + equipment 约束换不同动作。频率靠「每次都练全身」达成（2-3 天 = 每肌群 2-3×）。
        case "full-a": // 深蹲 + 平板卧推 + 高位下拉（自由重量力量倾向）
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: ["barbell"], sets: 3, repMin: 5, repMax: 8, rest: 180),
                Slot(pattern: "horizontal-press", kind: "compound", sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "vertical-pull", sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "hinge", equipment: ["barbell"], sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "vertical-press", sets: 3, repMin: 8, repMax: 12, rest: 90),
                Slot(pattern: "curl", sets: 2, repMin: 10, repMax: 15, rest: 60),
            ]
        case "full-b": // 哈克蹲 + 上斜 + 杠铃划船（器械/角度变式）
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: EquipmentRegistry.machineClasses, sets: 3, repMin: 8, repMax: 12, rest: 150),
                Slot(pattern: "incline-press", sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: ["barbell"], sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "knee-flexion", sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "lateral-raise", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "triceps-extension", sets: 2, repMin: 10, repMax: 15, rest: 60),
            ]
        case "full-c": // 腿举 + 哑铃平板 + 坐姿划船（容量/泵感）
            return [
                Slot(pattern: "squat-pattern", kind: "accessory", sets: 3, repMin: 10, repMax: 15, rest: 120),
                Slot(pattern: "hinge", equipment: ["dumbbell"], sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "horizontal-press", kind: "compound", equipment: ["dumbbell"], sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: ["cable"], sets: 3, repMin: 10, repMax: 15, rest: 90),
                Slot(pattern: "rear-delt", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "calf-raise", sets: 3, repMin: 10, repMax: 20, rest: 60), // 小腿（全身唯一直接小腿日，审查 M-1）
                Slot(pattern: "core", sets: 3, repMin: 12, repMax: 20, rest: 60),
            ]
        case "lower":
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: EquipmentRegistry.machineClasses, sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "hinge", equipment: ["dumbbell"], sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "squat-pattern", kind: "accessory", sets: 3, repMin: 10, repMax: 15, rest: 120),
                Slot(pattern: "knee-extension", sets: 3, repMin: 12, repMax: 15, rest: 75),
                Slot(pattern: "knee-flexion", sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "calf-raise", sets: 4, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "core", sets: 3, repMin: 12, repMax: 20, rest: 60),
            ]
        default: // "upper"
            return [
                Slot(pattern: "horizontal-press", equipment: ["dumbbell"], sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "vertical-pull", sets: 3, repMin: 8, repMax: 10, rest: 120),
                Slot(pattern: "vertical-press", sets: 3, repMin: 6, repMax: 10, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: ["dumbbell"], sets: 3, repMin: 8, repMax: 12, rest: 90),
                Slot(pattern: "lateral-raise", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "triceps-extension", sets: 2, repMin: 10, repMax: 15, rest: 60),
                Slot(pattern: "curl", equipment: ["dumbbell"], sets: 2, repMin: 10, repMax: 15, rest: 60),
                Slot(pattern: "shrug", sets: 3, repMin: 10, repMax: 15, rest: 60),
            ]
        }
    }

    public static func plan(
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        catalog: ExerciseCatalog = .minimal,
        mesocycleEnabled: Bool = false,
        blockLengthWeeks: Int = Mesocycle.defaultBlockLengthWeeks,
        substitutions: [String: String] = [:],
        customization: PlanCustomizationInput = .empty,
        dayCodeOverride: String? = nil,
        rotationOffset: Int = 0,
        weeklyCycleRestart: Bool = false,
        priorityMuscles: Set<MuscleGroupID> = []
    ) -> TodayPrescription? {
        guard verdict.call != .rest else { return nil }

        // 计划周期相位（S2，2026-06-15）：默认关闭 = 零行为变化；开启时从真历史锚点纯算今日相位。
        // blockLengthWeeks 由调用方从落库配置（appData.mesocycle.blockLengthWeeks）透传——与计划页
        // 周期条读同一值，保证两页相位永不分叉（审查 MAJOR-1：结构保证，非「都恰好是 4」的巧合）。
        let phase: PhaseModulation? = mesocycleEnabled
            ? Mesocycle.blockStartISO(sessionDatesISO: input.sessions.map(\.date), todayISO: input.todayISO)
                .map { Mesocycle.phase(blockStartISO: $0, todayISO: input.todayISO, blockLengthWeeks: blockLengthWeeks).modulation }
            : nil

        // FR-PL7② 自定义日序：override 须为默认日序的排列，否则回退默认（resolvedDaySequence 内守卫）。
        // 默认（override=nil）逐字节等价于现状。
        let sequence = resolvedDaySequence(splitType: input.program.splitType, override: customization.daySequence)
        // 轮转 = 序列[(自最近重启点的场次数 + 偏移) % 长度]。FR-TR12 临时换天那场完成时偏移 −1
        // 抵消推进 → 跳过的日下一场补回。回归协议（2026-07-08）：重启点 = 与前一场日期差
        // ≥comebackRestartGapDays 的场——其后轮换重新计数（无状态：每次从历史扫描；
        // 无重启点 = 场次数全量，逐字节等价现状，golden 零回归）。
        // 轮换决策单一真源（含回归重启 + 每周循环模式）——app 层「今天本来该练什么」
        // （换天头标/被顶掉日名）必须调同一函数，禁止旧公式复算（2026-07-08 实拍抓获
        // app 层复算漂移：weekly/回归重启下误显示「今天临时换为」）。
        let todayDay = TrainingDay.dayNumber(fromISO: input.todayISO)
        let restartToday = (verdict.longGapDays ?? 0) >= comebackRestartGapDays
        let rotated = scheduledDayCode(
            sequence: sequence, sessions: input.sessions, todayDay: todayDay,
            rotationOffset: rotationOffset, weeklyCycleRestart: weeklyCycleRestart,
            restartToday: restartToday)
        // FR-TR12「今天换一天练」：今日临时覆盖优先（须为本日序合法成员，否则回退轮转）。默认 nil = 现状。
        // 优先级：用户显式换天 > 回归重启 > 轮转（决策在用户）。
        let dayCode = dayCodeOverride.flatMap { sequence.contains($0) ? $0 : nil } ?? rotated

        // FR-EQ1（2026-06-11）：场景白名单硬过滤候选；槽位 equipment/machine-kind
        // 偏好与白名单冲突时软化（保 pattern 在可用器械里匹配），槽位无解=如实 unfilled。
        let allowed = EquipmentAccess.allowed(for: input.profile.equipmentScenario)

        var dayReasons: [DayPrescriptionReason] = []
        var usedIds: Set<String> = []
        var exercises: [ExercisePrescriptionPlan] = []

        // sticky swaps（wave-9，owner 拍板）：pattern 在当日**唯一出现**的槽，优先
        //「上次该 pattern 实际做的动作」（含换动作换入的）；同 pattern 多槽不 sticky
        //（歧义，回退 rank 默认）。让换动作选择跨天粘住，并使 prescribeAssisted 的
        // 进阶/冷启动/毕业经今日页可达（辅助引体不再每次靠手动换）。
        // 力量目标：复合主项走 3-6 次 / RIR1 / 长休息；增肌（默认/general）不变。
        let isStrength = (input.program.primaryGoal ?? "").lowercased() == "strength"
        // FR-PL6 当日动作覆盖：有有效自定义清单 → 用之（钉死动作、保序）；否则默认模板（现状逐字节不变）。
        // 自定义清单经 catalog/场景/可处方过滤后若全空 → 回退默认（优雅降级，绝不出空处方）。
        let defaultSlots = isStrength ? slots(dayCode: dayCode).map(strengthShaped) : slots(dayCode: dayCode)
        let daySlots: [Slot]
        if let specs = customization.dayPlans[dayCode], !specs.isEmpty {
            let custom = customSlots(specs: specs, baseSlots: slots(dayCode: dayCode),
                                     catalog: catalog, allowed: allowed, isStrength: isStrength)
            daySlots = custom.isEmpty ? defaultSlots : custom
        } else {
            daySlots = defaultSlots
        }
        let patternCounts = daySlots.reduce(into: [String: Int]()) { $0[$1.pattern, default: 0] += 1 }
        let lastActual = lastActualByPattern(sessions: input.sessions, catalog: catalog)

        /// 自动均衡每场加量预算（合计最多 +2 组——温和偏置，不是重写计划）。
        var boostBudget = priorityMuscles.isEmpty ? 0 : 2
        var boostedMuscleRaws: [String] = []
        for slot in daySlots {
            // 候选过滤抽成共享函数 slotCandidates（plan() 与 defaultDayExerciseIds 共用，杜绝口径分叉）。
            let candidates = slotCandidates(slot: slot, catalog: catalog, allowed: allowed, usedIds: usedIds)
            // 选材优先级：① sticky（用户上次实际做的，须仍合法）→ ② 槽位点名 preferredId
            //（模板指定主项，如 legs-B 硬拉、pull-B 宽握下拉；须通过器械白名单等候选过滤，
            // 否则优雅回退）→ ③ rank 最小默认。点名让 B 日主项精确，不再受「同 pattern 取 rank 最小」限制。
            let pinnedPick = slot.preferredId.flatMap { id in candidates.first { $0.id == id } }
            let entry: ExerciseCatalogEntry
            if slot.userPinned {
                // FR-PL6 自定义槽：用户显式选择优先级最高（高于 sticky / FR-T5 覆盖）；放不下
                //（已用过 / 被场景过滤）则如实 unfilled，绝不替换成别的动作（用户选择是最终的）。
                guard let pick = pinnedPick else {
                    dayReasons.append(.slotUnfilled(pattern: slot.pattern))
                    continue
                }
                entry = pick
            } else {
                let stickyPick = patternCounts[slot.pattern] == 1
                    ? lastActual[slot.pattern].flatMap { pref in candidates.first { $0.id == pref } }
                    : nil
                guard let basePick = stickyPick ?? pinnedPick ?? candidates.min(by: { ($0.rank, $0.id) < ($1.rank, $1.id) })
                else {
                    dayReasons.append(.slotUnfilled(pattern: slot.pattern))
                    continue
                }
                // 换动作覆盖（FR-T5，优先级最高 > sticky/pinned/rank）：用户显式「以后把 X 换成 Y」。
                // 仅当目标仍是本槽合法候选（同 pattern + 过 FR-EQ1 白名单/槽位过滤 + 未在本日用过，
                // 即在 candidates 内）才生效，否则优雅回退原选择（不卡空、不破坏 pattern 覆盖）。
                // substitutions 为空（schema≤10 或无覆盖）= 完全无行为变化（code-regression-guard）。
                entry = substitutions[basePick.id]
                    .flatMap { target in candidates.first { $0.id == target } } ?? basePick
            }
            usedIds.insert(entry.id)
            var item = prescribe(entry: entry, slot: slot, input: input, verdict: verdict, catalog: catalog, phase: phase)
            // 自动均衡（批次 E，owner 拍板「不要建议直接自动改计划」）：正在补足的肌群
            // 为主的动作 +1 组。门控全让位——只 train 态（deload 本身 -1 组，无脑加只会
            // 抵消=假让位；light/comeback 安全网优先）、周期相位平周（deload 周不加、
            // overreach 周本身 +1 不叠）、每场加量合计封顶（防多动作同肌群失控）。
            // 瞬时调制：不写回自定义槽（漂移红线，见 addingOneSet 注释）。
            if boostBudget > 0, verdict.call == .train, (phase?.setDelta ?? 0) == 0,
               let primary = MuscleGroupMapping.primaryGroup(forExerciseId: entry.id, catalog: catalog),
               priorityMuscles.contains(primary) {
                item = item.addingOneSet()
                boostBudget -= 1
                boostedMuscleRaws.append(primary.rawValue)
            }
            exercises.append(item)
        }
        if !boostedMuscleRaws.isEmpty {
            // 依据行素材（「查看依据」抽屉内，无常驻小字）：去重保序
            var seen = Set<String>()
            let unique = boostedMuscleRaws.filter { seen.insert($0).inserted }
            dayReasons.append(.musclePriorityBoosted(muscleRaws: unique))
        }

        switch verdict.call {
        case .light: dayReasons.append(.verdictLightReduced)
        case .deload: dayReasons.append(.verdictDeloadReduced)
        case .train, .rest: break
        }
        if restartToday, dayCodeOverride == nil {
            dayReasons.append(.comebackCycleRestart)   // 循环已重启（回归协议）
        }
        // 顺延透明化（2026-07-08）：默认模式下「新 ISO 周 + 上周未练满 + 指针不在
        // 序列头」→ 打 carriedOverFromLastWeek，今日页副句解释「上周的 X 日顺延到
        // 今天」并指路换天（决策仍在用户）。回归重启已另有专属语境，不叠加。
        if !weeklyCycleRestart, !restartToday, dayCodeOverride == nil, dayCode != sequence[0],
           let todayDay, isCarriedOverFromLastWeek(input: input, todayDay: todayDay) {
            dayReasons.append(.carriedOverFromLastWeek)
        }

        return TodayPrescription(dayCode: dayCode, exercises: exercises, dayReasons: dayReasons)
    }

    // MARK: 单动作渐进 + 裁决调制

    private static func prescribe(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        catalog: ExerciseCatalog,
        phase: PhaseModulation?
    ) -> ExercisePrescriptionPlan {
        let last = lastPerformance(exerciseId: entry.id, sessions: input.sessions)

        // 自重分支（2026-06-13，owner 拍板）：无外部负重，按次数进阶；到顶提示换难度。
        // 重量轴的渐进/取整/调制全部不适用——单独一条路径。
        if entry.loadType == "bodyweight" {
            return prescribeBodyweight(entry: entry, slot: slot, last: last, verdict: verdict, phase: phase)
        }

        // 弹力带分支（wave-12，owner 拍板 A 案「按次数进阶」）：复用自重引擎（无 kg 轴、按次数），
        // 唯一分叉是到顶 reason——弹力带换更重的带子（.bandCeilingReached）才是真实进阶路径，
        // 不是自重的「加配重/换更难变体」。loadType 透传 band 供显示层判定（同自重渲染：仅次数）。
        if entry.loadType == "band" {
            return prescribeBodyweight(
                entry: entry, slot: slot, last: last, verdict: verdict,
                phase: phase, loadType: "band", ceilingReason: .bandCeilingReached
            )
        }

        // 辅助器械分支（wave-9，owner 拍板）：辅助量轴方向反转——进阶=减辅助、
        // 挣扎/力竭=加辅助、轻练/减载=加辅助、新手冷启动=更多辅助、降到最小一片
        // 还有余力=毕业换自重孪生。绝不把 external 减重瀑布套上去（安全方向反转红线）。
        if entry.loadType == "assisted" {
            return prescribeAssisted(entry: entry, slot: slot, last: last, input: input, verdict: verdict, phase: phase, catalog: catalog)
        }

        // 负重自重分支（wave-11，owner 拍板）：重量轴=外挂负重(≥0)，方向同 external
        //（加负重=更难），但档位取挂片档、减到最小一片还吃力则自动回退换自重孪生。
        if entry.loadType == "bodyweight-plus" {
            return prescribeBodyweightPlus(entry: entry, slot: slot, last: last, input: input, verdict: verdict, phase: phase, catalog: catalog)
        }

        // 档位系统（2026-06-13）：渐进一档 = 器械×用户单位的真实档位步长（LoadGrid，
        // 宁大勿小）。roundToIncrement 到它即把重量吸附到真实格子——磅用户落 5lb
        // 倍数、公斤用户落 2.5kg 倍数。kg + 自由重量 = 2.5，与旧 per-entry 步长等价。
        // 真实梯子（2026-06-15）：进阶/回退取相邻格、取整吸附最近格——等距器械 ≡ 旧 step 行为
        //（公斤零回归），磅哑铃走分段梯子（轻段 2.5lb / 中段 5lb）。
        let unit = LoadUnit(unitSystem: input.profile.unitSystem)
        let equip = entry.equipment
        let step = LoadGrid.stepKg(equipment: equip, unit: unit)

        let baseWeight: Double
        let targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            if let minRir = last.minRir, minRir <= nearFailureMeanRir {
                baseWeight = LoadGrid.nextRungKg(last.topWeightKg, equipment: equip, unit: unit, up: false)
                targetReps = slot.repMin
                change = .ease
                reason = .nearFailureLastTime
            } else if last.maxReps < slot.repMin {
                baseWeight = LoadGrid.nextRungKg(last.topWeightKg, equipment: equip, unit: unit, up: false)
                targetReps = slot.repMin
                change = .ease
                reason = .belowRepFloor
            } else if last.minReps >= slot.repMax, last.minRir.map({ $0 >= progressMinMeanRir }) ?? true,
                      verdict.longGapDays == nil {
                // 无上限：精英重量的 +一档 是合法递增，有意不设 cap。
                // 回归压制（2026-07-08）：停练 ≥14 天时本分支不进——上上次的满分不是
                // 今天加重的依据，持平回场（叠加 light 分档回退），渐进从这场重启。
                baseWeight = LoadGrid.nextRungKg(last.topWeightKg, equipment: equip, unit: unit, up: true)
                targetReps = slot.repMin
                change = .increase
                reason = .repCeilingReached
            } else {
                baseWeight = last.topWeightKg
                targetReps = slot.repMax
                change = .hold
                reason = .holdProgressing
            }
        } else {
            // M5-1 首练定档：自报背景只作冷启动先验，缩放仅作用于 firstExposure；
            // 一旦有真实记录（上面分支），实际执行即基线，先验不再参与。
            // 与裁决调制（light ×0.9 / deload ×0.8）叠乘是有意设计（拍板 2026-06-10）：
            // 先验定起点基线、调制定当日急性状态，两者正交；下限一档（per-entry 步长）兜底。
            baseWeight = ColdStartPrior.scaledStartKg(
                entry.startWeightKg, trainingLevel: input.profile.trainingLevel, stepKg: step
            )
            targetReps = slot.repMin
            change = .start
            reason = .firstExposure
        }

        var weight = LoadGrid.snapKg(baseWeight, equipment: equip, unit: unit)
        var sets = slot.sets
        var rir = slot.targetRir
        // 计划周期相位（S2）：仅 train 态生效——light/deload/rest 让位给安全网（反应式优先；
        // light×phase 的更细合并归 S3）。weightMultiplier=1.0 不调（modulated 在 1.0 会误减一格），
        // 只减载周(0.85)真减重；setDelta/rirTarget 照表。
        if let phase, verdict.call == .train {
            if phase.weightMultiplier < 1.0 {
                weight = modulated(base: weight, multiplier: phase.weightMultiplier, equipment: equip, unit: unit)
            }
            sets = max(2, sets + phase.setDelta)
            rir = phase.rirTarget
        }
        switch verdict.call {
        case .light:
            weight = modulated(base: weight, multiplier: comebackAwareLightMultiplier(verdict: verdict), equipment: equip, unit: unit)
        case .deload:
            weight = modulated(base: weight, multiplier: deloadMultiplier, equipment: equip, unit: unit)
            sets = max(2, sets - 1)
        case .train, .rest:
            break
        }

        return ExercisePrescriptionPlan(
            exerciseId: entry.id,
            sets: sets,
            restSeconds: slot.rest,
            repLowerBound: slot.repMin,
            repUpperBound: slot.repMax,
            targetReps: targetReps,
            targetWeightKg: weight,
            targetRir: rir,
            previousWeightKg: last?.topWeightKg,
            previousTopReps: last?.repsAtTop,
            nextProjectedWeightKg: LoadGrid.nextRungKg(weight, equipment: equip, unit: unit, up: true),
            progressionStepKg: step,
            change: change,
            reason: reason,
            loadType: entry.loadType,
            equipment: entry.equipment
        )
    }

    /// 轻练/减载的实际负重：×乘数后吸附到器械×单位真实梯子；若弹回原值且仍有下调空间，
    /// 强制下调一格（调制必须真减，小重量不得被取整吃掉）。等距器械 ≡ 旧 step 行为（公斤零回归）。
    private static func modulated(base: Double, multiplier: Double, equipment: String, unit: LoadUnit) -> Double {
        let snapped = LoadGrid.snapKg(base * multiplier, equipment: equipment, unit: unit)
        guard snapped >= base else { return snapped }
        let down = LoadGrid.nextRungKg(base, equipment: equipment, unit: unit, up: false)
        return down < base ? down : snapped
    }

    /// 相位组数/RIR 调制（仅 train 态；各 loadType 路径共用）。weightMultiplier 由各路径按其
    /// 负重轴方向单独处理（external / bodyweight-plus 减外加负重；assisted 反转、自重无重量，均不套）。
    private static func applyPhaseSetsRir(_ phase: PhaseModulation?, verdict: TodayVerdict,
                                         sets: inout Int, rir: inout Double) {
        guard let phase, verdict.call == .train else { return }
        sets = max(2, sets + phase.setDelta)
        rir = phase.rirTarget
    }

    /// 该动作最近一次工作顶组重量（供换动作后的小结 PR 口径：换入动作
    /// 只和它自己的历史比，§6.2 修复 2026-06-11）；无历史 → nil。
    public static func lastTopWeightKg(exerciseId: String, sessions: [CleanTrainingSession]) -> Double? {
        lastPerformance(exerciseId: exerciseId, sessions: sessions)?.topWeightKg
    }

    /// 自重处方（owner 拍板 2026-06-13）：重量固定 0，按次数进阶到顶提示换难度。
    /// 上次力竭则保持、有余力则 +2 次、到 25 次封顶并提示加配重/换更难变体。
    /// wave-12：弹力带（band）复用本路径——只换两个参数：loadType（透传给显示层判渲染）
    /// 与 ceilingReason（到顶提示分叉：自重=加配重、弹力带=换重带）。毕业/回退孪生调用
    /// （assisted/bodyweight-plus → 自重）走默认值，行为零变化。
    private static func prescribeBodyweight(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        last: LastPerformance?,
        verdict: TodayVerdict,
        phase: PhaseModulation? = nil,
        forcedReason: PrescriptionReason? = nil,   // wave-9：assisted 毕业换自重时标 .assistedGraduated
        loadType: String = "bodyweight",
        ceilingReason: PrescriptionReason = .bodyweightCeilingReached
    ) -> ExercisePrescriptionPlan {
        var targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            // 自重/弹力带进阶用**最高组次数**：重量恒 0，按重量取的 repsAtTop 会退化成顺序依赖的某一组
            //（首/末），导致跨次进阶不一致、到顶漏触发（审计 MAJOR）。最高组才是"有没有余力进阶"的真信号。
            let lastReps = last.maxReps
            if lastReps >= bodyweightRepCeiling {
                targetReps = bodyweightRepCeiling
                change = .hold
                reason = ceilingReason
            } else if let minRir = last.minRir, minRir <= nearFailureMeanRir {
                targetReps = max(bodyweightRepFloor, lastReps)
                change = .hold
                reason = .nearFailureLastTime   // 力竭保持（审查 MINOR-4：区分于进阶）
            } else {
                targetReps = min(bodyweightRepCeiling, lastReps + bodyweightRepStep)
                change = .increase
                reason = .holdProgressing
            }
        } else {
            targetReps = bodyweightStartReps
            change = .start
            reason = .firstExposure
        }

        var sets = slot.sets
        var rir = slot.targetRir
        applyPhaseSetsRir(phase, verdict: verdict, sets: &sets, rir: &rir)
        switch verdict.call {
        case .light:
            targetReps = max(bodyweightRepFloor, targetReps - bodyweightRepStep)
        case .deload:
            sets = max(2, sets - 1)
            targetReps = max(bodyweightRepFloor, targetReps - bodyweightRepStep)
        case .train, .rest:
            break
        }

        return ExercisePrescriptionPlan(
            exerciseId: entry.id,
            sets: sets,
            restSeconds: slot.rest,
            repLowerBound: bodyweightRepFloor,
            repUpperBound: bodyweightRepCeiling,
            targetReps: targetReps,
            targetWeightKg: 0,
            targetRir: rir,
            previousWeightKg: nil,
            previousTopReps: last?.repsAtTop,
            nextProjectedWeightKg: 0,
            progressionStepKg: 0,
            change: change,
            reason: forcedReason ?? reason,
            loadType: loadType,
            equipment: entry.equipment
        )
    }

    /// 辅助器械处方（wave-9，owner 拍板）：辅助量 = 越多越轻松，方向相对 external 全反转。
    /// 变强→减辅助一档；力竭/挣扎→加辅助一档（安全方向）；轻练/减载→加辅助；
    /// 新手冷启动→更多辅助；减到最小一片以下→毕业换同族自重孪生（数轴不跨零）。
    private static func prescribeAssisted(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        last: LastPerformance?,
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        phase: PhaseModulation?,
        catalog: ExerciseCatalog
    ) -> ExercisePrescriptionPlan {
        let step = LoadGrid.stepKg(
            equipment: entry.equipment,
            unit: LoadUnit(unitSystem: input.profile.unitSystem)
        )

        let baseAssist: Double
        let targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            if let minRir = last.minRir, minRir <= nearFailureMeanRir {
                baseAssist = last.topWeightKg + step       // 力竭 → 加辅助（更轻=安全）
                targetReps = slot.repMin
                change = .ease
                reason = .nearFailureLastTime
            } else if last.maxReps < slot.repMin {
                baseAssist = last.topWeightKg + step        // 没到下限 → 加辅助
                targetReps = slot.repMin
                change = .ease
                reason = .belowRepFloor
            } else if last.minReps >= slot.repMax, last.minRir.map({ $0 >= progressMinMeanRir }) ?? true,
                      verdict.longGapDays == nil {
                // 回归压制（2026-07-08 审查 S1）：减辅助=变难，与收据句「重量先回落」矛盾
                let nextAssist = last.topWeightKg - step     // 变强 → 减辅助一档
                if nextAssist < step {
                    // 减到最小一片以下 = 不再需要辅助 → 自动毕业换自重孪生
                    if let twin = graduationTwin(for: entry, catalog: catalog) {
                        let twinLast = lastPerformance(exerciseId: twin.id, sessions: input.sessions)
                        // 「毕业」提示只在首次切换出现（无自重历史）；已练过自重版则走
                        // 正常次数进阶（审查 MINOR：避免 reason=毕业 / change=进阶 矛盾）。
                        return prescribeBodyweight(
                            entry: twin, slot: slot, last: twinLast, verdict: verdict,
                            phase: phase, forcedReason: twinLast == nil ? .assistedGraduated : nil
                        )
                    }
                    baseAssist = step                        // 无孪生兜底：保持最小辅助，不跨零
                    targetReps = slot.repMax
                    change = .hold
                    reason = .holdProgressing
                } else {
                    baseAssist = nextAssist
                    targetReps = slot.repMin
                    change = .increase
                    reason = .repCeilingReached
                }
            } else {
                baseAssist = last.topWeightKg                // 区间内 → 保持
                targetReps = slot.repMax
                change = .hold
                reason = .holdProgressing
            }
        } else {
            baseAssist = ColdStartPrior.scaledAssistKg(
                entry.startWeightKg, trainingLevel: input.profile.trainingLevel, stepKg: step
            )
            targetReps = slot.repMin
            change = .start
            reason = .firstExposure
        }

        // 调制反转：轻练/减载 = 加辅助（更轻），不是 ×0.9/0.8 减重。
        var assist = roundToIncrement(baseAssist, step: step)
        var sets = slot.sets
        var rir = slot.targetRir
        applyPhaseSetsRir(phase, verdict: verdict, sets: &sets, rir: &rir)
        switch verdict.call {
        case .light:
            assist = roundToIncrement(assist + step, step: step)
        case .deload:
            assist = roundToIncrement(assist + step * 2, step: step)
            sets = max(2, sets - 1)
        case .train, .rest:
            break
        }

        return ExercisePrescriptionPlan(
            exerciseId: entry.id,
            sets: sets,
            restSeconds: slot.rest,
            repLowerBound: slot.repMin,
            repUpperBound: slot.repMax,
            targetReps: targetReps,
            targetWeightKg: assist,
            targetRir: rir,
            previousWeightKg: last?.topWeightKg,
            previousTopReps: last?.repsAtTop,
            // 下一步指向「少帮一档」（进阶方向）；最小一片兜底不跨零。
            nextProjectedWeightKg: max(step, roundToIncrement(assist - step, step: step)),
            progressionStepKg: step,
            change: change,
            reason: reason,
            loadType: entry.loadType,
            equipment: entry.equipment
        )
    }

    /// 负重自重处方（wave-11，owner 拍板）：外挂负重轴方向同 external（加负重=更难），
    /// 档位取挂片档（addedLoadStepKg）；挣扎减负重，减到最小一片以下=太重→自动回退换
    /// 同族自重孪生（负重引体→自重引体）。冷启动复用 external 先验（新手加得少，方向就对）。
    private static func prescribeBodyweightPlus(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        last: LastPerformance?,
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        phase: PhaseModulation?,
        catalog: ExerciseCatalog
    ) -> ExercisePrescriptionPlan {
        let unit = LoadUnit(unitSystem: input.profile.unitSystem)
        let step = LoadGrid.addedLoadStepKg(unit: unit)   // 外加负重档 = 挂片 barbell 格（等距）

        let baseLoad: Double
        let targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            // 挣扎口径：近力竭优先于掉出次数下限（同 external 分支次序）。
            let easeReason: PrescriptionReason? =
                (last.minRir.map { $0 <= nearFailureMeanRir } ?? false) ? .nearFailureLastTime
                : (last.maxReps < slot.repMin ? .belowRepFloor : nil)
            if let easeReason {
                let nextLoad = last.topWeightKg - step
                if nextLoad < step {
                    // 减到最小一片以下 = 连最轻外加负重都吃力 → 回退换自重孪生（数轴不跨零）。
                    // reason **无条件**标 degraded（审查 MAJOR）：正常阶梯是 自重→负重，回退时
                    // 已有自重历史，若学 assisted 用 twinLast==nil 条件则提示永不出现。回退是事件
                    // 不是里程碑，每次都该标；change 仍由自重历史决定（reason=为何切、change=次数向）。
                    if let twin = graduationTwin(for: entry, catalog: catalog) {
                        let twinLast = lastPerformance(exerciseId: twin.id, sessions: input.sessions)
                        return prescribeBodyweight(
                            entry: twin, slot: slot, last: twinLast, verdict: verdict,
                            phase: phase, forcedReason: .bodyweightPlusDegraded
                        )
                    }
                    // UNREACHABLE：现目录所有 bodyweight-plus 条目均有同族自重孪生；此兜底仅防御
                    // 未来孤立条目（不跨零，保持最小外加负重）。
                    baseLoad = step
                    targetReps = slot.repMax
                    change = .hold
                    reason = .holdProgressing
                } else {
                    baseLoad = nextLoad         // 减外挂负重一档
                    targetReps = slot.repMin
                    change = .ease
                    reason = easeReason
                }
            } else if last.minReps >= slot.repMax, last.minRir.map({ $0 >= progressMinMeanRir }) ?? true,
                      verdict.longGapDays == nil {
                // 回归压制（2026-07-08 审查 S1）：同 external——停练回来不加负重
                baseLoad = last.topWeightKg + step   // 变强 → 加负重一档（无上限）
                targetReps = slot.repMin
                change = .increase
                reason = .repCeilingReached
            } else {
                baseLoad = last.topWeightKg          // 区间内 → 保持
                targetReps = slot.repMax
                change = .hold
                reason = .holdProgressing
            }
        } else {
            baseLoad = ColdStartPrior.scaledStartKg(
                entry.startWeightKg, trainingLevel: input.profile.trainingLevel, stepKg: step
            )
            targetReps = slot.repMin
            change = .start
            reason = .firstExposure
        }

        // 调制同 external：轻练/减载 ×乘数减外加负重（小负重不被取整吃掉）。
        var weight = roundToIncrement(baseLoad, step: step)
        var sets = slot.sets
        var rir = slot.targetRir
        applyPhaseSetsRir(phase, verdict: verdict, sets: &sets, rir: &rir)
        // 重量轴同 external：减载周(0.85)真减外加负重（1.0 不调，modulated 在 1.0 会误减）
        if let phase, verdict.call == .train, phase.weightMultiplier < 1.0 {
            weight = modulated(base: weight, multiplier: phase.weightMultiplier, equipment: "barbell", unit: unit)
        }
        switch verdict.call {
        case .light:
            weight = modulated(base: weight, multiplier: comebackAwareLightMultiplier(verdict: verdict), equipment: "barbell", unit: unit)
        case .deload:
            weight = modulated(base: weight, multiplier: deloadMultiplier, equipment: "barbell", unit: unit)
            sets = max(2, sets - 1)
        case .train, .rest:
            break
        }

        return ExercisePrescriptionPlan(
            exerciseId: entry.id,
            sets: sets,
            restSeconds: slot.rest,
            repLowerBound: slot.repMin,
            repUpperBound: slot.repMax,
            targetReps: targetReps,
            targetWeightKg: weight,
            targetRir: rir,
            previousWeightKg: last?.topWeightKg,
            previousTopReps: last?.repsAtTop,
            nextProjectedWeightKg: roundToIncrement(weight + step, step: step),
            progressionStepKg: step,
            change: change,
            reason: reason,
            loadType: entry.loadType,
            equipment: entry.equipment
        )
    }

    /// 毕业孪生：同主族的 bodyweight 成员（辅助引体 → 自重引体）；无则 nil（兜底保持最小辅助）。
    private static func graduationTwin(for entry: ExerciseCatalogEntry, catalog: ExerciseCatalog) -> ExerciseCatalogEntry? {
        guard let primary = entry.substitutionGroups.first else { return nil }
        // 去顺序化（审查 MINOR）：同主族多个 bodyweight 成员时取 rank 最小（最基础）那个，
        // 不依赖 JSON 顺序——与处方主匹配同口径。
        return catalog.entries
            .filter { !$0.deprecated && $0.loadType == "bodyweight" && $0.substitutionGroups.first == primary }
            .min(by: { ($0.rank, $0.id) < ($1.rank, $1.id) })
    }

    private struct LastPerformance {
        let topWeightKg: Double
        /// 顶组（最重一组）的次数。
        let repsAtTop: Int
        let minReps: Int
        let maxReps: Int
        /// min 口径：最差一组的 RIR（安全优先，见文件头拍板说明）。
        let minRir: Double?
    }

    /// 最近一次包含该动作的 session（按天序号最大者）的工作组摘要。
    /// sticky swaps（wave-9，owner 拍板）：每个 movementPattern → 最近一场含该 pattern
    /// 的 session 里实际做的 exerciseId（含换动作换入的实际动作）。读「实际做了什么」
    /// 故自然 un-stick——换回默认即恢复默认。供 plan() 唯一出现的 pattern 槽位消费。
    private static func lastActualByPattern(
        sessions: [CleanTrainingSession],
        catalog: ExerciseCatalog
    ) -> [String: String] {
        // sticky 仍按 pattern 全局取「上次实际做的」。已知边界（6 天 PPL A/B，Slice 1）：
        // 同 pattern 若同时出现在 A 与 B 日，且用户手动换的动作能同时满足两天的 equipment 约束，
        // 该换会跨 A/B 粘住；新用户无换动作时 A/B 由槽位 equipment/kind 约束天然区分，不受影响。
        // dayCode 级 sticky 需会话存 dayCode 真值（templateId），留作后续增强。
        let ordered = sessions.compactMap { session -> (day: Int, session: CleanTrainingSession)? in
            TrainingDay.dayNumber(fromISO: session.date).map { ($0, session) }
        }.sorted { $0.day > $1.day }   // 最新在前
        var result: [String: String] = [:]
        for (_, session) in ordered {
            for ex in session.exercises {
                guard let pattern = catalog.entry(id: ex.exerciseId)?.movementPattern else { continue }
                if result[pattern] == nil { result[pattern] = ex.exerciseId }
            }
        }
        return result
    }

    /// 「今天本来该练什么」单一真源（无用户覆盖时的轮换结果；含回归重启与每周
    /// 循环模式）。app 层换天头标（isDayOverridden）与「被顶掉的日名」必须走这里，
    /// 与 plan() 内部同一函数——禁止旧公式复算。
    public static func scheduledTodayDayCode(
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        customization: PlanCustomizationInput = .empty,
        rotationOffset: Int = 0,
        weeklyCycleRestart: Bool = false
    ) -> String? {
        let sequence = resolvedDaySequence(splitType: input.program.splitType,
                                           override: customization.daySequence)
        guard !sequence.isEmpty else { return nil }
        let restartToday = (verdict.longGapDays ?? 0) >= comebackRestartGapDays
        return scheduledDayCode(
            sequence: sequence, sessions: input.sessions,
            todayDay: TrainingDay.dayNumber(fromISO: input.todayISO),
            rotationOffset: rotationOffset, weeklyCycleRestart: weeklyCycleRestart,
            restartToday: restartToday)
    }

    private static func scheduledDayCode(
        sequence: [String], sessions: [CleanTrainingSession], todayDay: Int?,
        rotationOffset: Int, weeklyCycleRestart: Bool, restartToday: Bool
    ) -> String {
        let base = rotationBase(sessions: sessions, todayDay: todayDay,
                                rotationOffset: rotationOffset,
                                weeklyCycleRestart: weeklyCycleRestart,
                                restartToday: restartToday)
        return sequence[(base % sequence.count + sequence.count) % sequence.count]
    }

    /// 轮换基数单一真源（今日页 dayCode、Plan 排期投影、日序编辑器预览、提案预览
    /// 的共同 index 原料——审查 S2：投影曾用旧「总场次」公式与今日页分叉）。
    /// weekly = 本 ISO 周完成场次（忽略 offset——换天补偿是顺延型概念）；
    /// 顺延 = 自最近重启点场次 + offset；今天停练 ≥重启线 = 0（序列头）。
    public static func rotationBase(
        sessions: [CleanTrainingSession], todayDay: Int?,
        rotationOffset: Int, weeklyCycleRestart: Bool, restartToday: Bool
    ) -> Int {
        if restartToday { return 0 }
        if weeklyCycleRestart, let todayDay {
            let weekStart = TrainingDay.isoWeekStartDay(of: todayDay)
            return sessions.compactMap { TrainingDay.dayNumber(fromISO: $0.date) }
                .filter { $0 >= weekStart && $0 <= todayDay }.count
        }
        return sessionsSinceLastRestartPoint(sessions: sessions) + rotationOffset
    }

    /// rotationBase 的便捷重载（app 层投影调用：verdict 内含回归重启判定）。
    public static func rotationBase(
        input: CleanTrainingDecisionInput, verdict: TodayVerdict,
        rotationOffset: Int, weeklyCycleRestart: Bool
    ) -> Int {
        rotationBase(sessions: input.sessions,
                     todayDay: TrainingDay.dayNumber(fromISO: input.todayISO),
                     rotationOffset: rotationOffset,
                     weeklyCycleRestart: weeklyCycleRestart,
                     restartToday: (verdict.longGapDays ?? 0) >= comebackRestartGapDays)
    }

    /// 顺延透明化：今天在新 ISO 周、且上一 ISO 周完成场次 < 周计划 → 上周有漏。
    /// 上周零场不算「顺延」（那是缺席语义，归回归协议/正常推进）。
    private static func isCarriedOverFromLastWeek(input: CleanTrainingDecisionInput, todayDay: Int) -> Bool {
        let weekStart = TrainingDay.isoWeekStartDay(of: todayDay)
        let lastWeekStart = weekStart - 7
        let days = input.sessions.compactMap { TrainingDay.dayNumber(fromISO: $0.date) }
        let lastWeekCount = days.filter { $0 >= lastWeekStart && $0 < weekStart }.count
        guard lastWeekCount > 0 else { return false }
        let thisWeekCount = days.filter { $0 >= weekStart && $0 <= todayDay }.count
        guard thisWeekCount == 0 else { return false }   // 本周已练过=正常推进，不再解释
        let planned = input.program.daysPerWeek ?? input.profile.weeklyTrainingDays ?? 0
        return planned > 0 && lastWeekCount < planned
    }

    /// 回归协议：light 乘数按停练时长分档（14-20 ×0.9 / 21-41 ×0.85 / ≥42 ×0.75——
    /// 4 周停练力量降约 5-10%、8 周约 15%，取保守侧；非回归 light 保持 ×0.9）。
    private static func comebackAwareLightMultiplier(verdict: TodayVerdict) -> Double {
        guard let gap = verdict.longGapDays else { return lightMultiplier }
        if gap >= comebackDeepGapDays { return comebackDeepMultiplier }
        if gap >= comebackRestartGapDays { return comebackRestartMultiplier }
        return lightMultiplier
    }

    /// 回归协议：自最近重启点（与前一场日期差 ≥ 重启线的场）以来的场次数。
    /// 无重启点 = 全量场次数（现状等价）。日期不可解析的场保守计入全量。
    private static func sessionsSinceLastRestartPoint(sessions: [CleanTrainingSession]) -> Int {
        let days = sessions.compactMap { TrainingDay.dayNumber(fromISO: $0.date) }.sorted()
        guard days.count > 1 else { return sessions.count }
        var lastRestartIndex = 0
        for index in 1..<days.count where days[index] - days[index - 1] >= comebackRestartGapDays {
            lastRestartIndex = index
        }
        // 解析失败的场不进 days——按全量口径补回差额，保守不虚减
        let unparsed = sessions.count - days.count
        return days.count - lastRestartIndex + unparsed
    }

    private static func lastPerformance(
        exerciseId: String,
        sessions: [CleanTrainingSession]
    ) -> LastPerformance? {
        let candidates = sessions.compactMap { session -> (day: Int, sets: [CleanLoggedSet])? in
            guard let day = TrainingDay.dayNumber(fromISO: session.date) else { return nil }
            let sets = session.exercises.filter { $0.exerciseId == exerciseId }.flatMap(\.sets)
            guard !sets.isEmpty else { return nil }
            return (day, sets)
        }
        guard let latest = candidates.max(by: { $0.day < $1.day }) else { return nil }

        let reps = latest.sets.map(\.reps)
        let rirs = latest.sets.compactMap(\.rir)
        let topSet = latest.sets.max { $0.weight < $1.weight }
        return LastPerformance(
            topWeightKg: topSet?.weight ?? 0,
            repsAtTop: topSet?.reps ?? 0,
            minReps: reps.min() ?? 0,
            maxReps: reps.max() ?? 0,
            minRir: rirs.min()
        )
    }

    private static func roundToIncrement(_ weightKg: Double, step: Double) -> Double {
        max(step, (weightKg / step).rounded() * step)
    }
}
