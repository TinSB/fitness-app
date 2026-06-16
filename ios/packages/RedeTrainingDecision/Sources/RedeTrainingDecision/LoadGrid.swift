// LoadGrid — 器械真实档位（owner 拍板「宁大勿小」+ 网络规格调研定稿 2026-06-13）。
//
// 真实健身房按单位原生配置：美制 lb 与公制 kg 是两套物理不同的格子，不是
// 换算关系——美国房哑铃 5 lb 一跳、IWF/欧洲房 2.5 kg 一跳。重量必须落在用户
// 单位的真实可配档位上，否则处方配不出来（例：22.5kg 换算 49.5lb，没有任何
// 哑铃能配出 49.5lb）。
//
// 铁律「宁大勿小」（owner 2026-06-13）：档位宁可粗——给粗了用户能找到对应
// 器械配出来；给细了（如 2.5lb）他健身房没有，记录就和现实对不上。
//
// 调研来源（DEV_LOG 2026-06-13）：哑铃 Rogue/REP 固定架 5lb·商用 kg 2.5kg、
// Bowflex/PowerBlock 可调；杠铃片 IWF TCRR 2020（25/20/15/10/5 + 2.5/2/1.5/1/0.5kg，
// 最小对称跳 2×0.5=1kg）+ 美制 45/35/25/10/5/2.5lb（2×2.5=5lb）；挂片机走奥片
// 对称加载；选重栈 Life Fitness/Cybex 裸栈 10lb/5kg 整片；绳索 2:1 滑轮使手上
// 实际阻力≈栈读数一半。
//
// 单位原生：磅用户重量真住 5lb 格子（45/50/55…），引擎每步加 5lb（=2.268kg），
// 永不出现跳格/丢格；公斤用户住 2.5kg 格子。底层恒存公斤。
//
// 实现要点：引擎现有「按 stepKg 取整」即吸附——把 stepKg 换成本表的器械×单位
// 档位步长（lb 步长折成 kg），roundToIncrement 自动把重量落到真实格子。

public enum LoadUnit: String, Sendable {
    case kg, lb

    /// canonical userProfile.unitSystem 串 → LoadUnit；缺失/未知 → kg
    /// （既有 golden 与无偏好用户口径，不变行为）。
    public init(unitSystem: String?) {
        self = unitSystem == "lb" ? .lb : .kg
    }
}

public enum LoadGrid {
    static let lbPerKg = 2.204_622_621_8

    /// 各器械类真实档位步长（用户单位内的数值；宁大勿小）。
    /// 自由重量 / 挂片机 / 绳索：lb 5 / kg 2.5；
    /// 选重机（裸配重栈整片，加片销不一定有）：lb 10 / kg 5。
    /// 绳索 2:1 滑轮使手上实际阻力≈栈读数一半，故有效步长回到细档 5lb/2.5kg。
    private static let stepInUnit: [String: (kg: Double, lb: Double)] = [
        "barbell":      (kg: 2.5, lb: 5),
        "dumbbell":     (kg: 2.5, lb: 5),
        "plate-loaded": (kg: 2.5, lb: 5),
        "cable":        (kg: 2.5, lb: 5),
        "smith":        (kg: 2.5, lb: 5),   // wave-8：导轨上挂奥片，与杠铃同档
        "selectorized": (kg: 5,   lb: 10),
        "bodyweight":   (kg: 0,   lb: 0),   // 无重量轴：引擎早分支保证不用此值（wave-6）
        "band":         (kg: 0,   lb: 0),   // wave-12：弹力带无 kg 轴（A 案按次数进阶），同自重早分支不用此值
    ]
    /// 未注册器械防御兜底（自由重量档）；实际不可达——进处方的器械都在表内，
    /// 未注册器械在 prescribableLoadTypes 闸前已被拦。
    private static let fallback: (kg: Double, lb: Double) = (kg: 2.5, lb: 5)

    /// 该器械×单位的档位步长，折算成 kg（引擎口径）。
    /// lb 步长换算成 kg 后喂给 roundToIncrement = 吸附到 lb 真实格子
    /// （round 到 5lb÷2.2046=2.268kg 的倍数 ≡ round 到 5lb 的倍数）。
    public static func stepKg(equipment: String, unit: LoadUnit) -> Double {
        let step = stepInUnit[equipment] ?? fallback
        switch unit {
        case .kg: return step.kg
        case .lb: return step.lb / lbPerKg
        }
    }

    /// 负重自重（bodyweight-plus，wave-11）的外挂负重档位：腰带挂奥片 / 脚夹哑铃 =
    /// 自由重量档 2.5kg / 5lb。动作 equipment=bodyweight（step 0），故外加负重轴单独取此。
    public static func addedLoadStepKg(unit: LoadUnit) -> Double {
        stepKg(equipment: "barbell", unit: unit)   // 2.5kg / 5lb
    }

    /// 显示/可调档位所落的格子器械：bodyweight-plus 的可调轴是外加负重（挂片 barbell 格），
    /// 不是动作本身的 bodyweight；其余按动作器械。显示层与快改档位共用，口径一致。
    public static func gridEquipment(loadType: String, equipment: String) -> String {
        loadType == "bodyweight-plus" ? "barbell" : equipment
    }

    // MARK: - 真实梯子（2026-06-15 单位原生重构）

    // 磅哑铃分段梯子（owner 拍板 2026-06-15「轻段细档启用」）：
    // 轻段 2.5lb（5–25）· 中段 5lb（25 以上）。重段 10lb 转跳待真机校准，暂不启用（维持 5lb）。
    // 其余器械×单位均等距，无需显式梯子——snap/next 直接走 stepKg 算术，与旧 roundToIncrement 逐位等价。
    private static let lbDumbbellLadder: [Double] = {
        var rungs: [Double] = []
        var v = 5.0
        while v <= 25.0 { rungs.append(v); v += 2.5 }     // 5, 7.5, …, 25
        v = 30.0
        while v <= 250.0 { rungs.append(v); v += 5.0 }    // 30, 35, …, 250
        return rungs
    }()

    /// 该器械×单位是否走分段梯子（仅磅哑铃）；其余等距。
    private static func isSegmented(equipment: String, unit: LoadUnit) -> Bool {
        unit == .lb && equipment == "dumbbell"
    }

    private static func nearest(_ value: Double, in ladder: [Double]) -> Double {
        ladder.min(by: { abs($0 - value) < abs($1 - value) }) ?? value
    }

    /// 把任意 kg 重量吸附到「器械×单位」真实梯子的**最近**一格（round-to-nearest），返回 kg。
    /// 等距器械（全公斤 + 磅非哑铃）≡ 旧 `roundToIncrement(w, step)`（含 max(step,…) 下限）——公斤零回归。
    /// 磅哑铃走分段梯子。无重量轴（step≤0，如自重/弹力带）→ 原样返回（早分支保证不会进这里）。
    public static func snapKg(_ weightKg: Double, equipment: String, unit: LoadUnit) -> Double {
        if isSegmented(equipment: equipment, unit: unit) {
            let snappedLb = nearest(weightKg * lbPerKg, in: lbDumbbellLadder)
            return snappedLb / lbPerKg
        }
        let step = stepKg(equipment: equipment, unit: unit)
        guard step > 0 else { return weightKg }
        return max(step, (weightKg / step).rounded() * step)
    }

    /// 进阶/回退一档：从当前 kg 重量取梯子上相邻的下一格（up=更重）。返回 kg。
    /// 等距 ≡ snap(w) ± step（与旧引擎 `roundToIncrement(w±step, step)` 行为一致）。
    /// 磅哑铃取分段梯子相邻格（轻段一档=2.5lb、中段=5lb）。下限永远 ≥ 最小一格（不为 0/负）。
    public static func nextRungKg(_ weightKg: Double, equipment: String, unit: LoadUnit, up: Bool) -> Double {
        if isSegmented(equipment: equipment, unit: unit) {
            let lb = weightKg * lbPerKg
            let snapped = nearest(lb, in: lbDumbbellLadder)
            guard let idx = lbDumbbellLadder.firstIndex(of: snapped) else { return snapped / lbPerKg }
            let nextIdx = up ? min(idx + 1, lbDumbbellLadder.count - 1) : max(idx - 1, 0)
            return lbDumbbellLadder[nextIdx] / lbPerKg
        }
        let step = stepKg(equipment: equipment, unit: unit)
        guard step > 0 else { return weightKg }
        let snapped = max(step, (weightKg / step).rounded() * step)
        return up ? snapped + step : max(step, snapped - step)
    }
}
