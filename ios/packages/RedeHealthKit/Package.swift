// swift-tools-version: 5.9
// RedeHealthKit — FR-PR8 只读 HealthKit 体重导入（Master §128/§220：HealthKit 只准在本包内）。
//
// 已批准能力（范围 A，owner 2026-06-24 拍板）：**只读** Apple 健康体重（bodyMass）用于展示。
// **不写**（不写回 HKWorkout——那是范围 B，未采纳）。
//
// 复刻 RedeNotifications 边界范式（不引入新模式）：
//  - 纯层（默认编译、host `swift test` 全覆盖）：BodyWeightSample 值类型 + 协议 seam
//    BodyWeightReading（授权/读最新）。无 HealthKit 依赖、Foundation-only、可单测。
//  - 平台适配层（`#if os(iOS)`、host test 排除）：唯一 import HealthKit 的 HKBodyWeightReader，
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
