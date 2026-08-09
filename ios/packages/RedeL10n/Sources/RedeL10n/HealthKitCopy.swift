// FR-PR8 范围 A：Apple 健康体重导入展示文案（双语，§7.3 中性）。
// 诚实：只读体重、本机展示、不影响训练；读不到时如实说"无记录或未授权"。
import Foundation

extension RedeStrings {
    public var healthSectionTitle: String { locale == .zh ? "Apple 健康" : "Apple Health" }
    public var healthConnecting: String { locale == .zh ? "连接中…" : "Connecting…" }
    /// 2026-08-09 IA 重排：健康并进「数据」组后变成一行，右值只放短态。
    /// 行标题已经是「Apple 健康」，所以这里不再重复品牌名（避免「Apple 健康　连接 Apple 健康」）。
    public var healthStateConnect: String { locale == .zh ? "连接" : "Connect" }
    /// 已连接但读不到体重的短态；完整原因（无记录 or 未授权）仍由 healthNoData 在行下说清。
    public var healthStateNoRecord: String { locale == .zh ? "无记录" : "No records" }
    public var healthStateUnavailable: String { locale == .zh ? "不可用" : "Unavailable" }
    /// 已连接但读不到体重（无记录 或 未授予读取）。
    public var healthNoData: String {
        locale == .zh ? "Apple 健康暂无体重记录　或未授予读取权限"
                      : "No weight in Apple Health yet, or read access wasn't granted"
    }
    /// 本设备不支持 HealthKit。
    public var healthUnavailable: String {
        locale == .zh ? "本设备不支持 Apple 健康" : "Apple Health isn't available on this device"
    }
    /// 体重行：`72.5 kg · 2026-06-24`（weight 已按单位格式化；date 为日粒度）。
    public func healthWeightLine(weight: String, dateISO: String) -> String {
        "\(weight) · \(dateISO)"
    }
}
