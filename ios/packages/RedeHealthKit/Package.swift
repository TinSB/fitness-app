// swift-tools-version: 5.9
// RedeHealthKit — FR-PR8 只读 HealthKit 体重导入（Master §128/§220：HealthKit 只准在本包内）。
//
// 已批准能力（范围 A，owner 2026-06-24 拍板）：**只读** Apple 健康体重（bodyMass）用于展示。
// **不写**（不写回 HKWorkout——那是范围 B，未采纳）。
// Master v3.8（2026-10-17）另加：开训时请求拉起手表开练（WatchWorkoutLaunching /
// HKWatchWorkoutLauncher，只调 startWatchApp，不读不写任何健康数据、不申请任何授权）。
// 那一场训练仍只由手表写进健康（Master §5 Apple Watch 第 10、13 条）。
//
// 复刻 RedeNotifications 边界范式（不引入新模式）：
//  - 纯层（默认编译、host `swift test` 全覆盖）：BodyWeightSample 值类型 + 协议 seam
//    BodyWeightReading（授权/读最新）。无 HealthKit 依赖、Foundation-only、可单测。
//  - 平台适配层（`#if os(iOS)`、host test 排除）：import HealthKit 的只有这一层的适配器文件，体重是 HKBodyWeightReader，
//    HKHealthStore 请求 bodyMass 只读授权 + 查最新样本。
//
// 红线（Master §211/220）：HealthKit 导入是 DERIVED 派生展示——绝不读/写 canonical AppData、
// 绝不是引擎真相、不影响训练决策、无 network/cloud。app 只见协议，HealthKit 类型不出本包。

import PackageDescription

let package = Package(
    name: "RedeHealthKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeHealthKit", targets: ["RedeHealthKit"]),
    ],
    targets: [
        .target(name: "RedeHealthKit"),
        .testTarget(name: "RedeHealthKitTests", dependencies: ["RedeHealthKit"]),
    ]
)
