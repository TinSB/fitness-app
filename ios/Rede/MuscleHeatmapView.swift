// MuscleHeatmapView — 人形肌群热力图（批次 G N1 2026-07-13，去 AI 感第二轮）。
//
// 「展示层热力图零差评」（MLE 前置调研 EVIDENCE_LEDGER 竞品拆解实锤）——把 10 块
// 肌群等级从文字行升级为前/后人形分区色块。风格 = 锻造钢板（直线+斜角切割的分区
// 多边形，贴 §12 工业风；非写实肌肉图非圆润卡通）。纯 SwiftUI Path 手绘零资产零依赖。
//
// 语义合同：着色只表达**等级**（五档 ember 不透明度），校准中 = 细描边无填充（灰屏
// 语义延续）；头/手/脚/前臂 = 轮廓留白（非肌群目标区）。点击区块 → 回调 rawValue
//（调用方复用 MuscleDetailSheet 全链）。热力图是文字行的入口增强、不替换（信息完整性）。
// 小腿前后两面都画、同色同点击目标。

import SwiftUI
import RedeL10n

/// 单块肌群的热力输入。level nil = 校准中（描边态）。
struct HeatmapMuscleState: Equatable {
    let level: Int?
}

struct MuscleHeatmapView: View {
    /// rawValue（契约 10 值）→ 状态；缺键按校准中处理。
    let states: [String: HeatmapMuscleState]
    let onTap: (String) -> Void
    @Environment(LocaleStore.self) private var localeStore
    @State private var tapPulse = 0   // §14.2：点区块进详情 = .selection（同历史行口径）

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        HStack(spacing: 24) {
            bodyFigure(regions: HeatmapBody.front)
            bodyFigure(regions: HeatmapBody.back)
        }
        .frame(maxWidth: .infinity)
        .sensoryFeedback(.selection, trigger: tapPulse)
    }

    private func bodyFigure(regions: [HeatmapBody.Region]) -> some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / HeatmapBody.canvas.width,
                            geo.size.height / HeatmapBody.canvas.height)
            let xOff = (geo.size.width - HeatmapBody.canvas.width * scale) / 2
            ZStack {
                // 非肌群轮廓（头/手/脚）：细刻线，永远不着色
                ForEach(Array(HeatmapBody.silhouette.enumerated()), id: \.offset) { _, points in
                    polygon(points, scale: scale, xOffset: xOff)
                        .stroke(Color.redeEtch, lineWidth: 1)
                }
                ForEach(regions, id: \.id) { region in
                    let state = states[region.muscleRaw]
                    let shape = polygon(region.points, scale: scale, xOffset: xOff)
                    if let level = state?.level {
                        // 已解锁：可点进详情（Button + 按压降亮 §14.1 + selection 触感 §14.2）
                        Button {
                            tapPulse += 1
                            onTap(region.muscleRaw)
                        } label: {
                            ZStack {
                                shape.fill(Color.redeEmber2.opacity(Self.fillOpacity(level: level)))
                                shape.stroke(Color.redeEmber2.opacity(0.5), lineWidth: 0.8)
                            }
                        }
                        .buttonStyle(.redePressableRow)
                        .contentShape(shape)
                        .accessibilityLabel(accessibilityText(region.muscleRaw, level: level))
                        .accessibilityHint(s.developmentExpandHint)
                        // 镜像右板/背面重复板对 VoiceOver 隐藏（同肌群只播一次，防 rotor 重复）
                        .accessibilityHidden(region.id.hasSuffix("-r") || region.id == "calf-b-l")
                    } else {
                        // 校准中：描边无填充（不编数据）——**不可点**（详情页会把占位
                        // Lv.1 渲染成真等级，审查双 lens 实锤红线；折叠语义一致）
                        shape.stroke(Color.redeEtch, lineWidth: 1)
                            .accessibilityHidden(true)   // 状态由文字侧「其余 N 个校准中」播报
                    }
                }
            }
        }
        .aspectRatio(HeatmapBody.canvas.width / HeatmapBody.canvas.height, contentMode: .fit)
    }

    /// 等级 → ember 不透明度五档（Lv1-4 / 5-8 / 9-12 / 13-16 / 17-20）。
    static func fillOpacity(level: Int) -> Double {
        switch level {
        case ..<5: return 0.18
        case 5..<9: return 0.34
        case 9..<13: return 0.52
        case 13..<17: return 0.72
        default: return 0.90
        }
    }

    private func accessibilityText(_ raw: String, level: Int?) -> String {
        let name = MuscleGroupLabel(rawValue: raw).map { s.muscleGroupName($0) } ?? raw
        if let level { return s.developmentRowA11y(muscle: name, level: level, decision: nil) }
        return name
    }

    private func polygon(_ points: [CGPoint], scale: CGFloat, xOffset: CGFloat) -> Path {
        Path { path in
            guard let first = points.first else { return }
            path.move(to: CGPoint(x: first.x * scale + xOffset, y: first.y * scale))
            for pt in points.dropFirst() {
                path.addLine(to: CGPoint(x: pt.x * scale + xOffset, y: pt.y * scale))
            }
            path.closeSubpath()
        }
    }
}

/// 钢板人形坐标表（画布 100×220；右侧区块 = 左侧 x 镜像）。
/// 顶点刻意少（4-6 点）带斜切角——锻造板拼接感；区块间留 ~2pt 缝。
enum HeatmapBody {
    static let canvas = CGSize(width: 100, height: 220)

    struct Region {
        let id: String          // 唯一（左右两块同肌群用 -l/-r 后缀）
        let muscleRaw: String   // 契约 rawValue
        let points: [CGPoint]
    }

    private static func mirrored(_ id: String, _ muscle: String, _ pts: [(CGFloat, CGFloat)]) -> [Region] {
        let left = Region(id: id + "-l", muscleRaw: muscle, points: pts.map { CGPoint(x: $0.0, y: $0.1) })
        let right = Region(id: id + "-r", muscleRaw: muscle, points: pts.map { CGPoint(x: 100 - $0.0, y: $0.1) })
        return [left, right]
    }

    private static func single(_ id: String, _ muscle: String, _ pts: [(CGFloat, CGFloat)]) -> Region {
        Region(id: id, muscleRaw: muscle, points: pts.map { CGPoint(x: $0.0, y: $0.1) })
    }

    /// 头/颈/手/脚：两面共用的留白轮廓（细刻线）。
    static let silhouette: [[CGPoint]] = [
        // 头（八角，收小）+ 颈（梯形补位）
        [(45, 4), (55, 4), (58, 8), (58, 15), (55, 19), (45, 19), (42, 15), (42, 8)],
        [(46, 20), (54, 20), (55, 25), (45, 25)],
        // 左手 / 右手
        [(8, 90), (16, 88), (17, 98), (9, 100)], [(92, 90), (84, 88), (83, 98), (91, 100)],
        // 左脚 / 右脚
        [(34, 206), (44, 206), (44, 214), (32, 214)], [(66, 206), (56, 206), (56, 214), (68, 214)],
    ].map { $0.map { CGPoint(x: $0.0, y: $0.1) } }

    /// 正面：肩(前)/胸/肱二/核心/腿前/小腿。肩板顶边水平（对称不打八字）。
    static let front: [Region] =
        mirrored("shoulder-f", "shoulders", [(17, 28), (35, 28), (36, 39), (20, 43)])
        + [single("chest", "chest", [(38, 28), (62, 28), (60, 54), (50, 58), (40, 54)])]
        + mirrored("biceps", "biceps", [(12, 46), (25, 44), (27, 66), (15, 68)])
        + [single("core", "core", [(40, 58), (60, 58), (58, 94), (50, 98), (42, 94)])]
        + mirrored("quads", "quads", [(36, 100), (48, 100), (47, 148), (36, 146)])
        + mirrored("calf-f", "calves", [(35, 156), (46, 154), (45, 198), (37, 198)])

    /// 背面：背/肱三/臀/腿后/小腿（腰背下段留缝——core 属正面语义）。
    static let back: [Region] =
        [single("back", "back", [(36, 26), (64, 26), (62, 62), (50, 66), (38, 62)])]
        + mirrored("triceps", "triceps", [(12, 44), (25, 42), (27, 66), (14, 68)])
        + [single("glutes", "glutes", [(39, 70), (61, 70), (59, 92), (50, 96), (41, 92)])]
        + mirrored("hams", "hamstrings", [(36, 100), (48, 100), (47, 148), (36, 146)])
        + mirrored("calf-b", "calves", [(35, 156), (46, 154), (45, 198), (37, 198)])
}
