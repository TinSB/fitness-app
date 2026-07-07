// MuscleGroupMapping — 目录细粒度肌群 → MLE 契约 10 值肌群的归并层（MLE D1 2026-07-07）。
//
// 背景：动作目录 primaryMuscle/secondaryMuscles 用 17+ 值细粒度（四个 delt 分开、
// traps/lower-back/adductors 独立），MLE 契约（系统逻辑 §6.5.3）的用户可见等级体系是
// 10 值粗粒度。本文件是两套词汇的唯一翻译点——引擎聚合、里程碑 linkedMuscles、
// 批次 B 的 UI 都经此归并，禁止散落第二份映射。
//
// 归属拍板（owner 2026-07-07，EVIDENCE_LEDGER「MLE 前置调研」）：
// · 四 delt（shoulder/side-delt/rear-delt/front-delt）→ shoulders——用户可见粒度到「肩」，
//   前中后束区分留在动作详情层，不进等级体系。
// · traps / upper-back → back；lower-back → core（竖脊肌群与核心稳定同训练语境）。
// · adductors → glutes（审查 MAJOR 修正：目录已将镜像动作 hip-abduction 判给 glutes，
//   髋内收与外展同属髋关节冠状面家族；内收肌群不参与膝伸、与 quads 功能关联更弱）。
// · forearm → nil **如实排除**：腕弯举类动作对 10 值等级体系零贡献——排除是诚实，
//   硬塞进 back/biceps 是编造（「不给用户看编造数据」红线的映射层执行）。
// 未知值 → nil（防御：目录新增肌群值时聚合静默跳过，覆盖率测试报警提醒补映射）。

import Foundation

/// MLE 契约的 10 值肌群（系统逻辑 §6.5.3 拍板；rawValue 即契约枚举值）。
public enum MuscleGroupID: String, CaseIterable, Equatable, Sendable, Codable {
    case chest, back, quads, hamstrings, glutes
    case shoulders, biceps, triceps, calves, core
}

public enum MuscleGroupMapping {
    /// 目录肌群取值 → 契约肌群；nil = 如实排除（forearm）或未知值防御。
    public static func group(forCatalogMuscle muscle: String) -> MuscleGroupID? {
        switch muscle {
        case "chest": return .chest
        case "back", "traps", "upper-back": return .back
        case "quads": return .quads
        case "hamstrings": return .hamstrings
        case "glutes", "adductors": return .glutes
        case "shoulder", "side-delt", "rear-delt", "front-delt": return .shoulders
        case "biceps": return .biceps
        case "triceps": return .triceps
        case "calves": return .calves
        case "core", "lower-back": return .core
        default: return nil
        }
    }
}
