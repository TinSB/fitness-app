import SwiftUI
import RedeL10n

// MotionSampleView — 动效方向样例（**临时脚手架，非产品代码**）。
//
// 目的：让 owner 直接对比「现在的 sheet 弹出」与「同一元素连续变形」两种手感，
// 拍板方向后再决定是否全面改造。只读假数据，零业务写入，不接引擎。
// 钩子：simctl launch ... -motionSample
//
// 技术约束（决定了改造范围）：matchedGeometryEffect **跨不过 .sheet 边界**——
// sheet 是独立呈现上下文，几何匹配在其中不生效。要做「卡片长大成详情」，
// 详情必须与列表在同一 view 层级里用 overlay 呈现，自行处理遮罩与关闭手势。

private struct SampleExercise: Identifiable {
    let id: String
    let name: String
    let load: String
    let meta: String
    let cues: [String]
}

private let sampleData: [SampleExercise] = [
    .init(id: "db-bench", name: "哑铃卧推", load: "37.5 kg × 6", meta: "3 组 · 休息 150s · RIR 2",
          cues: ["肩胛回收下沉，五点支撑稳定躯干", "下放到中胸，肘约 45 度不外张", "全程控制离心，触胸后短暂停顿"]),
    .init(id: "lat-pulldown", name: "高位下拉", load: "65 kg × 8", meta: "3 组 · 休息 120s · RIR 2",
          cues: ["先沉肩再拉肘，别用手臂抢先发力", "拉到锁骨下缘，胸口迎向把手"]),
    .init(id: "shoulder-press", name: "肩上推举", load: "32.5 kg × 6", meta: "3 组 · 休息 120s · RIR 2",
          cues: ["肋骨下沉不塌腰，核心先收紧", "推到头顶正上方，手腕保持中立"]),
    .init(id: "lateral-raise", name: "侧平举", load: "12.5 kg × 12", meta: "3 组 · 休息 60s · RIR 2",
          cues: ["肘微屈固定，抬到与肩同高即可", "落下时控制 2 秒，不借摆动"]),
]

struct MotionSampleView: View {
    @Environment(LocaleStore.self) private var localeStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @Namespace private var cardNS
    @State private var expandedId: String?
    @State private var sheetItem: SampleExercise?
    @State private var useMatched = true
    /// 排版精修开关：对比「现在的排版」与「数据为主角的排版」。
    @State private var refined = true

    /// 展开/收起统一用这一条曲线：偏阻尼、无回弹。极简的动效应当察觉不到，只觉得顺。
    private var morph: Animation { .spring(response: 0.42, dampingFraction: 0.86) }

    var body: some View {
        ZStack {
            Color.redeBase.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                list
            }

            if useMatched, let id = expandedId,
               let ex = sampleData.first(where: { $0.id == id }) {
                expandedOverlay(ex)
            }
        }
        .sheet(item: $sheetItem) { ex in
            NavigationStack {
                ScrollView { detailBody(ex).padding(RedeSpace.page) }
                    .background(Color.redeBase)
            }
            .presentationDetents([.medium, .large])
        }
        .task {
            // -motionAuto：无人值守录屏用。模拟器点击在本机不稳，改由代码驱动一轮
            // 「新手感 → 旧手感」对比演示，保证录到的就是要看的东西。
            guard ProcessInfo.processInfo.arguments.contains("-motionAuto") else { return }
            await runAutoDemo()
        }
    }

    private func sleep(_ seconds: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    private func runAutoDemo() async {
        await sleep(1.5)
        for isRefined in [true, false] {
            withAnimation(.easeInOut(duration: 0.28)) { refined = isRefined }
            await sleep(2.2)                       // 停住看静态排版
            withAnimation(morph) { expandedId = "db-bench" }
            await sleep(2.0)
            withAnimation(morph) { expandedId = nil }
            await sleep(1.3)
        }
        withAnimation(.easeInOut(duration: 0.28)) { refined = true }
    }

    // MARK: - 顶部（含手感切换开关，仅样例用）

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("今天")
                .font(.redeTitle).tracking(RedeTracking.title)
                .foregroundStyle(Color.redeT1)
                .frame(maxWidth: .infinity, alignment: .leading)

            Picker("", selection: $refined) {
                Text("精修排版").tag(true)
                Text("现在的排版").tag(false)
            }
            .pickerStyle(.segmented)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 8)
        .padding(.bottom, 18)
    }

    // MARK: - 列表

    private var list: some View {
        ScrollView {
            VStack(spacing: 10) {
                ForEach(sampleData) { ex in
                    Button {
                        if useMatched {
                            withAnimation(reduceMotion ? nil : morph) { expandedId = ex.id }
                        } else {
                            sheetItem = ex
                        }
                    } label: {
                        row(ex)
                    }
                    .buttonStyle(.plain)
                    // 展开态下把源行藏起来，几何权交给 overlay——否则两处同时存在会打架。
                    .opacity(expandedId == ex.id ? 0 : 1)
                }
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.bottom, 40)
        }
    }

    private func row(_ ex: SampleExercise) -> some View {
        let src = expandedId != ex.id
        return VStack(alignment: .leading, spacing: refined ? 7 : 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(ex.name)
                    // 精修：动作名退到 medium。名称是索引、重量才是答案——
                    // 两者同为 semibold 时视线无处落脚，这是「扁平」的主要来源。
                    .font(refined ? .system(size: 16, weight: .medium) : .redeSubhead)
                    .foregroundStyle(refined ? Color.redeT2 : Color.redeT1)
                    .matchedGeometryEffect(id: "name-\(ex.id)", in: cardNS, isSource: src)
                Spacer(minLength: 12)
                loadCluster(ex, hero: false)
                    .matchedGeometryEffect(id: "load-\(ex.id)", in: cardNS, isSource: src)
            }
            Text(ex.meta)
                .font(refined ? .system(size: 11.5) : .redeCaption)
                .tracking(refined ? 0.15 : 0)
                .foregroundStyle(refined ? Color.redeT4 : Color.redeT3)
                .matchedGeometryEffect(id: "meta-\(ex.id)", in: cardNS, isSource: src)
        }
        .padding(.horizontal, refined ? 15 : RedeSpace.card)
        .padding(.vertical, refined ? 14 : RedeSpace.card)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardSurface(ex).matchedGeometryEffect(id: "bg-\(ex.id)", in: cardNS, isSource: src))
    }

    /// 重量簇：数值/单位/次数三段分开排。整串同字号会退化成一个「标签」，
    /// 拆开后才有数据的重心——这是列表看起来专业与否的分水岭。
    private func loadCluster(_ ex: SampleExercise, hero: Bool) -> some View {
        let parts = ex.load.split(separator: " ")   // ["37.5", "kg", "×", "6"]
        return Group {
            if refined, parts.count == 4 {
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text(parts[0])
                        .font(.system(size: hero ? 30 : 19, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                    Text(" \(parts[1])")
                        .font(.system(size: hero ? 14 : 11.5, weight: .regular))
                        .foregroundStyle(Color.redeT4)
                    Text("  \(parts[2]) \(parts[3])")
                        .font(.system(size: hero ? 19 : 14, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT3)
                }
            } else {
                Text(ex.load)
                    .font(.redeSubhead).monospacedDigit()
                    .foregroundStyle(Color.redeT1)
            }
        }
    }

    /// 卡面：纯色填充在深色下会像「贴上去的纸」。极微弱的垂直渐变 + 一道 1px 顶缘高光，
    /// 才读得出「有厚度的物体」。数值全部压到几乎看不见的程度——看得见就俗了。
    @ViewBuilder
    private func cardSurface(_ ex: SampleExercise) -> some View {
        if refined {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(LinearGradient(
                    colors: [Color(redeHex: 0x232019), Color(redeHex: 0x1C1914)],
                    startPoint: .top, endPoint: .bottom))
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [Color.white.opacity(0.055), Color.white.opacity(0.012)],
                                startPoint: .top, endPoint: .bottom),
                            lineWidth: 1)
                )
        } else {
            RoundedRectangle(cornerRadius: RedeShape.cardRadius, style: .continuous)
                .fill(Color.redeSurface)
        }
    }

    // MARK: - 展开态（同层 overlay，不是 sheet）

    private func expandedOverlay(_ ex: SampleExercise) -> some View {
        ZStack(alignment: .top) {
            // 遮罩：背景后退，但不做成黑幕——保持「同一个空间里放大」而非「换了个页面」。
            Color.black.opacity(0.42)
                .ignoresSafeArea()
                .transition(.opacity)
                .onTapGesture { collapse() }

            VStack(alignment: .leading, spacing: RedeSpace.section) {
                HStack(alignment: .firstTextBaseline) {
                    Text(ex.name)
                        .font(refined ? .system(size: 19, weight: .medium)
                                      : .redeHeadline)
                        .tracking(refined ? 0 : RedeTracking.headline)
                        .foregroundStyle(refined ? Color.redeT2 : Color.redeT1)
                        .matchedGeometryEffect(id: "name-\(ex.id)", in: cardNS, isSource: true)
                    Spacer(minLength: 12)
                    Group {
                        if refined {
                            loadCluster(ex, hero: true)
                        } else {
                            Text(ex.load).font(.redeHeadline).monospacedDigit()
                                .foregroundStyle(Color.redeEmber)
                        }
                    }
                    .matchedGeometryEffect(id: "load-\(ex.id)", in: cardNS, isSource: true)
                }

                if !refined {
                    Text(ex.meta)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                        .matchedGeometryEffect(id: "meta-\(ex.id)", in: cardNS, isSource: true)
                } else {
                    // 精修态下 meta 已升格成三列读数，源行的几何仍要有落点，否则收起时会闪。
                    Color.clear.frame(height: 0)
                        .matchedGeometryEffect(id: "meta-\(ex.id)", in: cardNS, isSource: true)
                }

                detailBody(ex)
                    // 内容后于容器出现：容器先到位，信息再落下，避免文字跟着一起缩放变糊。
                    .transition(.opacity.combined(with: .offset(y: 10)))
            }
            .padding(refined ? 22 : RedeSpace.card + 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                Group {
                    if refined {
                        // 圆角放到 30：大圆角是 iOS 26 的语气，也让卡片读起来更"软"、更像一块实体。
                        RoundedRectangle(cornerRadius: 30, style: .continuous)
                            .fill(LinearGradient(
                                colors: [Color(redeHex: 0x262218), Color(redeHex: 0x1B1813)],
                                startPoint: .top, endPoint: .bottom))
                            .overlay(
                                RoundedRectangle(cornerRadius: 30, style: .continuous)
                                    .strokeBorder(LinearGradient(
                                        colors: [Color.white.opacity(0.075), Color.white.opacity(0.012)],
                                        startPoint: .top, endPoint: .bottom), lineWidth: 1))
                            .shadow(color: .black.opacity(0.55), radius: 30, y: 14)
                    } else {
                        RoundedRectangle(cornerRadius: RedeShape.cardRadius + 6, style: .continuous)
                            .fill(Color.redeSurface)
                    }
                }
                .matchedGeometryEffect(id: "bg-\(ex.id)", in: cardNS, isSource: true)
            )
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, 120)
            .gesture(
                DragGesture().onEnded { v in
                    if v.translation.height > 60 { collapse() }
                }
            )
        }
    }

    private func detailBody(_ ex: SampleExercise) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if refined {
                // 巧思一：把 "3 组 · 休息 150s · RIR 2" 这串文字拆成三列读数。
                // 同样的信息，从「一句话」变成「一组仪表」——工程感来自结构，不是装饰。
                statStrip(ex)
                hairline.padding(.vertical, 18)
            }

            // 巧思二：项目符号换成等宽序号。· 是列表，01/02/03 是**工序**——
            // 有先后、可指认（"第二点没做到"）。序号压到极暗，只在余光里起编排作用。
            VStack(alignment: .leading, spacing: refined ? 13 : 8) {
                ForEach(Array(ex.cues.enumerated()), id: \.offset) { i, cue in
                    if refined {
                        HStack(alignment: .top, spacing: 13) {
                            Text(String(format: "%02d", i + 1))
                                .font(.system(size: 11, weight: .medium, design: .monospaced))
                                .foregroundStyle(Color.redeT4.opacity(0.75))
                                .padding(.top, 3)
                            Text(cue)
                                .font(.system(size: 14.5))
                                .lineSpacing(4)
                                .foregroundStyle(Color.redeT2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    } else {
                        HStack(alignment: .top, spacing: 7) {
                            Text("·").font(.redeBody).foregroundStyle(Color.redeT3)
                            Text(cue).font(.redeBody).foregroundStyle(Color.redeT2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var hairline: some View {
        Rectangle().fill(Color.white.opacity(0.055)).frame(height: 1)
    }

    /// 三列读数。标签用 overline 的字距处理，数值等宽——两行对齐成一把尺子。
    private func statStrip(_ ex: SampleExercise) -> some View {
        // meta 形如 "3 组 · 休息 150s · RIR 2"
        let cols: [(String, String)] = {
            let parts = ex.meta.components(separatedBy: " · ")
            guard parts.count == 3 else { return [] }
            return [("组数", parts[0].replacingOccurrences(of: " 组", with: "")),
                    ("休息", parts[1].replacingOccurrences(of: "休息 ", with: "")),
                    ("RIR", parts[2].replacingOccurrences(of: "RIR ", with: ""))]
        }()
        return HStack(alignment: .top, spacing: 0) {
            ForEach(Array(cols.enumerated()), id: \.offset) { _, col in
                VStack(alignment: .leading, spacing: 6) {
                    Text(col.0)
                        .font(.system(size: 10, weight: .medium))
                        .tracking(1.6)
                        .foregroundStyle(Color.redeT4.opacity(0.9))
                    // 数值升到 25pt：三列是和重量并列的读数，17pt 太像脚注。
                    // 单位（150 的 s）单独缩到 13pt 压暗——与重量簇同一套拆分逻辑，全卡一致。
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text(col.1.numericHead)
                            .font(.system(size: 25, weight: .medium, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(Color.redeT1)
                        if !col.1.unitTail.isEmpty {
                            Text(col.1.unitTail)
                                .font(.system(size: 13, weight: .regular, design: .rounded))
                                .foregroundStyle(Color.redeT4)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func collapse() {
        withAnimation(reduceMotion ? nil : morph) { expandedId = nil }
    }
}

private extension String {
    /// "150s" → "150"；"3" → "3"（数值部分）
    var numericHead: String { String(prefix(while: { $0.isNumber || $0 == "." })) }
    /// "150s" → "s"；"3" → ""（单位后缀）
    var unitTail: String { String(drop(while: { $0.isNumber || $0 == "." })) }
}
