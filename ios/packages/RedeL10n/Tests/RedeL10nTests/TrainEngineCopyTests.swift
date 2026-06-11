// M3-2 训练流文案：双语锚句 + 禁词守卫（含疼痛合规句式 §7.1）。

import Foundation
import XCTest
@testable import RedeL10n

final class TrainEngineCopyTests: XCTestCase {
    func testAdjustHintAndDoneAreNonEmptyBothLocales() {
        for t in [RedeStrings(locale: .zh), RedeStrings(locale: .en)] {
            XCTAssertFalse(t.adjustDiscoverHint.isEmpty)
            XCTAssertFalse(t.adjustDone.isEmpty)
        }
    }

    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testProgressAndLoadAnchors() {
        XCTAssertEqual(zh.trainProgress(exercise: 1, exerciseTotal: 6, set: 3, setTotal: 4), "动作 1/6 · 第 3/4 组")
        XCTAssertEqual(en.trainProgress(exercise: 1, exerciseTotal: 6, set: 3, setTotal: 4), "Exercise 1 of 6 · Set 3 of 4")
        XCTAssertEqual(en.trainLoadSuffix(targetReps: 6, targetRir: 2), "kg · × 6 · RIR 2")
        XCTAssertEqual(en.trainLoadSuffix(targetReps: 6, targetRir: 1.5), "kg · × 6 · RIR 1.5")
        XCTAssertEqual(zh.formatRir(0.5), "0.5")
    }

    func testNextSetWhyAnchors() {
        XCTAssertEqual(zh.nextSetWhy(reasonCode: "lastSetNearFailure", fromKg: "60"), "上组接近力竭，从 60 回调")
        XCTAssertEqual(en.nextSetWhy(reasonCode: "onPlan", fromKg: nil), "Carrying your last set forward")
        XCTAssertEqual(zh.firstSetWhy, "按计划目标开始")
        XCTAssertEqual(en.firstSetWhy, "Starting at plan target")
        XCTAssertEqual(zh.holdLabel(kg: "60", holding: false), "保持 60")
        XCTAssertEqual(en.holdLabel(kg: "60", holding: true), "Holding 60")
    }

    func testRestAnchors() {
        XCTAssertEqual(zh.restNextPreview(setNumber: 2, kg: "60", reps: 6), "下一组 · 第 2 组 · 60 kg × 6")
        XCTAssertEqual(en.restNextExercise("Lat pulldown"), "Up next · Lat pulldown")
    }

    func testResumeDialogAnchors() {
        // 三颗按钮全部显式本地化——系统注入的 Cancel 跟随设备语言不理 app 设置
        XCTAssertEqual(zh.resumeSessionContinue, "继续训练")
        XCTAssertEqual(zh.resumeSessionDiscard, "放弃")
        XCTAssertEqual(zh.resumeSessionLater, "稍后再说")
        XCTAssertEqual(en.resumeSessionLater, "Not now")
    }

    func testSkipReasonLabelsCoverAllCodes() {
        for code in ["equipmentBusy", "painDiscomfort", "fatigue", "timeShort", "other"] {
            XCTAssertFalse(zh.skipReasonLabel(code).isEmpty)
            XCTAssertFalse(en.skipReasonLabel(code).isEmpty)
        }
    }

    func testPainAdvisoryUsesApprovedShape() {
        // §7.1：不承诺安全/预防，用「暂停、调整、咨询专业人士」
        XCTAssertEqual(zh.painAdvisory, "出现疼痛时暂停、调整动作，或咨询专业人士。")
        XCTAssertTrue(en.painAdvisory.contains("professional"))
        for banned in ["预防", "安全", "治疗", "prevent", "injury-proof", "pain-free", "safe"] {
            XCTAssertFalse(zh.painAdvisory.contains(banned) || en.painAdvisory.contains(banned), banned)
        }
    }

    func testSummaryAnchors() {
        XCTAssertEqual(zh.summaryMeta(minutes: 47), "47 分钟 · 干得漂亮")
        XCTAssertEqual(en.summaryTopSet(name: "Bench press", kg: "62.5", reps: 6), "Top set · Bench press 62.5 kg × 6")
        XCTAssertEqual(zh.endWorkoutRemaining(exercisesLeft: 5), "还剩 5 个动作")
    }

    // M5-3 刻度轨：档位标签与预演文案锚句（审查 MINOR-2 补测）
    func testAdjustOptionLabelsCoverAllRoles() {
        XCTAssertEqual(zh.adjustOptionLabel("follow"), "跟随")
        XCTAssertEqual(en.adjustOptionLabel("follow"), "Follow")
        XCTAssertEqual(zh.adjustOptionLabel("last"), "上组")
        XCTAssertEqual(en.adjustOptionLabel("last"), "Last")
        XCTAssertEqual(zh.adjustOptionLabel("plan"), "计划")
        XCTAssertEqual(en.adjustOptionLabel("plan"), "Plan")
        XCTAssertEqual(zh.adjustOptionLabel("lighter"), "轻一档")
        XCTAssertEqual(en.adjustOptionLabel("lighter"), "Lighter")
        XCTAssertEqual(zh.adjustOptionLabel("heavier"), "重一档")
        XCTAssertEqual(en.adjustOptionLabel("heavier"), "Heavier")
        // 未知 code 原样回显（不猜）
        XCTAssertEqual(zh.adjustOptionLabel("unknown"), "unknown")
    }

    func testAdjustPreviewAnchors() {
        XCTAssertEqual(zh.adjustPreviewNext(kg: "52.5"), "打勾后 · 下一组 52.5 kg")
        XCTAssertEqual(en.adjustPreviewNext(kg: "52.5"), "After log · next 52.5 kg")
        XCTAssertNotNil(zh.adjustPreviewNote(reasonCode: "lastSetNearFailure"))
        XCTAssertNotNil(en.adjustPreviewNote(reasonCode: "belowRepFloor"))
        XCTAssertNotNil(zh.adjustPreviewNote(reasonCode: "painReported"))
        XCTAssertNil(zh.adjustPreviewNote(reasonCode: "onPlan"))   // 按计划延续不加注
        XCTAssertNil(en.adjustPreviewNote(reasonCode: "unknown"))
        XCTAssertEqual(zh.adjustPreviewComplete, "打勾后 · 本动作完成")
        XCTAssertEqual(en.adjustRirSkip, "—")
        // RIR 可空后缀
        XCTAssertEqual(zh.trainLoadSuffix(targetReps: 6, targetRir: nil as Double?), "kg · × 6 · RIR —")
    }

    func testForbiddenWordsAcrossTrainCopy() {
        let samples: [String] = [
            zh.nextSetWhy(reasonCode: "lastSetNearFailure", fromKg: "60"),
            en.nextSetWhy(reasonCode: "belowRepFloor", fromKg: "60"),
            zh.nextSetWhy(reasonCode: "painReported", fromKg: nil),
            en.holdWhyLine, zh.holdWhyLine,
            en.adjustDiscoverHint, zh.adjustDiscoverHint, en.adjustDone, zh.adjustDone,
            zh.painRegistered, en.painRegistered,
            zh.summaryTitle, en.summaryTitle,
            zh.trainRestDayNote, en.trainRestDayNote,
            zh.adjustOptionLabel("follow"), en.adjustOptionLabel("lighter"),
            zh.adjustPreviewNext(kg: "50"), en.adjustPreviewNext(kg: "50"),
            zh.adjustPreviewNote(reasonCode: "lastSetNearFailure") ?? "",
            en.adjustPreviewNote(reasonCode: "lastSetNearFailure") ?? "",
            zh.adjustPreviewComplete, en.adjustPreviewComplete,
            zh.adjustExact, en.adjustExact,
        ]
        for text in samples {
            for banned in ["AI", "算法", "系统认为", "最佳", "algorithm", "model", "best"] {
                XCTAssertFalse(text.contains(banned), "禁词「\(banned)」出现在: \(text)")
            }
        }
    }
}
