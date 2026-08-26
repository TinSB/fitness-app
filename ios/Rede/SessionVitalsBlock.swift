// 单场生命体征区块（自有运动记录 A2/B，2026-08-26）。
//
// 为什么自己画而不用图表库：这一页的差异化恰恰在于**苹果画不出来的那张图**——
// 它记你的心率，但不知道你哪一分钟在做哪一组。把「组」的刻线压在心率曲线下面，
// 才是 Rede 独有的那一层。库存图表控件给不了这个，而且它自带的网格、图例、
// 圆点标记与本项目的刻线语言互相打架（§12.1 整面板公理 / owner 视觉基准）。
//
// 纪律两条：
// · 不用 ember。橙色只指下一步；这是已经发生过的一场，没有下一步（§1.3）。
// · 不标注、不解释。图自己会说话，加箭头和气泡是最廉价的做法（owner 截图基准）。

import SwiftUI
import RedeHealthKit
import RedeL10n
import RedeLocalSnapshot

/// 数值行：时长 / 平均心率 / 峰值 / 活动能量。缺哪项就不占位——
/// 显示 “--” 只是把「没有」画成了「有一个空的」。
struct SessionVitalsStats: View {
    let vitals: SessionVitals
    let s: RedeStrings

    private var items: [(String, String)] {
        var out: [(String, String)] = [(s.vitalsMinutes(vitals.durationSeconds / 60), s.vitalsDuration)]
        if let avg = vitals.averageHeartRate { out.append(("\(avg)", s.vitalsAvgHeartRate)) }
        if let peak = vitals.peakHeartRate { out.append(("\(peak)", s.vitalsPeakHeartRate)) }
        if let kcal = vitals.activeEnergyKcal { out.append((s.vitalsKcal(kcal), s.vitalsActiveEnergy)) }
        return out
    }

    var body: some View {
        // 四项等宽平铺、各自单行。之前是 HStack + 自然宽度，结果带单位的两项
        // （42 min / 342 kcal）折行、不带单位的两项不折，四个数字的基线全乱。
        // 数值一律 headline 而不是 title：一行放四个数，title 只能靠缩放救，缩完还是不齐。
        HStack(alignment: .top, spacing: 10) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.0)
                        .font(.redeHeadline)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                        .lineLimit(1).minimumScaleFactor(0.6)
                    Text(item.1)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                        .lineLimit(2).minimumScaleFactor(0.8)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

/// 心率曲线 + 组刻线。横轴是这一场从头到尾，纵轴自适应到本场心率的真实区间
/// （不从 0 起：从 0 起会把整条曲线压成一条直线，那是把「看起来严谨」放在可读之前）。
struct HeartRateTrace: View {
    let series: [HeartRatePoint]
    /// 每一组记下的时刻（距开始秒数）。空 = 那一场没有逐组时间，只画曲线。
    let setMarks: [Int]
    let totalSeconds: Int
    let s: RedeStrings

    private var bounds: (lo: Double, hi: Double)? {
        let values = series.map { Double($0.bpm) }
        guard let lo = values.min(), let hi = values.max(), hi > lo else { return nil }
        // 上下各留一成余量，峰值不贴边、谷底不压线。
        let pad = max(4, (hi - lo) * 0.12)
        return (lo - pad, hi + pad)
    }

    var body: some View {
        if series.count >= 2, totalSeconds > 0, let bounds {
            VStack(alignment: .leading, spacing: 6) {
                Canvas { context, size in
                    let railY = size.height - 9

                    func x(_ seconds: Int) -> CGFloat {
                        size.width * CGFloat(min(max(seconds, 0), totalSeconds)) / CGFloat(totalSeconds)
                    }
                    func y(_ bpm: Int) -> CGFloat {
                        let t = (Double(bpm) - bounds.lo) / (bounds.hi - bounds.lo)
                        return railY * CGFloat(1 - min(max(t, 0), 1))
                    }

                    // 上下两条刻线 = 这一屏的框，不画网格：网格是图表控件的口音。
                    for lineY in [CGFloat(0.5), railY] {
                        var rail = Path()
                        rail.move(to: CGPoint(x: 0, y: lineY))
                        rail.addLine(to: CGPoint(x: size.width, y: lineY))
                        context.stroke(rail, with: .color(Color.redeEtch), lineWidth: 1)
                    }

                    var trace = Path()
                    for (index, point) in series.enumerated() {
                        let p = CGPoint(x: x(point.secondsFromStart), y: y(point.bpm))
                        if index == 0 { trace.move(to: p) } else { trace.addLine(to: p) }
                    }
                    context.stroke(trace, with: .color(Color.redeT2),
                                   style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))

                    // 组刻线：坐在下轨上、向上咬进曲线区一小截。用 T4 而不是 ember——
                    // 这些不是「下一步」，是已经发生的事实。
                    for mark in setMarks {
                        var tick = Path()
                        tick.move(to: CGPoint(x: x(mark), y: railY))
                        tick.addLine(to: CGPoint(x: x(mark), y: railY - 7))
                        context.stroke(tick, with: .color(Color.redeT4), lineWidth: 1)
                    }
                }
                .frame(height: 132)

                HStack {
                    Text(s.vitalsElapsedMark(0))
                    Spacer()
                    if !setMarks.isEmpty {
                        Text(s.vitalsSetMarksNote)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                    Spacer()
                    Text(s.vitalsElapsedMark(totalSeconds / 60))
                }
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
            }
        }
    }
}

// MARK: - 读取与截图夹具
//
// 放在这里而不是 ProgressTabView：那份文件已经够长，而这一整块（读健康 + 组刻线换算 +
// 预览夹具）是自成一体的一件事。


extension ProgressTabView {
    /// 把这一场对回「健康」里的那条体能训练。
    ///
    /// 没有起止时刻（旧数据）→ 直接不读：没有时间窗就没法确定是哪一场，
    /// 与其按日期猜一条，不如什么都不显示。
    static func loadVitals(for record: SnapshotSessionRecord) async -> SessionVitals? {
        #if DEBUG
        if CommandLine.arguments.contains("-historyDetailFixture") { return vitalsFixture }
        #endif
        guard let start = isoDate(record.startedAtISO), let end = isoDate(record.finishedAtISO) else { return nil }
        let reader = HKSessionVitalsReader()
        // 在这里要授权而不是启动时：用户刚点开一场训练的详情，这个询问才有上下文
        //（与体重那条「值先行」同一纪律）。已经问过的系统自己不会再弹。
        _ = await reader.requestReadAuthorization()
        return await reader.vitals(start: start, end: end)
    }

    /// 每一组记下的时刻 → 距开始的秒数。没有 completedAt 的组（本改动之前记的）自然被丢掉，
    /// 那一场就只有曲线没有刻线——比画一堆猜出来的位置诚实。
    static func setMarks(in record: SnapshotSessionRecord) -> [Int] {
        guard let start = isoDate(record.startedAtISO) else { return [] }
        return record.exercises
            .flatMap(\.sets)
            .compactMap { isoDate($0.completedAtISO) }
            .map { Int($0.timeIntervalSince(start).rounded()) }
            .filter { $0 >= 0 }
            .sorted()
    }

    static func isoDate(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let plain = ISO8601DateFormatter()
        if let date = plain.date(from: iso) { return date }
        // 历史数据里有带毫秒的（见 RedeDomain TypedFieldTests 的样本）——两种都认。
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: iso)
    }

    #if DEBUG
    /// 与 vitalsFixture 同一场：14 组摊在 42 分钟里，组时刻与曲线上的冲高对齐。
    static var historyRecordFixture: SnapshotSessionRecord {
        let start = Date().addingTimeInterval(-3 * 3600)
        let iso = ISO8601DateFormatter()
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = .current
        day.dateFormat = "yyyy-MM-dd"
        // 每组 9 个采样点 × 20 秒 = 180 秒一组；组时刻取该组冲高之后那一刻。
        func setTime(_ index: Int) -> String { iso.string(from: start.addingTimeInterval(Double(index) * 180 + 120)) }
        var index = 0
        func sets(_ count: Int, _ kg: Double, _ reps: Int) -> [SnapshotSetRecord] {
            (0..<count).map { _ in
                defer { index += 1 }
                return SnapshotSetRecord(weightKg: kg, reps: reps, completedAtISO: setTime(index))
            }
        }
        let exercises = [
            SnapshotExerciseRecord(exerciseId: "bench-press", sets: sets(4, 60, 8)),
            SnapshotExerciseRecord(exerciseId: "barbell-row", sets: sets(4, 50, 10)),
            SnapshotExerciseRecord(exerciseId: "lat-pulldown", sets: sets(3, 55, 10)),
            SnapshotExerciseRecord(exerciseId: "lateral-raise", sets: sets(3, 10, 12)),
        ]
        return SnapshotSessionRecord(
            id: "fixture-session", dateISO: day.string(from: start), exercises: exercises,
            startedAtISO: iso.string(from: start),
            finishedAtISO: iso.string(from: start.addingTimeInterval(2520))
        )
    }

    /// 截图夹具（沿 -autoOpen* 先例）：模拟器没有心率传感器，也没有真实的健康记录，
    /// 不给一份数据这一整块永远验不了版式。生产不可达。
    static var vitalsFixture: SessionVitals {
        // 一条像真的心率曲线：热身抬升 → 每组冲高、组间回落 → 收尾下行。
        var points: [HeartRatePoint] = []
        var t = 0
        var base = 88.0
        for setIndex in 0..<14 {
            base = min(base + 1.6, 112)
            for step in 0..<9 {
                let arc = sin(Double(step) / 8 * .pi)          // 一组之内冲高再回落
                let bpm = base + arc * (34 + Double(setIndex % 3) * 5)
                points.append(HeartRatePoint(secondsFromStart: t, bpm: Int(bpm.rounded())))
                t += 20
            }
        }
        return SessionVitals(durationSeconds: t, averageHeartRate: 128, peakHeartRate: 163,
                             activeEnergyKcal: 342, heartRateSeries: points)
    }
    #endif
}
