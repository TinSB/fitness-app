// FR-PR8 范围 A：Apple 健康体重导入展示文案（双语，§7.3 中性）。
// 诚实：只读体重、本机展示、不影响训练；读不到时如实说"无记录或未授权"。
import Foundation

extension RedeStrings {
    public var healthSectionTitle: String { locale == .zh ? "Apple 健康" : "Apple Health" }
    /// 连接按钮（值先行：用户主动点才请求授权）。
    public var healthConnectAction: String { locale == .zh ? "连接 Apple 健康" : "Connect Apple Health" }
    public var healthConnecting: String { locale == .zh ? "连接中…" : "Connecting…" }
    /// 体重来源标注（展示在导入的体重旁，明示来源）。
    public var healthSourceLabel: String { locale == .zh ? "来源：Apple 健康" : "Source: Apple Health" }
    /// 已连接但读不到体重（无记录 或 未授予读取）。
    public var healthNoData: String {
        locale == .zh ? "Apple 健康暂无体重记录，或未授予读取权限。"
                      : "No weight in Apple Health yet, or read access wasn't granted."
    }
    /// 本设备不支持 HealthKit。
    public var healthUnavailable: String {
        locale == .zh ? "本设备不支持 Apple 健康。" : "Apple Health isn't available on this device."
    }
    /// 体重行：`72.5 kg · 2026-06-24`（weight 已按单位格式化；date 为日粒度）。
    public func healthWeightLine(weight: String, dateISO: String) -> String {
        "\(weight) · \(dateISO)"
    }
}
