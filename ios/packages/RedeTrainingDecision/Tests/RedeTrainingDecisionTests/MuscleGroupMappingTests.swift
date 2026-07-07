// MLE D1（2026-07-07）：目录 17 值细粒度肌群 → 契约 10 值 MuscleGroupID 归并映射。
// 语义锁：30 个目录取值（17 primary + 13 secondary 的并集）全部有确定归属；
// forearm 如实排除（腕弯举类对 10 值等级体系零贡献，不硬塞）；未知值 nil 防御不崩。
// 归属拍板（EVIDENCE_LEDGER MLE-INT-3 + owner 2026-07-07）：四 delt→shoulders、
// traps/upper-back→back、lower-back→core、adductors→glutes（审查修正，与目录
// hip-abduction→glutes 镜像先例一致）、forearm→excluded。

import XCTest
@testable import RedeTrainingDecision

final class MuscleGroupMappingTests: XCTestCase {
    func testContractEnumHasExactlyTenGroups() {
        XCTAssertEqual(MuscleGroupID.allCases.count, 10)
        XCTAssertEqual(
            Set(MuscleGroupID.allCases.map(\.rawValue)),
            ["chest", "back", "quads", "hamstrings", "glutes",
             "shoulders", "biceps", "triceps", "calves", "core"]
        )
    }

    func testIdentityMappings() {
        for direct in ["chest", "back", "quads", "hamstrings", "glutes", "biceps", "triceps", "calves", "core"] {
            XCTAssertEqual(MuscleGroupMapping.group(forCatalogMuscle: direct)?.rawValue, direct, direct)
        }
    }

    func testDeltVariantsMergeIntoShoulders() {
        for delt in ["shoulder", "side-delt", "rear-delt", "front-delt"] {
            XCTAssertEqual(MuscleGroupMapping.group(forCatalogMuscle: delt), .shoulders, delt)
        }
    }

    func testBackFamilyMerges() {
        XCTAssertEqual(MuscleGroupMapping.group(forCatalogMuscle: "traps"), .back)
        XCTAssertEqual(MuscleGroupMapping.group(forCatalogMuscle: "upper-back"), .back)
    }

    func testTrunkAndHipAssignments() {
        XCTAssertEqual(MuscleGroupMapping.group(forCatalogMuscle: "lower-back"), .core)
        XCTAssertEqual(MuscleGroupMapping.group(forCatalogMuscle: "adductors"), .glutes)
    }

    func testForearmIsHonestlyExcluded() {
        XCTAssertNil(MuscleGroupMapping.group(forCatalogMuscle: "forearm"))
    }

    func testUnknownValueIsDefensiveNil() {
        XCTAssertNil(MuscleGroupMapping.group(forCatalogMuscle: "neck"))
        XCTAssertNil(MuscleGroupMapping.group(forCatalogMuscle: ""))
    }

    /// 覆盖率契约：目录实际出现的全部肌群取值（wave-18：17 primary ∪ 13 secondary = 18 个
    /// 去重值）中，除 forearm 外全部可归并——目录加新肌群值而映射漏配时此测试报警。
    func testEveryCatalogMuscleValueIsMappedOrExplicitlyExcluded() {
        let catalog = ExerciseCatalog.minimal
        var seen = Set<String>()
        for entry in catalog.entries {
            seen.insert(entry.primaryMuscle)
            seen.formUnion(entry.secondaryMuscles)
        }
        let excluded: Set<String> = ["forearm"]
        for muscle in seen.subtracting(excluded) {
            XCTAssertNotNil(MuscleGroupMapping.group(forCatalogMuscle: muscle), "目录肌群值未映射: \(muscle)")
        }
        for muscle in excluded where seen.contains(muscle) {
            XCTAssertNil(MuscleGroupMapping.group(forCatalogMuscle: muscle), "排除项被意外映射: \(muscle)")
        }
    }
}
