# 批次 D 交接件：相对力量标准（Relative Strength Standards）

> 日期：2026-07-09 ｜ 状态：执行中 ｜ owner 拍板：「123 你看着安排一下，制作」
> 前情：owner 确认等级校准需按用户本身能力区分（「卧推 100kg 和 20kg 的新人等级肯定不一样」），
> 主 agent 报告三个 v1 边界后 owner 拍板三个全做。本件是执行 prompt 真源。

---

## 1. 决策问题与目标

**问题**：MLE 里程碑 v1 只有绝对重量锚（bench 60-140kg 等九条），导致三个公平性/覆盖缺口：

1. **60kg 以下无档**——卧推 40kg 与 20kg 的新手同级（都无里程碑）。
2. **back/biceps 无低门槛路径**——现有 weighted-pullup-20kg（floor 11）/ deadlift-180（floor 14）门槛过高。
3. **锚不按体重/性别调**——女性 60kg 体重推 60kg（含金量 ≈ 男性推 100kg）拿不到对应档位。

**方案**：新增**相对体重的力量标准**（业界 strength standards 惯例：e1RM/实测 ÷ 体重 = 相对比，
按性别 × 动作查五档表）。绝对锚**保留**（kg/lb 心理里程碑 + 已有分享素材），两套 floor 取 **max** 合并。
相对表天然解决 ①（低档倍数远低于 60kg）③（女表独立），barbell-row 进表解决 ②。

## 2. 现状地图（2026-07-09 探查实证，file:line 见探查记录）

- **`UserProfile.sex` / `.weightKg` 字段已在类型层预留但休眠**（`RedeDomain/UserProfile.swift:12,15`，
  open-bag，从未被写入）——schema 零改动，只需激活写入侧。
- 体重两条源均未接引擎：profile.weightKg（休眠）；HealthKit bodyMass（`HealthModel.swift`，
  纯展示不落库，红线注释「绝不写 canonical」）。
- 里程碑管线：`ProgressModel.swift:115-123` 算 bestActualKgByExercise（全历史最好实测顶组 kg）/
  bestE1RmKgByExercise → `MuscleProfileComposer.compose:104-107` 调 `MuscleMilestoneCatalog.achievements`
  → `MuscleProfileAssembler.assemble:136` 取 `levelFloors` → `flooredLevel:224-226` 单点应用（max）。
- 设置页档案编辑惯例：backgroundPlate 铭牌（`SettingsSheet.swift:346-370` plateRow + `PlateQuestion`
  枚举 `:502-505` + `PlateQuestionEditView.questionBody:614-640`）；profile scalar 写入走
  `CanonicalSessionWriter.applyPreferences:186-201` 模式（**不用 UserDefaults**）。
- evidence code 是裸 String：新增 code 动 4 处（引擎 emit、`MuscleLevelCopy.swift` 枚举+文案、
  `MuscleLevelCopyTests.swift:99-101` 全量锚、producer 单测）。
- 划船动作 id 实存：`barbell-row`（primary=upper-back，secondary=[biceps,rear-delt]）。
  注意 linkedMuscles 用 10 块枚举（.back），不用 json 细粒度值。
- 两套里程碑并存：FR-PR7 简化版（有 UI 列表）与 MLE 版（floor/依据行）——本批只动 **MLE 版**
  （`MuscleMilestoneCatalog` 同包新文件），FR-PR7 列表零接触。

## 3. 设计规格

### 3.1 标准表（E1 专家判断锚——业界通识（strengthlevel/ExRx 风格，男 intermediate 卧推 1.0×体重
为最广为人知的锚）；config 化常数，owner 可后调）

相对比 = 成绩(kg) ÷ 当前体重(kg)。五档：beginner / novice / intermediate / advanced / elite。

| 动作（exerciseId） | 男 | 女 |
|---|---|---|
| bench-press | 0.50 / 0.75 / 1.00 / 1.50 / 2.00 | 0.25 / 0.40 / 0.60 / 0.90 / 1.20 |
| squat（沿绝对锚同 id） | 0.75 / 1.00 / 1.50 / 2.00 / 2.50 | 0.50 / 0.75 / 1.10 / 1.50 / 2.00 |
| deadlift（沿绝对锚同 id） | 1.00 / 1.25 / 1.75 / 2.25 / 2.75 | 0.60 / 0.90 / 1.25 / 1.75 / 2.25 |
| overhead-press（沿绝对锚同 id） | 0.35 / 0.50 / 0.70 / 0.95 / 1.20 | 0.20 / 0.30 / 0.45 / 0.65 / 0.85 |
| **barbell-row**（新覆盖 ②） | 0.50 / 0.65 / 0.90 / 1.20 / 1.50 | 0.30 / 0.45 / 0.65 / 0.90 / 1.15 |

- squat/deadlift/ohp/weighted-pullup 的确切 exerciseId **沿绝对锚 v1 定义同款**（执行时读
  `MuscleMilestoneCatalog.swift:31-59` 对齐；weighted-pullup 不进相对表——负重引体的
  「+X kg」语义与体重比冲突，保留绝对锚即可）。
- linkedMuscles 沿绝对锚同表；barbell-row → **[.back, .biceps]**。

### 3.2 档位 → floor / tier 映射

| 档 | levelFloor | tierCandidate |
|---|---|---|
| beginner | 2 | — |
| novice | 6 | — |
| intermediate | 10 | .intermediate |
| advanced | 16 | .advanced |
| elite | 19 | .elite |

与绝对锚同格（bench-100→10/.intermediate、bench-140→16/.advanced）。elite=19 非 20：
满级留给「elite 档 + 持续训练量」，防一次测验直接满级。

### 3.3 输入与退化（诚实红线）

- **性别**：`profile.sex`（"male"/"female"）。**未设置 → 相对标准整体不参与**（退化=现状绝对锚），
  不猜、不用中间表。设置页可随时补填。
- **体重**：取值优先级 HealthKit 最新 bodyMass → profile.weightKg → nil（nil 同上退化）。
  体重快照作为 composer input 传入（引擎包不 import HealthKit——app 层取好值喂进来，
  沿「HealthKit 不写 canonical」红线，体重只作现算输入不落库）。
- **达成判定**：沿绝对锚双轨——实测达标 = actualCompletedSet（confidence high）；
  仅 e1RM 达标 = estimatedOneRepMax（medium）且同档 actual 已达不重复出估算版。
- **时点简化（注明）**：用「当前体重」× 倍数对「全历史最好成绩」判档。减重后档位可能上浮——
  v1 接受（体重变化缓慢，且力量标准业界口径本就是当前体重）。
- **sex 字段用途单一**：只进相对力量标准，**不进**处方/恢复/等级其他面（防 scope 蔓延；
  规格写回时声明此契约）。

### 3.4 文案（红线：无句号无破折号、零羞辱、置信度零读数）

- 设置铭牌行：「性别」/「Sex」；选项「男」「女」「暂不设置」（"Male"/"Female"/"Not set"）；
  说明一行「用于力量标准对比」/"Used for strength standards"。
- 新 evidence code `relativeStrengthApplied`：「按体重的力量标准抬升了等级起点」/
  "Bodyweight-relative strength raised this level"。
- 全部新 key 进 MuscleLevelCopyTests 四道红线（parity/句号/禁用词/镜像锁）。

### 3.5 owner 场景验收（写成测试）

1. 男 75kg 首场实测卧推 100kg → 相对比 1.33 → intermediate 档 floor 10（与绝对锚 bench-100
   一致，max 合并不重复）；推 37.5kg → beginner floor 2；推 20kg → 无档（走曲线）。
2. **女 60kg 实测卧推 36kg（0.6×）→ intermediate floor 10**——绝对锚给不了的档位（③实证）。
3. 男 80kg 划船 52kg（0.65×）→ novice floor 6 → back/biceps 有了低门槛路径（②实证）。
4. 未设性别 → 全部相对条目不出现，绝对锚行为逐字节不变（回归锁）。

## 4. 切片（TDD：每片失败测试先行）

- **D1** `RelativeStrengthStandards.swift`（RedeLocalSnapshot，挨着 MuscleMilestoneCatalog）：
  表 + `achievements(sex:bodyweightKg:bestActualKgByExercise:bestE1RmKgByExercise:atIso:)` →
  复用 `StrengthMilestoneAchievement` 类型（milestoneId 形如 `rel-bench-intermediate`）+
  floor/tier 映射。全表锚测试（手滑改数值即红）+ 双轨 + 退化。
- **D2** 设置性别行（PlateQuestion 加 case + 编辑分支 + `CanonicalSessionWriter` 写 sex——
  applyPreferences 模式）+ app 层体重取值（HealthKit→profile→nil）。写读回环测试。
- **D3** composer 接线（input 加 sex/bodyweightKg，相对 achievements 与绝对 merge 后喂
  assembler——floors 自然 max）+ `relativeStrengthApplied` evidence（相对 floor 生效时打，
  与 milestoneFloorApplied 区分）+ L10n 四处 + 全量锚更新。
- **D4** 收口：§3.5 四场景测试全绿 + 模拟器实拍（设置性别行 + 女性场景详情页依据行）+
  全量门禁（exit code 实证）+ 独立 code-reviewer + 双日志 + 规格写回（§6.5.5 加相对标准节 +
  sex 用途契约）+ 记忆更新。

## 5. 禁区

- 不动 FR-PR7 简化版里程碑（UI 列表零接触）；不动绝对锚九条的任何数值。
- HealthKit 仍不写 canonical；体重不落库、不进训练历史。
- sex 不进处方/恢复/其他任何决策面。
- 不加 onboarding 步（设置可填即可，YAGNI）。
- 不做年龄系数、体重档分段表（strengthlevel 全表 300+ 行——v1 线性五档倍数够用，过度设计）。
- 分享卡不动（相对档位素材等真机反馈再议）。
