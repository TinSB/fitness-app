// M3-2 训练流文案：双语锚句 + 禁词守卫（含疼痛合规句式 §7.1）。

import Foundation
import XCTest
@testable import RedeL10n

final class TrainEngineCopyTests: XCTestCase {
    func testAdjustDoneIsNonEmptyBothLocales() {
        for t in [RedeStrings(locale: .zh), RedeStrings(locale: .en)] {
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
        // 没有真理由就不说话（owner 2026-08-16）：照计划 / 照上组延续 / 首组 → 空串，视图不画这一行。
        XCTAssertEqual(en.nextSetWhy(reasonCode: "onPlan", fromKg: nil), "")
        XCTAssertEqual(zh.nextSetWhyBodyweight(reasonCode: "onPlan"), "")
        XCTAssertEqual(zh.nextSetWhyAssisted(reasonCode: "onPlan"), "")
        XCTAssertEqual(en.nextSetWhyBodyweightPlus(reasonCode: "onPlan", fromKg: nil), "")
        XCTAssertEqual(zh.firstSetWhy, "")
        XCTAssertEqual(en.firstSetWhy, "")
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

    func testSessionEditAnchorsBothLocales() {
        XCTAssertEqual(zh.sessionOrderEntry, "本次训练")
        XCTAssertEqual(en.sessionOrderEntry, "This workout")
        XCTAssertEqual(zh.sessionOrderTitle, "本次训练")
        XCTAssertEqual(en.sessionOrderTitle, "This workout")
        XCTAssertEqual(zh.sessionOrderCurrent, "当前动作")
        XCTAssertEqual(en.sessionOrderCurrent, "Current exercise")
        XCTAssertEqual(zh.sessionOrderLater, "接下来")
        XCTAssertEqual(en.sessionOrderLater, "Up next")
        XCTAssertEqual(zh.sessionOrderTrainNow, "现在练")
        XCTAssertEqual(en.sessionOrderTrainNow, "Train now")
        XCTAssertEqual(zh.sessionOrderOpenHint, "调整本次训练的动作与组数")
        XCTAssertEqual(en.sessionOrderOpenHint, "Edit exercises and sets for this workout")
        XCTAssertEqual(zh.sessionOrderMoveA11y(name: "上斜哑铃卧推"), "现在练，上斜哑铃卧推")
        XCTAssertEqual(en.sessionOrderMoveA11y(name: "Incline dumbbell press"), "Train Incline dumbbell press now")
        XCTAssertEqual(zh.sessionOrderMoveHint, "当前动作会顺延到稍后")
        XCTAssertEqual(en.sessionOrderMoveHint, "The current exercise moves later")
        XCTAssertEqual(zh.sessionOrderMovedAnnouncement(name: "上斜哑铃卧推"), "已切换到上斜哑铃卧推")
        XCTAssertEqual(en.sessionOrderMovedAnnouncement(name: "Incline dumbbell press"), "Now training Incline dumbbell press")
        XCTAssertEqual(zh.sessionOrderUpdateError, "暂时无法调整　请再试一次")
        XCTAssertEqual(en.sessionOrderUpdateError, "Couldn’t update this workout · Try again")

        XCTAssertEqual(zh.sessionEditRemove, "移除")
        XCTAssertEqual(en.sessionEditRemove, "Remove")
        XCTAssertEqual(zh.sessionEditAddExercise, "加一个动作")
        XCTAssertEqual(en.sessionEditAddExercise, "Add an exercise")
        XCTAssertEqual(zh.sessionEditAddA11y(name: "哑铃弯举"), "加入，哑铃弯举")
        XCTAssertEqual(en.sessionEditAddA11y(name: "Dumbbell curl"), "Add Dumbbell curl")
        XCTAssertEqual(zh.sessionEditRemoveA11y(name: "绳索夹胸"), "移除，绳索夹胸")
        XCTAssertEqual(en.sessionEditRemoveA11y(name: "Cable fly"), "Remove Cable fly")
        XCTAssertEqual(zh.sessionEditSetCount(4), "还剩 4 组")
        XCTAssertEqual(en.sessionEditSetCount(4), "4 sets left")
        XCTAssertEqual(zh.sessionEditDecreaseSetA11y, "减少一组")
        XCTAssertEqual(en.sessionEditDecreaseSetA11y, "Remove one set")
        XCTAssertEqual(zh.sessionEditIncreaseSetA11y, "增加一组")
        XCTAssertEqual(en.sessionEditIncreaseSetA11y, "Add one set")
        XCTAssertEqual(zh.sessionEditUndo, "撤销")
        XCTAssertEqual(en.sessionEditUndo, "Undo")
        XCTAssertEqual(zh.sessionEditRemoved(name: "绳索夹胸"), "已移除绳索夹胸")
        XCTAssertEqual(en.sessionEditRemoved(name: "Cable fly"), "Cable fly removed")
        XCTAssertEqual(zh.sessionEditAddedAnnouncement(name: "哑铃弯举"), "已加入哑铃弯举")
        XCTAssertEqual(en.sessionEditAddedAnnouncement(name: "Dumbbell curl"), "Added Dumbbell curl")
        XCTAssertEqual(zh.sessionEditRestoredAnnouncement(name: "绳索夹胸"), "已恢复绳索夹胸")
        XCTAssertEqual(en.sessionEditRestoredAnnouncement(name: "Cable fly"), "Restored Cable fly")
        XCTAssertEqual(zh.sessionEditSetCountAnnouncement(4), "当前动作还剩 4 组")
        XCTAssertEqual(en.sessionEditSetCountAnnouncement(4), "4 sets left for current exercise")
        XCTAssertEqual(zh.sessionEditPickerBack, "返回本次训练")
        XCTAssertEqual(en.sessionEditPickerBack, "Back to this workout")
        XCTAssertEqual(zh.sessionEditPickerEmptyTitle, "没有可加入的动作")
        XCTAssertEqual(en.sessionEditPickerEmptyTitle, "No exercises to add")
        XCTAssertEqual(zh.sessionEditPickerEmptyNote, "当前器械下的动作都已在本次训练中")
        XCTAssertEqual(en.sessionEditPickerEmptyNote, "Every available exercise is already in this workout")
    }

    func testPainAdvisoryUsesApprovedShape() {
        // §7.1：不承诺安全/预防，用「暂停、调整、咨询专业人士」
        XCTAssertEqual(zh.painAdvisory, "出现疼痛时暂停、调整动作，或咨询专业人士")
        XCTAssertTrue(en.painAdvisory.contains("professional"))
        for banned in ["预防", "安全", "治疗", "prevent", "injury-proof", "pain-free", "safe"] {
            XCTAssertFalse(zh.painAdvisory.contains(banned) || en.painAdvisory.contains(banned), banned)
        }
    }

    func testSummaryAnchors() {
        XCTAssertEqual(zh.summaryMeta(minutes: 47), "47 分钟 · 收工")
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
            en.adjustDone, zh.adjustDone,
            zh.painRegistered, en.painRegistered,
            zh.summaryTitle, en.summaryTitle,
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
