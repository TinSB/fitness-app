// B3（2026-07-07）：MLE Development 块文案 parity + 红线锁。
// 语义锁：10 肌群/6 tier/8 evidence 全量双语非空且 zh≠en（parity 惯例）；
// 禁用词红线（§6.5.11 + Copy Baseline §3.4）：全部文案不得出现「置信度/confidence/
// 弱/weak/差/poor」——置信度走行为表达、禁羞辱式措辞。

import XCTest
@testable import RedeL10n

final class MuscleLevelCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testMuscleGroupNamesFullParity() {
        for group in MuscleGroupLabel.allCases {
            XCTAssertFalse(zh.muscleGroupName(group).isEmpty, group.rawValue)
            XCTAssertFalse(en.muscleGroupName(group).isEmpty, group.rawValue)
            XCTAssertNotEqual(zh.muscleGroupName(group), en.muscleGroupName(group), group.rawValue)
        }
        XCTAssertEqual(MuscleGroupLabel.allCases.count, 10)
    }

    func testTierAndDecisionAndEvidenceParity() {
        XCTAssertEqual(TrainingTierLabel.allCases.count, 6)
        for tier in TrainingTierLabel.allCases {
            XCTAssertNotEqual(zh.trainingTierName(tier), en.trainingTierName(tier), tier.rawValue)
        }
        for decision in MuscleDecisionLabel.allCases {
            XCTAssertNotEqual(zh.muscleDecisionLabel(decision), en.muscleDecisionLabel(decision))
        }
        XCTAssertEqual(MuscleEvidenceLabel.allCases.count, 11)
        for evidence in MuscleEvidenceLabel.allCases {
            XCTAssertNotEqual(zh.muscleEvidenceLine(evidence), en.muscleEvidenceLine(evidence),
                              evidence.rawValue)
        }
        XCTAssertNotEqual(zh.muscleDecisionEaseBackIn, en.muscleDecisionEaseBackIn)
        XCTAssertNotEqual(zh.developmentExpandHint, en.developmentExpandHint)
    }

    func testRemainingCalibratingSingularPlural() {
        // 审查 M8：en 单复数（1 more muscle / 4 more muscles）
        XCTAssertEqual(en.developmentRemainingCalibrating(1), "1 more muscle calibrating")
        XCTAssertTrue(en.developmentRemainingCalibrating(4).contains("muscles"))
        XCTAssertTrue(zh.developmentRemainingCalibrating(1).contains("1 个肌群"))
    }

    func testNoTrailingPeriodsAndNoDashes() {
        // 审查 M3：Copy Baseline §3.4/§3.5——zh 全文无「。」无「——」；zh/en 尾字符不收句点
        let texts: [String] = [zh.developmentCalibratingBody, en.developmentCalibratingBody,
                               zh.developmentTitle, en.developmentTitle,
                               zh.muscleDecisionEaseBackIn, en.muscleDecisionEaseBackIn,
                               zh.developmentExpandHint, en.developmentExpandHint]
            + MuscleEvidenceLabel.allCases.flatMap { [zh.muscleEvidenceLine($0), en.muscleEvidenceLine($0)] }
            + MuscleDecisionLabel.allCases.flatMap { [zh.muscleDecisionLabel($0), en.muscleDecisionLabel($0)] }
        for text in texts {
            XCTAssertFalse(text.contains("。"), "中文句号: \(text)")
            XCTAssertFalse(text.contains("——"), "破折号: \(text)")
            XCTAssertFalse(text.hasSuffix("."), "尾句点: \(text)")
        }
    }

    func testForbiddenWordsNeverAppear() {
        // 红线扫描：置信度零 UI 读数 + 禁羞辱措辞（§3.4 / §6.5.11 禁止清单）
        var all: [String] = [zh.developmentTitle, en.developmentTitle,
                             zh.developmentCalibratingBody, en.developmentCalibratingBody,
                             zh.developmentTierLabel, en.developmentTierLabel,
                             zh.developmentBalanceLine(76), en.developmentBalanceLine(76),
                             zh.developmentRemainingCalibrating(4), en.developmentRemainingCalibrating(4)]
        for group in MuscleGroupLabel.allCases {
            all.append(zh.muscleGroupName(group)); all.append(en.muscleGroupName(group))
        }
        for tier in TrainingTierLabel.allCases {
            all.append(zh.trainingTierName(tier)); all.append(en.trainingTierName(tier))
        }
        for decision in MuscleDecisionLabel.allCases {
            all.append(zh.muscleDecisionLabel(decision)); all.append(en.muscleDecisionLabel(decision))
        }
        for evidence in MuscleEvidenceLabel.allCases {
            all.append(zh.muscleEvidenceLine(evidence)); all.append(en.muscleEvidenceLine(evidence))
        }
        let forbidden = ["置信度", "confidence", "弱", "weak", "差", "poor"]
        for text in all {
            for word in forbidden {
                XCTAssertFalse(text.lowercased().contains(word.lowercased()),
                               "禁用词「\(word)」出现在: \(text)")
            }
        }
    }

    func testMirrorEnumsCoverEngineRawValues() {
        // 镜像枚举 rawValue 锚（引擎侧同值枚举的双侧防漂移——引擎侧锚在
        // RedeLocalSnapshot.MuscleGroupID；此处锁镜像侧拼写）
        XCTAssertEqual(Set(MuscleGroupLabel.allCases.map(\.rawValue)),
                       ["chest", "back", "quads", "hamstrings", "glutes",
                        "shoulders", "biceps", "triceps", "calves", "core"])
        XCTAssertEqual(Set(TrainingTierLabel.allCases.map(\.rawValue)),
                       ["calibrating", "beginner", "novicePlus", "intermediate", "advanced", "elite"])
        // 引擎产出 code 全集十一个（漏配=依据行静默丢失，审查 M4 实锤过 exposureRecentSets）
        XCTAssertEqual(Set(MuscleEvidenceLabel.allCases.map(\.rawValue)),
                       ["exposureRecentSets", "e1rmRising", "e1rmHolding", "e1rmDeclining",
                        "noBaselineWindow", "noRecentWindow", "shortHistory",
                        "noStrengthSignal", "milestoneFloorApplied", "confidenceLevelCapApplied",
                        "relativeStrengthApplied"])
    }

    func testSubGroupCopyParityAndRedLines() {
        // 钻取层新增文案四道红线（审查 M2）：parity/无句号破折号/禁用词/镜像锁
        XCTAssertEqual(MuscleSubGroupLabel.allCases.count, 6)
        XCTAssertEqual(Set(MuscleSubGroupLabel.allCases.map(\.rawValue)),
                       ["lats", "upper-back", "traps", "front-delt", "side-delt", "rear-delt"])
        var texts: [String] = [zh.muscleDetailSubTitle, en.muscleDetailSubTitle,
                               zh.muscleDetailEvidenceTitle, en.muscleDetailEvidenceTitle,
                               zh.muscleSubWeeklySets(4.5), en.muscleSubWeeklySets(4.5),
                               zh.muscleSubWeeklySets(0), en.muscleSubWeeklySets(0)]
        for sub in MuscleSubGroupLabel.allCases {
            XCTAssertNotEqual(zh.muscleSubGroupName(sub), en.muscleSubGroupName(sub), sub.rawValue)
            texts.append(zh.muscleSubGroupName(sub)); texts.append(en.muscleSubGroupName(sub))
        }
        let forbidden = ["置信度", "confidence", "弱", "weak", "差", "poor"]
        for text in texts {
            XCTAssertFalse(text.contains("。") || text.contains("——") || text.hasSuffix("."),
                           "句号/破折号: \(text)")
            for word in forbidden {
                XCTAssertFalse(text.lowercased().contains(word.lowercased()),
                               "禁用词「\(word)」: \(text)")
            }
        }
    }

    func testSettingsSexCopyParityAndRedLines() {
        // 审查 M3：settingsSex* 手写函数不在 CaseIterable 自动扫描内，单独锁四道红线
        var texts: [String] = [zh.settingsSexLabel, en.settingsSexLabel,
                               zh.settingsSexQuestion, en.settingsSexQuestion,
                               zh.settingsSexNote, en.settingsSexNote]
        XCTAssertNotEqual(zh.settingsSexLabel, en.settingsSexLabel)
        XCTAssertNotEqual(zh.settingsSexNote, en.settingsSexNote)
        for code in ["male", "female", "not-set"] {
            let zhPair = zh.settingsSexOption(code)
            let enPair = en.settingsSexOption(code)
            XCTAssertNotEqual(zhPair.title, enPair.title, code)
            texts += [zhPair.title, zhPair.caption, enPair.title, enPair.caption]
        }
        let forbidden = ["置信度", "confidence", "弱", "weak", "差", "poor"]
        for text in texts {
            XCTAssertFalse(text.contains("。") || text.contains("——") || text.hasSuffix("."),
                           "句号/破折号: \(text)")
            for word in forbidden {
                XCTAssertFalse(text.lowercased().contains(word.lowercased()),
                               "禁用词「\(word)」: \(text)")
            }
        }
    }
}
