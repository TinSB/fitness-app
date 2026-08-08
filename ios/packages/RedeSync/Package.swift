// swift-tools-version: 5.9
//
// RedeSync — 云同步的**后端无关核心**。
//
// 边界（有意为之）：本包不含任何网络代码、不依赖任何后端 SDK、不认识 Supabase/
// Firebase/CloudKit。它只做两件纯函数的事：把远端记录并进本地 canonical，以及
// 算出本地有哪些记录还没上传。传输层是另一个包的职责，通过 SyncTransport 协议接入。
//
// 这样切分的理由：同步真正会出数据事故的地方是**合并语义**，不是网络调用。
// 合并核心是纯函数就能在 swift test 里穷举验证，不需要账号、网络或真机。
// 换后端时这个包一行不用改。
//
// 注：本包自身不需要网络，也就不需要网络相关依赖。传输层在 RedeSyncSupabase。

import PackageDescription

let package = Package(
    name: "RedeSync",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "RedeSync", targets: ["RedeSync"])
    ],
    dependencies: [
        .package(path: "../RedeDomain")
    ],
    targets: [
        .target(name: "RedeSync", dependencies: ["RedeDomain"]),
        .testTarget(name: "RedeSyncTests", dependencies: ["RedeSync", "RedeDomain"])
    ]
)
