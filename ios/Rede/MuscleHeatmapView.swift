// MuscleHeatmapView — 人形肌群热力图 v2（批次 G N1 2026-07-13；同日 owner「太简陋
// 没设计感」→ 造型重做：完整人体剪影打底 + 曲线肌群板块，不再是散落的直边梯形）。
//
// 造型语言：人体剪影 = 头/颈/躯干（含斜方坡）/骨盆楔/四肢胶囊的**纯填充并集**
//（redeRaised，同色填充拼缝不可见——注意镜像路径方向相反，必须逐 part 填充，
// 合并一次 fill 会 winding 抵消出洞）；肌群板块 = 统一 rpoly 圆角多边形（每顶点
// 独立圆角），前/背双人形。纯 SwiftUI Path 手绘零资产零依赖。
//
// 语义合同（v1 延续）：着色只表达**等级**（五档 ember 不透明度），校准中 = 细描边
// 无填充（不编数据）且**不可点**（详情页会把占位 Lv.1 渲染成真等级——审查红线）；
// 头/颈/前臂/手/脚 = 剪影留白（非肌群目标区）。点击区块 → 回调 rawValue（调用方
// 复用 MuscleDetailSheet 全链）。热力图是文字行的入口增强、不替换（信息完整性）。
// 同肌群多板块（左右镜像、斜方+背阔、腹柱+侧斜、小腿前后）同色同点击目标，
// VoiceOver 只播 a11yPrimary 板块一次。

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
            bodyFigure(regions: HeatmapBody.front, isFront: true)
            bodyFigure(regions: HeatmapBody.back, isFront: false)
        }
        .frame(maxWidth: .infinity)
        .sensoryFeedback(.selection, trigger: tapPulse)
    }

    private func bodyFigure(regions: [HeatmapBody.Region], isFront: Bool) -> some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / HeatmapBody.canvas.width,
                            geo.size.height / HeatmapBody.canvas.height)
            let xOff = (geo.size.width - HeatmapBody.canvas.width * scale) / 2
            let transform = CGAffineTransform(translationX: xOff, y: 0)
                .scaledBy(x: scale, y: scale)
            ZStack {
                // 人体剪影底（逐 part 填充，见文件头 winding 注意）
                ForEach(HeatmapBody.silhouette.indices, id: \.self) { i in
                    Path(HeatmapBody.silhouette[i]).applying(transform)
                        .fill(Color.redeRaised)
                }
                ForEach(regions, id: \.id) { region in
                    let state = states[region.muscleRaw]
                    let shape = Path(region.path).applying(transform)
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
                        // 同肌群多板块对 VoiceOver 只播主板一次（防 rotor 重复）
                        .accessibilityHidden(!region.a11yPrimary)
                    } else {
                        // 校准中：描边无填充（不编数据）——不可点（详情页会把占位
                        // Lv.1 渲染成真等级，审查红线；折叠语义一致）
                        shape.stroke(Color.redeEtch, lineWidth: 1)
                            .accessibilityHidden(true)   // 状态由文字侧「其余 N 个校准中」播报
                    }
                }
                // 腹肌分节刻线：core 解锁后的装饰细节（基色刻槽，非交互）
                if isFront, states["core"]?.level != nil {
                    absEtchPath(transform: transform)
                        .stroke(Color.redeBase.opacity(0.55), lineWidth: 0.8)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
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

    private func absEtchPath(transform: CGAffineTransform) -> Path {
        Path { p in
            for line in HeatmapBody.absEtchLines {
                p.move(to: CGPoint(x: line.x1, y: line.y).applying(transform))
                p.addLine(to: CGPoint(x: line.x2, y: line.y).applying(transform))
            }
        }
    }
}

// MARK: - 造型助手（画布坐标 → CGPath）

/// 圆角多边形：每个顶点带独立圆角半径（quad 切角），是所有肌群板块的统一造型语言。
private func rpoly(_ corners: [(x: CGFloat, y: CGFloat, r: CGFloat)]) -> CGPath {
    let path = CGMutablePath()
    let n = corners.count
    assert(n >= 3, "rpoly 至少 3 顶点——静默空板块=该肌群从人形上消失")
    guard n >= 3 else { return path }
    let pts = corners.map { CGPoint(x: $0.x, y: $0.y) }

    func along(_ from: CGPoint, _ to: CGPoint, _ dist: CGFloat) -> CGPoint {
        let dx = to.x - from.x, dy = to.y - from.y
        let len = max(sqrt(dx * dx + dy * dy), 0.001)
        let t = min(dist / len, 0.5)
        return CGPoint(x: from.x + dx * t, y: from.y + dy * t)
    }

    for i in 0..<n {
        let prev = pts[(i + n - 1) % n], cur = pts[i], next = pts[(i + 1) % n]
        let entry = along(cur, prev, corners[i].r)
        let exit = along(cur, next, corners[i].r)
        if i == 0 { path.move(to: entry) } else { path.addLine(to: entry) }
        path.addQuadCurve(to: exit, control: cur)
    }
    path.closeSubpath()
    return path
}

/// 变径胶囊（四肢段）：两端圆头、侧边直线的锥形——剪影专用（纯填充可无缝拼接）。
private func capsule(_ x1: CGFloat, _ y1: CGFloat, _ r1: CGFloat,
                     _ x2: CGFloat, _ y2: CGFloat, _ r2: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let a = CGPoint(x: x1, y: y1), b = CGPoint(x: x2, y: y2)
    let dx = b.x - a.x, dy = b.y - a.y
    let len = max(sqrt(dx * dx + dy * dy), 0.001)
    let ux = dx / len, uy = dy / len          // 轴向
    let px = -uy, py = ux                     // 法向
    let a1 = CGPoint(x: a.x + px * r1, y: a.y + py * r1)
    let a2 = CGPoint(x: a.x - px * r1, y: a.y - py * r1)
    let b1 = CGPoint(x: b.x + px * r2, y: b.y + py * r2)
    let b2 = CGPoint(x: b.x - px * r2, y: b.y - py * r2)
    let aCap = CGPoint(x: a.x - ux * r1, y: a.y - uy * r1)
    let bCap = CGPoint(x: b.x + ux * r2, y: b.y + uy * r2)
    path.move(to: a1)
    path.addLine(to: b1)
    path.addQuadCurve(to: bCap, control: CGPoint(x: b1.x + ux * r2, y: b1.y + uy * r2))
    path.addQuadCurve(to: b2, control: CGPoint(x: b2.x + ux * r2, y: b2.y + uy * r2))
    path.addLine(to: a2)
    path.addQuadCurve(to: aCap, control: CGPoint(x: a2.x - ux * r1, y: a2.y - uy * r1))
    path.addQuadCurve(to: a1, control: CGPoint(x: a1.x - ux * r1, y: a1.y - uy * r1))
    path.closeSubpath()
    return path
}

private func ellipse(_ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat) -> CGPath {
    CGPath(ellipseIn: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2),
           transform: nil)
}

/// x=50 轴镜像。
private func mirroredPath(_ path: CGPath) -> CGPath {
    var t = CGAffineTransform(translationX: 100, y: 0).scaledBy(x: -1, y: 1)
    return path.copy(using: &t) ?? path
}

// MARK: - 形体数据

/// 人形坐标表（画布 100×220；正/背共用同一副剪影；右侧肢体 = 左侧 x 镜像）。
/// 坐标经离线渲染循环迭代定稿（v6，docs/工作记录/2026-07-13-heatmap-v2-*.png）。
enum HeatmapBody {
    static let canvas = CGSize(width: 100, height: 220)

    struct Region {
        let id: String          // 唯一（左右两块同肌群用 -l/-r 后缀）
        let muscleRaw: String   // 契约 rawValue
        let path: CGPath
        let a11yPrimary: Bool   // 同肌群多板块只播报一次
    }

    // 人体剪影：纯填充组件并集（同色填充下拼缝不可见）。
    static let silhouette: [CGPath] = {
        var parts: [CGPath] = []
        // 头 + 颈（颈明显窄于头——头下有收腰，不连成柱）
        parts.append(ellipse(50, 12, 6.2, 6.8))
        parts.append(rpoly([(46.2, 17, 1.5), (53.8, 17, 1.5), (54.8, 26.5, 2), (45.2, 26.5, 2)]))
        // 躯干：顶边带斜方坡（颈根→肩角连续曲线），肩宽 → 腰收 → 髋；骨盆楔填裆
        parts.append(rpoly([
            (31, 27.5, 7),                     // 左肩角
            (41, 23, 9), (59, 23, 9),          // 斜方坡（颈根两侧）
            (69, 27.5, 7),                     // 右肩角
            (70.5, 42, 12),                    // 胸廓外缘
            (64, 86, 16),                      // 腰收
            (67, 103, 9),                      // 髋
            (33, 103, 9),
            (36, 86, 16),
            (29.5, 42, 12),
        ]))
        parts.append(rpoly([(36, 95, 4), (64, 95, 4), (59, 111, 6), (50, 115, 5), (41, 111, 6)]))
        // 左臂（右侧镜像）：肩头（塞进肩角下，顶不高过肩线）+ 上臂 + 前臂 + 手
        var left: [CGPath] = []
        left.append(ellipse(25.5, 33, 6.6, 6.1))                  // 肩头
        left.append(capsule(25.8, 34.5, 6.0, 21.5, 62, 4.4))      // 上臂
        left.append(capsule(21.5, 62, 4.2, 15.5, 90, 3.0))        // 前臂
        left.append(ellipse(14.8, 96.5, 3.1, 4.2))                // 手
        // 左腿：大腿 + 小腿（鼓肚）+ 脚
        left.append(capsule(41.5, 103, 9.4, 40, 150, 5.8))        // 大腿
        left.append(capsule(40, 150, 5.6, 40.5, 167, 6.2))        // 小腿上段
        left.append(capsule(40.5, 167, 6.2, 41, 197, 3.4))        // 小腿下段
        left.append(rpoly([(35.5, 196, 3), (45.5, 196, 3), (45, 206.5, 3.5), (33, 206.5, 4.5)]))
        parts.append(contentsOf: left)
        parts.append(contentsOf: left.map(mirroredPath))
        return parts
    }()

    /// 左侧板块 + 镜像右板（左板为 a11y 主播报）。
    private static func mirrored(_ id: String, _ muscle: String, _ path: CGPath) -> [Region] {
        [Region(id: id + "-l", muscleRaw: muscle, path: path, a11yPrimary: true),
         Region(id: id + "-r", muscleRaw: muscle, path: mirroredPath(path), a11yPrimary: false)]
    }

    private static func nonPrimary(_ regions: [Region]) -> [Region] {
        regions.map { Region(id: $0.id, muscleRaw: $0.muscleRaw, path: $0.path, a11yPrimary: false) }
    }

    private static func single(_ id: String, _ muscle: String, _ path: CGPath) -> Region {
        Region(id: id, muscleRaw: muscle, path: path, a11yPrimary: true)
    }

    // 正面：肩(前束)/胸(双板)/肱二/核心(腹柱+侧斜)/股四/小腿前面。
    // 肩板 = 贴肩弧的圆角帽（不是圆球）：顶边沿剪影肩弧、底边到肱二上缘。
    static let front: [Region] =
        mirrored("shoulder-f", "shoulders", rpoly([
            (20.2, 38, 6), (22, 30, 7), (30.5, 29.5, 5), (31.5, 36, 4), (26.5, 41.5, 5),
        ]))
        + mirrored("pec", "chest", rpoly([
            (33.5, 30, 3), (48.9, 30.5, 2), (48.9, 46.5, 4), (41.5, 50, 5.5), (34, 44, 7),
        ]))
        + mirrored("biceps", "biceps", rpoly([
            (22.8, 45, 4), (28.8, 46.5, 4), (27, 63.5, 5), (21.5, 61.5, 5),
        ]))
        + [single("abs", "core", rpoly([
            (43.5, 53, 4), (56.5, 53, 4), (55.5, 90, 5), (50, 93, 5), (44.5, 90, 5),
        ]))]
        + nonPrimary(mirrored("oblique", "core", rpoly([
            (37.5, 52.5, 4), (41.8, 55.5, 3), (41.8, 86, 3), (39, 82, 6),
        ])))
        + mirrored("quads", "quads", rpoly([
            (34.5, 107, 6), (48, 110.5, 6), (45.5, 146, 7), (36.5, 147, 7),
        ]))
        + mirrored("calf-f", "calves", rpoly([
            (36, 156, 4), (44, 155, 4), (45.3, 170, 7), (40.8, 187, 6), (36.4, 171, 7),
        ]))

    // 背面：斜方(菱)+背阔(翼)=back / 肩(后束)/肱三/臀/腘绳/小腿背面。
    // back 的 a11y 主板 = 斜方菱（背阔翼为补充板）；小腿主板在正面。
    static let back: [Region] =
        [single("traps", "back", rpoly([
            (44, 23.5, 2), (56, 23.5, 2), (63.5, 29.5, 4), (50, 44, 7), (36.5, 29.5, 4),
        ]))]
        + nonPrimary(mirrored("lat", "back", rpoly([
            (31.5, 40, 5), (46, 46.5, 4), (48.9, 51, 3), (45.5, 80, 5), (37.5, 71, 9),
        ])))
        + nonPrimary(mirrored("shoulder-b", "shoulders", rpoly([
            (20.2, 38, 6), (22, 30, 7), (30.5, 29.5, 5), (31.5, 36, 4), (26.5, 41.5, 5),
        ])))
        + mirrored("triceps", "triceps", rpoly([
            (21.8, 44, 4), (27.8, 45.5, 4), (27, 64, 5), (20.5, 61.5, 5),
        ]))
        + mirrored("glutes", "glutes", rpoly([
            (37, 87, 5), (48.9, 88.5, 4), (48.9, 102.5, 6), (39, 103, 9),
        ]))
        + mirrored("hams", "hamstrings", rpoly([
            (35, 108, 5), (47.5, 110, 5), (45.5, 146, 7), (36.5, 147, 7),
        ]))
        + nonPrimary(mirrored("calf-b", "calves", rpoly([
            (40.8, 154, 4), (46, 164, 8), (40.8, 187, 6), (35.6, 165, 8),
        ])))

    /// 腹肌分节刻线（装饰，core 板块内）。
    static let absEtchLines: [(y: CGFloat, x1: CGFloat, x2: CGFloat)] = [
        (63, 44.8, 55.2), (73, 44.8, 55.2), (83, 45.2, 54.8),
    ]
}
