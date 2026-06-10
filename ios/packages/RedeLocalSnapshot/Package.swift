// swift-tools-version: 5.9
// RedeLocalSnapshot — 进展派生快照（M4-1）。
// Master 合同：Foundation-only、与 RedeDomain/canonical AppData 强制解耦
// （Master §5 L115/L133、§6 L152）；输入是包内自有值类型，由 app 组合层映射。
import PackageDescription

let package = Package(
    name: "RedeLocalSnapshot",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeLocalSnapshot", targets: ["RedeLocalSnapshot"])
    ],
    targets: [
        .target(name: "RedeLocalSnapshot"),
        .testTarget(
            name: "RedeLocalSnapshotTests",
            dependencies: ["RedeLocalSnapshot"]
        ),
    ]
)
