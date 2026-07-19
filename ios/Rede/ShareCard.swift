import SwiftUI
import UIKit
import RedeL10n
import RedeLocalSnapshot
import RedeTrainingDecision

// FR-SH1 S0 本地分享卡：把 ShareSnapshot（已过隐私过滤的只读派生）渲染成 4:5 海报图 → iOS 分享。
// 全本地、不联网、不写 canonical（§9.6 S0）。卡视图纯数据驱动（不读 environment）→ 可离屏 ImageRenderer。
// 整面板 0 卡公理不约束本文件（分享卡是离屏海报、非屏内 tab；复用 ForgedGrain/RegMark/主题 token 保品牌一致）。

// MARK: - 下载链接（owner 选 App Store；2026-06-27 1.0 过审上架，链接已接真）

enum ShareLinks {
    /// App Store 链接（Rede Strength · Apple ID 6780301633，1.0 过审邮件 2026-06-27 提供）。
    /// 分享文案 = tagline + 此链接；若未来某市场不可用，卡片仍有 shareCardDownloadHint 兜底文案。
    static let appStoreURL: URL? = RedeAppUpdateRuntime.appStoreURL
}

/// FR-SH1：分享卡预览的 Identifiable 载体（[ShareSnapshot] 本身非 Identifiable）。
/// TrainTabView 训练小结、RootTabView 截图钩子共用。
struct SharePreviewItem: Identifiable { let id = UUID(); let snapshots: [ShareSnapshot] }

// MARK: - 卡片显示模型（app 层把 ShareSnapshot + 本地化 → 纯字符串，喂给离屏卡视图）

struct ShareCardModel: Equatable {
    let dateText: String
    let tagline: String
    let downloadHint: String
    let kind: Kind

    enum Kind: Equatable {
        case workout(Workout)
        case pr(PR)
        case muscleLevel(MuscleLevelCard)
    }
    /// 肌群发展画像卡（MLE B5）：tier/balance nil = 不显（校准中/解锁不足，不编数）。
    struct MuscleLevelCard: Equatable {
        let title: String
        let tierText: String?
        let balanceLine: String?
        let rows: [MuscleLevelRow]
    }
    struct MuscleLevelRow: Equatable {
        let name: String
        let levelText: String
        let trendSymbol: String?   // SFSymbol 名；nil = 无箭头
    }
    struct Workout: Equatable {
        let title: String
        let dayName: String?
        let stats: [Stat]
        let patternText: String
        let prBadge: String?     // 非 nil = 本场破 PR 亮点
    }
    struct PR: Equatable {
        let title: String
        let exerciseName: String
        let valueText: String    // 如 "102.5 kg × 5"
        let estimatedBadge: String?
    }
    struct Stat: Equatable {
        let value: String
        let label: String
        /// 数值行内的小字号单位段（如时长档「min/分」）；nil = 纯数字列。
        var unit: String? = nil
    }

    /// 从隐私过滤后的 ShareSnapshot 构造（动作/模式/训练日名经 LocaleStore 本地化，重量经 LoadDisplay 吸附口径）。
    @MainActor
    static func make(from snapshot: ShareSnapshot, localeStore: LocaleStore) -> ShareCardModel {
        let s = localeStore.strings
        let date = displayDate(snapshot.generatedDateISO, locale: localeStore.locale)
        switch snapshot.content {
        case let .workoutSummary(w):
            let stats = [
                Stat(value: "\(w.exerciseCount)", label: s.shareCardStatExercises),
                Stat(value: "\(w.setCount)", label: s.shareCardStatSets),
                Stat(value: s.shareCardDurationBandValue(bandLabel(w.durationBand)),
                     label: s.shareCardStatDuration, unit: s.shareCardDurationUnit),
            ]
            let patternText = w.patterns.map(s.movementPatternLabel).joined(separator: " · ")
            return ShareCardModel(
                dateText: date, tagline: s.shareCardTagline, downloadHint: s.shareCardDownloadHint,
                kind: .workout(.init(
                    title: s.shareCardWorkoutTitle,
                    dayName: w.dayCode.map(s.trainingDayName),
                    stats: stats, patternText: patternText,
                    prBadge: w.hadPR ? s.shareCardPRBadge : nil))
            )
        case let .muscleLevel(m):
            // 镜像枚举本地化（MuscleLevelCopy 同包复用）；未知 rawValue 如实回落原码
            let tierText = m.tierRaw.flatMap(TrainingTierLabel.init(rawValue:)).map(s.trainingTierName)
            let rows = m.muscles.map { row in
                MuscleLevelRow(
                    name: MuscleGroupLabel(rawValue: row.muscleRaw).map(s.muscleGroupName) ?? row.muscleRaw,
                    levelText: s.developmentLevel(row.level),
                    trendSymbol: row.trendRaw == "rising" ? "arrow.up.right"
                        : (row.trendRaw == "declining" ? "arrow.down.right" : nil))
            }
            return ShareCardModel(
                dateText: date, tagline: s.shareCardTagline, downloadHint: s.shareCardDownloadHint,
                kind: .muscleLevel(.init(
                    title: s.shareCardMuscleLevelTitle,
                    tierText: tierText,
                    balanceLine: m.balanceScore.map(s.developmentBalanceLine),
                    rows: rows))
            )
        case let .personalRecord(pr):
            // 按当前单位偏好格式化：实测吸附到器械×单位真实梯；估算（e1RM）不吸附（LoadDisplay 契约）。
            let weightText = pr.isEstimated
                ? s.formatKg(pr.weightKg)
                : LoadDisplay.weight(pr.weightKg, exerciseId: pr.exerciseId, s)
            return ShareCardModel(
                dateText: date, tagline: s.shareCardTagline, downloadHint: s.shareCardDownloadHint,
                kind: .pr(.init(
                    title: s.shareCardPRTitle,
                    exerciseName: localeStore.exerciseName(pr.exerciseId),
                    valueText: "\(weightText) \(s.unitLabel) × \(pr.reps)",
                    estimatedBadge: pr.isEstimated ? s.shareCardEstimated : nil))
            )
        }
    }

    /// 跨包枚举映射（RedeL10n 不依赖 RedeLocalSnapshot）。T1 练完态 meta 行复用（internal）。
    static func bandLabel(_ b: ShareDurationBand) -> ShareDurationBandLabel {
        switch b {
        case .under30: return .under30
        case .m30to45: return .m30to45
        case .m45to60: return .m45to60
        case .m60to90: return .m60to90
        case .over90:  return .over90
        }
    }

    private static func displayDate(_ iso: String, locale: RedeLocale) -> String {
        let inFmt = DateFormatter()
        inFmt.locale = Locale(identifier: "en_US_POSIX"); inFmt.dateFormat = "yyyy-MM-dd"
        guard let d = inFmt.date(from: iso) else { return "" } // 解析失败不把原始技术串暴露到卡面（审查 MINOR）
        let out = DateFormatter()
        out.locale = Locale(identifier: locale == .zh ? "zh_CN" : "en_US")
        out.setLocalizedDateFormatFromTemplate("yMMMMd")
        return out.string(from: d)
    }
}

// MARK: - 离屏卡视图（4:5；纯模型驱动、不读 environment——保证 ImageRenderer 渲染稳定）

struct ShareCardView: View {
    let model: ShareCardModel
    static let logicalSize = CGSize(width: 360, height: 450) // ×scale3 = 1080×1350

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.redeBase
            ForgedGrain(intensity: 0.6)
            VStack(alignment: .leading, spacing: 0) {
                header
                Rectangle().fill(Color.redeHair).frame(height: 1).padding(.top, 18)
                Spacer(minLength: 0)
                content
                Spacer(minLength: 0)
                footer
            }
            .padding(28)
            RegMark(corner: .topRight).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).padding(20)
        }
        .frame(width: Self.logicalSize.width, height: Self.logicalSize.height)
        .clipped()
    }

    // REDE 字标 + emberline（设计语言：暖白字 + 2px ember 下划线作"下一步"线索）
    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("REDE")
                .font(.system(size: 22, weight: .bold)).tracking(4)
                .foregroundStyle(Color.redeT1)
            Rectangle().fill(Color.redeEmber).frame(width: 34, height: 2)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.kind {
        case let .workout(w): workoutContent(w)
        case let .pr(pr): prContent(pr)
        case let .muscleLevel(m): muscleLevelContent(m)
        }
    }

    private func muscleLevelContent(_ m: ShareCardModel.MuscleLevelCard) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Overline(text: model.dateText, color: .redeT3)
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(m.title).font(.system(size: 30, weight: .bold)).foregroundStyle(Color.redeT1)
                    if let tier = m.tierText {
                        Text(tier).font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.redeEmber2)
                    }
                }
            }
            VStack(alignment: .leading, spacing: 9) {
                ForEach(Array(m.rows.enumerated()), id: \.offset) { _, row in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(row.name).font(.system(size: 15)).foregroundStyle(Color.redeT1)
                        Text(row.levelText).font(.system(size: 15, weight: .bold)).monospacedDigit()
                            .foregroundStyle(Color.redeEmber2)
                        if let symbol = row.trendSymbol {
                            Image(systemName: symbol).font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(symbol == "arrow.up.right" ? Color.redeEmber2 : Color.redeT3)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
            if let balance = m.balanceLine {
                Text(balance).font(.system(size: 13)).foregroundStyle(Color.redeT3)
            }
        }
    }

    private func workoutContent(_ w: ShareCardModel.Workout) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Overline(text: model.dateText, color: .redeT3)
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(w.title).font(.system(size: 30, weight: .bold)).foregroundStyle(Color.redeT1)
                    if let day = w.dayName {
                        Text(day).font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.redeEmber2)
                    }
                }
                if let badge = w.prBadge { pill(badge) }
            }
            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(w.stats.enumerated()), id: \.offset) { i, stat in
                    if i > 0 { Rectangle().fill(Color.redeHair).frame(width: 1, height: 40) }
                    VStack(alignment: .leading, spacing: 3) {
                        // 数值行「大数字 + 小单位」两段字号；lineLimit(1) 锁单行——
                        // 时长档（"60–90"）在等分列宽下曾破成三行（T5）。
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Text(stat.value).font(.system(size: 30, weight: .bold)).monospacedDigit().foregroundStyle(Color.redeT1)
                            if let unit = stat.unit {
                                Text(unit).font(.system(size: 13, weight: .medium)).foregroundStyle(Color.redeT3)
                            }
                        }
                        .lineLimit(1)
                        Overline(text: stat.label, color: .redeT4)
                    }
                    // 带单位的列（时长档「60–90 min」）按内容取宽，纯数字列均分剩余——
                    // 等分列宽下时长值必破行/截断，数字一律不缩放（T5）。
                    .frame(maxWidth: stat.unit == nil ? .infinity : nil, alignment: .leading)
                    .fixedSize(horizontal: stat.unit != nil, vertical: false)
                    .padding(.leading, i > 0 ? 14 : 0)
                }
            }
            if !w.patternText.isEmpty {
                Text(w.patternText).font(.system(size: 13)).foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func prContent(_ pr: ShareCardModel.PR) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "trophy.fill").font(.system(size: 15)).foregroundStyle(Color.redeEmber)
                Overline(text: pr.title, color: .redeT3)
                if let est = pr.estimatedBadge { pill(est) }
            }
            Text(pr.exerciseName).font(.system(size: 22, weight: .semibold)).foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
            Text(pr.valueText).font(.system(size: 46, weight: .bold)).monospacedDigit().foregroundStyle(Color.redeT1)
        }
    }

    private func pill(_ text: String) -> some View {
        Text(text).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.redeEmber2)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.redeEmber.opacity(0.5), lineWidth: 1))
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Rectangle().fill(Color.redeEmber).frame(width: 34, height: 2)
            Text(model.tagline).font(.system(size: 13, weight: .medium)).foregroundStyle(Color.redeT2)
            Text(model.downloadHint).font(.system(size: 12)).foregroundStyle(Color.redeT4)
        }
    }
}

// MARK: - 会话 → 分享卡快照（经 SharePrivacyFilter；不读盘、不写 canonical）

enum SessionShareSnapshotBuilder {
    /// 从当前内存完成会话构造 [训练总结卡] (+ 破 PR 时追加 [PR 卡])。patterns 经 catalog 取动作模式。
    static func build(summary: SessionSummary, plan: TodayPrescription,
                      now: Date = Date(), catalog: ExerciseCatalog = .minimal) -> [ShareSnapshot] {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.timeZone = .current; fmt.dateFormat = "yyyy-MM-dd"
        let dateISO = fmt.string(from: now)
        let patterns = plan.exercises.compactMap { catalog.entry(id: $0.exerciseId)?.movementPattern }
        var out: [ShareSnapshot] = [
            // exerciseCount = 该训练日处方的动作数（"今天这套练什么"）；用户跳过个别动作的精确完成数
            // 不在 SessionSummary 内，S0 以处方数表达这套训练的规模。
            SharePrivacyFilter.workoutSummary(
                generatedDateISO: dateISO, dayCode: plan.dayCode,
                exerciseCount: plan.exercises.count, setCount: summary.completedSetCount,
                durationSeconds: summary.durationSeconds, patterns: patterns, hadPR: summary.isPersonalRecord)
        ]
        if summary.isPersonalRecord, let top = summary.topSet {
            out.append(SharePrivacyFilter.personalRecord(
                generatedDateISO: dateISO, exerciseId: top.exerciseId, weightKg: top.weightKg,
                reps: top.reps, isEstimated: false))
        }
        return out
    }
}

// MARK: - 离屏渲染（SwiftUI 卡 → UIImage，iOS16+ ImageRenderer；部署目标 iOS17 可用）

enum ShareCardRenderer {
    @MainActor
    static func render(_ model: ShareCardModel) -> UIImage? {
        let renderer = ImageRenderer(content: ShareCardView(model: model))
        renderer.scale = 3                 // 360×450 ×3 = 1080×1350（4:5）
        renderer.isOpaque = true
        return renderer.uiImage
    }
}
