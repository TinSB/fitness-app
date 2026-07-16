// TrainEngineCopy — M3-2 训练流文案：typed code → 双语句子（沿 TodayEngineCopy 模式）。
//
// 禁词红线同款（无算法名/「AI 判断」/「系统认为」/「最佳」，有回归测试）；
// 重量一律 kg；疼痛相关句式遵循文案基线 §7.1（不说预防受伤/安全训练，
// 用「暂停、调整动作，或咨询专业人士」口径）。

import Foundation

extension RedeStrings {
    // MARK: - 头部与进度

    public func trainProgress(exercise: Int, exerciseTotal: Int, set: Int, setTotal: Int) -> String {
        locale == .zh
            ? "动作 \(exercise)/\(exerciseTotal) · 第 \(set)/\(setTotal) 组"
            : "Exercise \(exercise) of \(exerciseTotal) · Set \(set) of \(setTotal)"
    }

    // MARK: - 当前组卡

    /// RIR 数值：整数去尾零（2.0 → "2"，1.5 → "1.5"）。
    public func formatRir(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }

    /// "kg · × 6 · RIR 2"（大数字后缀）。
    public func trainLoadSuffix(targetReps: Int, targetRir: Double) -> String {
        "\(unitLabel) · × \(targetReps) · RIR \(formatRir(targetRir))"
    }

    /// 大数字后缀（RIR 可空：快改面选「不记」时显示 "RIR —"）。
    public func trainLoadSuffix(targetReps: Int, targetRir: Double?) -> String {
        "\(unitLabel) · × \(targetReps) · RIR \(targetRir.map(formatRir) ?? "—")"
    }

    /// 下一组建议的 why 行（NextSetReason code → 句子）。
    public func nextSetWhy(reasonCode: String, fromKg: String?) -> String {
        switch reasonCode {
        case "lastSetNearFailure":
            let from = fromKg ?? "—"
            return locale == .zh ? "上组接近力竭，从 \(from) 回调" : "Eased from \(from), last set hit failure"
        case "belowRepFloor":
            let from = fromKg ?? "—"
            return locale == .zh ? "上组次数掉出区间，从 \(from) 回调" : "Eased from \(from), reps fell short"
        case "painReported":
            return locale == .zh ? "已登记不适，本组先降一档" : "Discomfort noted, easing this set"
        default:
            return locale == .zh ? "按上组表现延续" : "Carrying your last set forward"
        }
    }

    /// 首组（还没有「上一组」）的 why 行。
    public var firstSetWhy: String {
        locale == .zh ? "按计划目标开始" : "Starting at plan target"
    }

    /// Hold 按钮：未开 "保持 60" / 已开 "保持中 60"。
    public func holdLabel(kg: String, holding: Bool) -> String {
        if locale == .zh {
            return holding ? "保持中 \(kg)" : "保持 \(kg)"
        }
        return holding ? "Holding \(kg)" : "Hold \(kg)"
    }

    public var holdWhyLine: String {
        locale == .zh ? "按计划重量保持，微调已暂停" : "Held at plan, auto-adjust paused"
    }

    /// 键盘工具条提交键（decimal 键盘无回车）。
    public var adjustDone: String { locale == .zh ? "完成" : "Done" }

    /// 快改入口的一次性提示（FR-TR2 可见性；用过即不再显示）。
    public var adjustDiscoverHint: String {
        locale == .zh ? "点重量可调整　之后的建议随之更新" : "Tap the weight to adjust. Suggestions follow your change"
    }

    // MARK: - 休息态

    public var restLabel: String { locale == .zh ? "休息" : "Rest" }
    public var restAdd30: String { "+30s" }
    public var restPause: String { locale == .zh ? "暂停" : "Pause" }
    public var restResume: String { locale == .zh ? "继续" : "Resume" }
    public var restNextSet: String { locale == .zh ? "下一组" : "Next set" }

    /// "下一组 · 第 2 组 · 60 kg × 6"。
    public func restNextPreview(setNumber: Int, kg: String, reps: Int) -> String {
        locale == .zh
            ? "下一组 · 第 \(setNumber) 组 · \(kg) \(unitLabel) × \(reps)"
            : "Next · Set \(setNumber) · \(kg) \(unitLabel) × \(reps)"
    }

    /// 动作间休息预告："接下来 · 高位下拉"。
    public func restNextExercise(_ name: String) -> String {
        locale == .zh ? "接下来 · \(name)" : "Up next · \(name)"
    }

    // MARK: - 快改（FR-TR2；M5-3 刻度轨：语义档位 + 预演）

    public var adjustTitle: String { locale == .zh ? "调整本组" : "Adjust this set" }
    public var adjustWeight: String { locale == .zh ? "重量" : "Weight" }
    /// 辅助器械（wave-9）：重量轴标签读「辅助」（快改刻度轨表头 + 组表列头）。
    public var adjustAssist: String { locale == .zh ? "辅助" : "Assist" }
    /// 负重自重（wave-11）：重量轴标签读「负重」（快改刻度轨表头）。
    public var adjustWeighted: String { locale == .zh ? "负重" : "Load" }
    public var adjustReps: String { locale == .zh ? "次数" : "Reps" }
    public var adjustRir: String { "RIR" }

    /// 档位角色标签（AdjustOption.Role code → 双语短标签；引擎零文案）。
    public func adjustOptionLabel(_ roleCode: String) -> String {
        switch roleCode {
        case "follow": return locale == .zh ? "跟随" : "Follow"
        case "last": return locale == .zh ? "上组" : "Last"
        case "plan": return locale == .zh ? "计划" : "Plan"
        case "lighter": return locale == .zh ? "轻一档" : "Lighter"
        case "heavier": return locale == .zh ? "重一档" : "Heavier"
        default: return roleCode
        }
    }

    public var adjustExact: String { locale == .zh ? "精确" : "Exact" }

    /// RIR 直选带「不记」档（选中则不记 RIR，引擎不猜、不触发力竭规则）。
    public var adjustRirSkip: String { "—" }

    /// 后果预演行："打勾后 · 下一组 52.5 kg"。
    public func adjustPreviewNext(kg: String) -> String {
        locale == .zh ? "打勾后 · 下一组 \(kg) \(unitLabel)" : "After log · next \(kg) \(unitLabel)"
    }

    // MARK: - 自重 train 文案（wave-6：无重量轴，按次数）

    /// 大数字后缀（自重）：「次 · RIR」——大数字已是次数本身。
    public func trainLoadSuffixBodyweight(targetRir: Double?) -> String {
        locale == .zh ? "次 · RIR \(targetRir.map(formatRir) ?? "—")" : "reps · RIR \(targetRir.map(formatRir) ?? "—")"
    }

    /// 下一组 why（自重）：不引用重量，按次数叙述。
    public func nextSetWhyBodyweight(reasonCode: String) -> String {
        switch reasonCode {
        case "lastSetNearFailure": return locale == .zh ? "上组接近力竭，本组稳住次数" : "Last set near failure, hold your reps"
        case "belowRepFloor": return locale == .zh ? "上组次数偏低，本组稳住" : "Reps fell short, steady this set"
        case "painReported": return locale == .zh ? "已登记不适，本组放缓" : "Discomfort noted, ease this set"
        default: return locale == .zh ? "尽力做，记录实际次数" : "Full effort, log your actual reps"
        }
    }

    /// Hold 按钮（自重）：保持目标次数。
    public func holdLabelBodyweight(reps: Int, holding: Bool) -> String {
        if locale == .zh { return holding ? "保持中 ×\(reps)" : "保持 ×\(reps)" }
        return holding ? "Holding ×\(reps)" : "Hold ×\(reps)"
    }

    /// 休息预告（自重）：第 N 组 · ×次。
    public func restNextPreviewBodyweight(setNumber: Int, reps: Int) -> String {
        locale == .zh ? "下一组 · 第 \(setNumber) 组 · × \(reps)" : "Next · Set \(setNumber) · × \(reps)"
    }

    /// 后果预演（自重）：下一组 ×次。
    public func adjustPreviewNextBodyweight(reps: Int) -> String {
        locale == .zh ? "打勾后 · 下一组 × \(reps)" : "After log · next × \(reps)"
    }

    /// 快改入口提示（自重）：点次数可调整。
    public var adjustDiscoverHintBodyweight: String {
        locale == .zh ? "点次数可调整　之后的建议随之更新" : "Tap the reps to adjust. Suggestions follow your change"
    }

    // MARK: - 辅助器械 train 文案（wave-9：有重量轴=辅助量；引擎已翻方向，文案不反读、只加「辅助」）

    /// 下一组 why（辅助）：力竭/挣扎 = 加辅助（更轻=安全）；引擎已把方向翻好，这里如实叙述「加辅助」。
    public func nextSetWhyAssisted(reasonCode: String) -> String {
        switch reasonCode {
        case "lastSetNearFailure": return locale == .zh ? "上组接近力竭，本组加辅助一档" : "Near failure, adding assist this set"
        case "belowRepFloor": return locale == .zh ? "上组次数掉出区间，本组加辅助一档" : "Reps fell short, adding assist this set"
        case "painReported": return locale == .zh ? "已登记不适，本组加辅助一档" : "Discomfort noted, adding assist this set"
        default: return locale == .zh ? "按上组表现延续" : "Carrying your last set forward"
        }
    }

    /// Hold 按钮（辅助）：保持当前辅助量。
    public func holdLabelAssisted(kg: String, holding: Bool) -> String {
        if locale == .zh { return holding ? "保持中 辅助 \(kg)" : "保持 辅助 \(kg)" }
        return holding ? "Holding assist \(kg)" : "Hold assist \(kg)"
    }

    /// 休息预告（辅助）：第 N 组 · 辅助 重 × 次。
    public func restNextPreviewAssisted(setNumber: Int, kg: String, reps: Int) -> String {
        locale == .zh
            ? "下一组 · 第 \(setNumber) 组 · 辅助 \(kg) \(unitLabel) × \(reps)"
            : "Next · Set \(setNumber) · assist \(kg) \(unitLabel) × \(reps)"
    }

    /// 后果预演（辅助）：下一组 辅助 重（引擎已算好下一档辅助量，直接显示，不反读）。
    public func adjustPreviewNextAssisted(kg: String) -> String {
        locale == .zh ? "打勾后 · 下一组 辅助 \(kg) \(unitLabel)" : "After log · next assist \(kg) \(unitLabel)"
    }

    /// 快改入口提示（辅助）：点辅助可调整。
    public var adjustDiscoverHintAssisted: String {
        locale == .zh ? "点辅助可调整　之后的建议随之更新" : "Tap the assist to adjust. Suggestions follow your change"
    }

    /// 辅助量数值前缀（wave-9）：刻度轨档位/组表行裸数值冠「辅助」二字，区别于举起的负重。
    public func assistValue(_ kg: String) -> String {
        locale == .zh ? "辅助 \(kg)" : "assist \(kg)"
    }

    /// 档位角色标签（辅助器械，wave-9）：轻/重一档改「少帮/多帮」——明示辅助方向。
    /// 防误导：辅助「轻一档」是更少辅助=更难，但「轻」听着像更易；用「少帮/多帮」消歧。
    public func adjustOptionLabelAssisted(_ roleCode: String) -> String {
        switch roleCode {
        case "lighter": return locale == .zh ? "少帮" : "Less"
        case "heavier": return locale == .zh ? "多帮" : "More"
        default: return adjustOptionLabel(roleCode)
        }
    }

    // MARK: - 负重自重 train 文案（wave-11：重量轴=外挂负重；方向同 external，文案不反读、加「负重 +」）
    // 注：档位「轻/重一档」对负重自重方向正常（轻=少负重=更易），故直接复用 adjustOptionLabel，无变体。

    /// 下一组 why（负重自重）：力竭/挣扎 = 减外挂负重（方向同 external）。
    public func nextSetWhyBodyweightPlus(reasonCode: String, fromKg: String?) -> String {
        switch reasonCode {
        case "lastSetNearFailure":
            let from = fromKg ?? "—"
            return locale == .zh ? "上组接近力竭，从 负重 +\(from) 回调" : "Eased from weighted +\(from), last set hit failure"
        case "belowRepFloor":
            let from = fromKg ?? "—"
            return locale == .zh ? "上组次数掉出区间，从 负重 +\(from) 回调" : "Eased from weighted +\(from), reps fell short"
        case "painReported":
            return locale == .zh ? "已登记不适，本组减负重一档" : "Discomfort noted, easing this set"
        default:
            return locale == .zh ? "按上组表现延续" : "Carrying your last set forward"
        }
    }

    /// Hold 按钮（负重自重）：保持当前外挂负重。
    public func holdLabelBodyweightPlus(kg: String, holding: Bool) -> String {
        if locale == .zh { return holding ? "保持中 负重 +\(kg)" : "保持 负重 +\(kg)" }
        return holding ? "Holding weighted +\(kg)" : "Hold weighted +\(kg)"
    }

    /// 休息预告（负重自重）：第 N 组 · 负重 +重 × 次。
    public func restNextPreviewBodyweightPlus(setNumber: Int, kg: String, reps: Int) -> String {
        locale == .zh
            ? "下一组 · 第 \(setNumber) 组 · 负重 +\(kg) \(unitLabel) × \(reps)"
            : "Next · Set \(setNumber) · weighted +\(kg) \(unitLabel) × \(reps)"
    }

    /// 后果预演（负重自重）：下一组 负重 +重。
    public func adjustPreviewNextBodyweightPlus(kg: String) -> String {
        locale == .zh ? "打勾后 · 下一组 负重 +\(kg) \(unitLabel)" : "After log · next weighted +\(kg) \(unitLabel)"
    }

    /// 快改入口提示（负重自重）：点负重可调整。
    public var adjustDiscoverHintBodyweightPlus: String {
        locale == .zh ? "点负重可调整　之后的建议随之更新" : "Tap the load to adjust. Suggestions follow your change"
    }

    /// 外挂负重数值前缀（wave-11）：VoiceOver 用——孤立朗读「负重 +20 kg」比裸值清楚。
    public func weightedValue(_ kg: String) -> String {
        locale == .zh ? "负重 +\(kg)" : "weighted +\(kg)"
    }

    /// 预演短注（NextSetReason code → 短语；onPlan 不加注）。
    public func adjustPreviewNote(reasonCode: String) -> String? {
        switch reasonCode {
        case "lastSetNearFailure":
            return locale == .zh ? "接近力竭，先回一档" : "easing after near failure"
        case "belowRepFloor":
            return locale == .zh ? "次数掉出区间，先回一档" : "reps fell short, easing"
        case "painReported":
            return locale == .zh ? "已登记不适，先回一档" : "discomfort noted, easing"
        default:
            return nil
        }
    }

    /// 最后一组的预演（打勾后动作结束）。
    public var adjustPreviewComplete: String {
        locale == .zh ? "打勾后 · 本动作完成" : "After log · exercise complete"
    }

    // MARK: - 跳过 / 替换 / 疼痛（FR-TR5/6/7）

    public var moreActions: String { locale == .zh ? "更多" : "More" }
    public var skipSetAction: String { locale == .zh ? "跳过本组" : "Skip this set" }
    public var skipExerciseAction: String { locale == .zh ? "跳过这个动作" : "Skip this exercise" }
    public var swapExerciseAction: String { locale == .zh ? "换一个动作" : "Swap exercise" }

    public func skipReasonLabel(_ code: String) -> String {
        switch code {
        case "equipmentBusy": return locale == .zh ? "器械被占用" : "Equipment busy"
        case "painDiscomfort": return locale == .zh ? "不适/疼痛" : "Discomfort"
        case "fatigue": return locale == .zh ? "太疲劳" : "Too fatigued"
        case "timeShort": return locale == .zh ? "时间不够" : "Short on time"
        default: return locale == .zh ? "其他" : "Other"
        }
    }

    public var painAction: String { locale == .zh ? "登记不适" : "Log discomfort" }
    public var painRegistered: String {
        locale == .zh ? "已记下　随后降一档" : "Noted. Easing off after this set"
    }
    /// 合规警示句（文案基线 §7.1 批准口径）。
    public var painAdvisory: String {
        locale == .zh
            ? "出现疼痛时暂停、调整动作，或咨询专业人士"
            : "If pain shows up, pause, adjust the movement, or talk to a professional"
    }

    // MARK: - 收尾确认与小结（FR-TR8 前半）

    public var endWorkoutTitle: String { locale == .zh ? "结束训练？" : "End workout?" }
    public func endWorkoutRemaining(exercisesLeft: Int) -> String {
        locale == .zh ? "还剩 \(exercisesLeft) 个动作" : "\(exercisesLeft) exercises left"
    }
    public var endWorkoutKeptNote: String {
        locale == .zh ? "已完成的组都会保留" : "Your logged sets are kept"
    }
    public var endWorkoutConfirm: String { locale == .zh ? "结束训练" : "End workout" }
    public var keepTraining: String { locale == .zh ? "继续练" : "Keep training" }
    /// 放弃本次训练（不保存）——进行中训练的取消出口（2026-06-13 owner 反馈）。
    public var endWorkoutDiscard: String { locale == .zh ? "放弃本次训练" : "Discard workout" }
    public var endWorkoutDiscardNote: String {
        locale == .zh ? "不保存任何记录，回到今日" : "Nothing is saved. Back to Today"
    }

    public var summaryTitle: String { locale == .zh ? "训练完成" : "Session complete" }
    public func summaryMeta(minutes: Int) -> String {
        locale == .zh ? "\(minutes) 分钟 · 收工" : "\(minutes) min · done"
    }
    public var summaryVolume: String { locale == .zh ? "总量 \(unitLabel)" : "Volume \(unitLabel)" }
    public var summarySets: String { locale == .zh ? "组数" : "Sets" }
    public var summaryPr: String { "PR" }
    public func summaryTopSet(name: String, kg: String, reps: Int) -> String {
        locale == .zh ? "顶组 · \(name) \(kg) \(unitLabel) × \(reps)" : "Top set · \(name) \(kg) \(unitLabel) × \(reps)"
    }
    /// 自重顶组（wave-6）：无重量轴——只显次数。
    public func summaryTopSetBodyweight(name: String, reps: Int) -> String {
        locale == .zh ? "顶组 · \(name) × \(reps)" : "Top set · \(name) × \(reps)"
    }
    /// 负重自重顶组（wave-11）：外挂负重计入顶组/PR，冠「负重 +」前缀。
    public func summaryTopSetBodyweightPlus(name: String, kg: String, reps: Int) -> String {
        locale == .zh ? "顶组 · \(name) 负重 +\(kg) \(unitLabel) × \(reps)" : "Top set · \(name) weighted +\(kg) \(unitLabel) × \(reps)"
    }
    public var summaryDone: String { locale == .zh ? "完成" : "Done" }
    public var summarySaveAndFinish: String { locale == .zh ? "保存并完成" : "Save & finish" }
    public var summaryRetrySave: String { locale == .zh ? "重试保存" : "Retry save" }
    /// 写入失败如实呈现（FR-TR8：绝不假装成功）。
    public var saveFailedLine: String {
        locale == .zh ? "保存失败　你的记录还在本页，可重试" : "Save failed. Your sets are still here. Try again"
    }

    // MARK: - 恢复进行中训练（FR-TR9）

    public var resumeSessionTitle: String { locale == .zh ? "继续进行中的训练？" : "Resume your session?" }
    public var resumeSessionMessage: String {
        locale == .zh ? "上次训练没有完成，已完成的组都还在" : "Your last session wasn't finished. Your logged sets are still here"
    }
    public var resumeSessionContinue: String { locale == .zh ? "继续训练" : "Resume" }
    public var resumeSessionDiscard: String { locale == .zh ? "放弃" : "Discard" }
    /// 取消按钮必须显式给文案——SwiftUI 自动注入的系统 Cancel 跟随设备语言，
    /// 不理 app 内语言设置（2026-06-10 模拟器实证：中文界面冒英文 Cancel）。
    public var resumeSessionLater: String { locale == .zh ? "稍后再说" : "Not now" }

    /// 训练 tab 无进行中会话时的空态。
    public var trainEmptyTitle: String { locale == .zh ? "今天还没开始训练" : "No session in progress" }
    public var trainEmptyAction: String { locale == .zh ? "去今日页开始" : "Start from Today" }
}
