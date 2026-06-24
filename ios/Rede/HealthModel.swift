import Foundation
import RedeHealthKit

// FR-PR8 范围 A：只读 Apple 健康体重的展示模型（app 组合层）。
// 红线：纯展示——绝不写 canonical、不进训练历史、不影响处方（Master §211/220）。
// HealthKit 只经 RedeHealthKit 的 BodyWeightReading 协议触达，本层不直接碰 HealthKit。
@MainActor
@Observable
final class HealthModel {
    enum State: Equatable {
        case notConnected           // 未连接（或之前未授权）→ 显示「连接 Apple 健康」
        case connecting             // 授权/读取中
        case unavailable            // 本设备不支持 HealthKit（如部分 iPad）
        case noData                 // 已发起授权但读不到体重（无记录 或 未授予读取——HealthKit 隐私下不可区分）
        case weight(BodyWeightSample)
    }

    private(set) var state: State = .notConnected
    private let reader: BodyWeightReading

    init(reader: BodyWeightReading = HKBodyWeightReader()) {
        self.reader = reader
    }

    /// 进设置页静默尝试读（不弹授权框）：之前授权过 → 直接显示体重；否则停在未连接、由用户主动连接。
    func loadSilently() async {
        // 仅在未连接态做静默读：用户已点「连接」（.connecting）后，静默读的迟到结果不得覆盖 connect()
        //（防并发状态竞争，审查 M-1）。
        guard state == .notConnected else { return }
        let sample = await reader.latestBodyWeight()
        // await 期间用户可能已点连接 → 再次确认仍在未连接态才写，避免覆盖 connect 的 .connecting/.weight。
        guard state == .notConnected else { return }
        if let sample { state = .weight(sample) }
        // 读不到不改 state（保持 .notConnected）——不在静默路径误判 noData/弹框。
    }

    /// 用户点「连接 Apple 健康」：值先行请求只读授权 → 读最新体重。
    func connect() async {
        state = .connecting
        let ok = await reader.requestReadAuthorization()
        guard ok else { state = .unavailable; return } // 仅设备不支持时为 false
        if let sample = await reader.latestBodyWeight() {
            state = .weight(sample)
        } else {
            state = .noData // 无体重记录 或 用户未授予读取（HealthKit 不告知，诚实合并提示）
        }
    }
}
