// swift-tools-version: 5.9
//
// RedeSyncSupabase — SyncTransport 的 Supabase 实现。**本仓唯一碰网络的包。**
//
// 为什么是手写 HTTP 而不是官方 supabase-swift SDK：我们实际只用到 Supabase 的一小块
// ——GoTrue 的两个 token 端点 + PostgREST 的表读写。自己说这几句换来两件具体的好处：
// 网络层可被完全 stub（15 个传输层测试不碰真网络、真账号、真机），以及构建不受上游
// 版本解析与可用性影响。若将来要用 Realtime、Storage 或多 provider 登录，SDK 的性价比
// 会反过来，届时换掉本包即可——RedeSync 与上层都不认识 Supabase。
//
// 边界：本包负责认证、重试、HTTP 细节和 JSON 编解码；**不负责合并判断**——那归
// RedeSync 的纯函数引擎。本包也不认识 canonical 文件，不碰磁盘上的训练数据。

import PackageDescription

let package = Package(
    name: "RedeSyncSupabase",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "RedeSyncSupabase", targets: ["RedeSyncSupabase"])
    ],
    dependencies: [
        .package(path: "../RedeDomain"),
        .package(path: "../RedeSync"),
    ],
    targets: [
        .target(name: "RedeSyncSupabase", dependencies: ["RedeDomain", "RedeSync"]),
        .testTarget(
            name: "RedeSyncSupabaseTests",
            dependencies: ["RedeSyncSupabase", "RedeSync", "RedeDomain"]
        ),
    ]
)
