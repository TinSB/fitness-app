# Precision Recommendation Plan

**目标**: 让 IronPath 推荐重量 / 训练频率 / 强度的精细度逼近一对一私教
水平。系统及时跟随用户进步速度，自动感知用户的真实意图（实际 RIR、
完成质量），但不**额外加上**用户没有要求的硬性规则。

---

## 设计原则

### 1. 跟随而非指令
- 永不强制用户进入某个区间。所有推荐都是"建议下一组怎么做"，
  用户继续按自己节奏走就行。
- 推荐数值优先用**用户自身历史**反推，而不是套用通用 RIR/RPE 公式。
- 当数据不足时（< 3 个有效组）退回 startWeight 等保守缺省，不强加。

### 2. 医疗级精细度
- 重量步进 **2.5 kg** 是默认精度（plate 单位）。机械动作 / 低负重动作
  在未来加 0.5 kg / 1 kg micro-plate 支持时可放宽。
- e1RM 趋势按周线性回归取斜率，**每周 4% 是增长上限**（cap）—
  超过这个增速通常是数据噪音或测验日，不应该顺势继续加 5 kg。
- RIR 偏差按用户**到力竭组**的实际表现校准 (-1.5 .. +1.5)。
  下游所有推荐在消费 RIR 前会减去这个偏差。
- 动作分桶（compound / isolation / machine）独立维护推荐 RIR 区间，
  减少"主力动作和小动作用同一套保守度"的损失。

### 3. 实时跟随
| 时间尺度 | 触发点 | 引擎 | 调整 |
|---|---|---|---|
| 组间（秒级） | 完成一组后 | setByRirAdjustment | ±2.5 kg 下一组 |
| 训练间（天级） | 进入今日页 | setWeightFineTune | 下一次该动作的起始组重量 |
| 周间 | 周末 / 跨日 | repRangeAutoMigration | 切区间（8-12 → 6-10） |
| 月间 | 训练周期 | autoDeloadTrigger / muscleFrequencyAutoAdjust | Deload 周 / 频率 ±1 |

---

## 决策树（下一组重量推荐）

```
makeSuggestion(template, history)
├─ 先看 exerciseTypeBucket → 得 recommendedRirRange
├─ 数据充足吗？(过去 8 周该动作 ≥ 3 个有效组)
│   ├─ 是 → setWeightFineTune
│   │       ↓
│   │       线性回归当前 + 投影下一周 e1RM (cap +4%/wk)
│   │       ↓
│   │       重量 = projectedE1rm / (1 + targetReps/30)
│   │       ↓
│   │       round 到 2.5 kg
│   │
│   └─ 否 → 现有 progressionRules.makeSuggestion 保留为 fallback
│
├─ 校验：合理性 sanity check
│   ├─ 比上次完成最大重量上浮超过 10% 且非测验日？→ damp 到 +5%
│   └─ 比上次完成最大重量下浮超过 15%？→ damp 到 -5%
│
└─ 输出 {weight, reps, targetRir} + reason 一行
```

### 组间即时调整

```
setByRirAdjustment(lastSet, targetRir)
├─ actualRir 在 targetRir 区间内 → hold（不变）
├─ actualRir < targetRir.min - 1 → 下一组 -2.5 kg（最多 -5 kg）
├─ actualRir > targetRir.max + 1 → 下一组 +2.5 kg（最多 +5 kg）
```

只在用户输入了 actualRir 时触发；缺失就 hold，不强求。

### 用户 RIR 偏差校准

```
rirCalibration(history, window=12wk)
├─ 取所有"到力竭" (RIR=0) 组
├─ 对每个组：Epley 反推 "理论 reps at 0 RIR" - 实际 reps = 个体偏差
├─ median 偏差 (clamped to ±1.5) = userRirBias
└─ 下游消费 RIR 时：调整后 RIR = 报告 RIR - userRirBias
```

输出 confidence (low/medium/high)：sample < 6 / 6-12 / 12+。
confidence='low' 时不参与调整，避免新用户被错误校准锁死。

---

## 不动哪些东西

1. **RPE 不强制**: 用户没填 RIR / 没填技术质量，系统就用 fallback，
   不弹窗逼迫用户填。
2. **不改变区间**: 用户在 ProgramTemplate 里设定 8-12 次的动作，
   系统不会偷偷改成 6-10。区间切换走 repRangeAutoMigration，
   但仅在 ProfileView 给一个 chip 建议；用户不点就不切换。
3. **不主动延长训练**: 推荐组数从 ExerciseTemplate.sets 拿，
   即使疲劳分允许加量也不主动添加额外组。
4. **没有 deload 强制**: autoDeloadTrigger 只在条件全部满足时
   给一个 chip 建议；用户继续训练就继续，系统不阻塞。

---

## Smoke 测试 Matrix

测试矩阵覆盖 3 类用户 × 3 类进步曲线 × 关键校准触发，
**纯函数 vitest**（不需要 UI），每个场景 8-12 周 history。

| 用户类型 | 训练龄 | 期望每周 e1RM 增长 | 测试断言 |
|---|---|---|---|
| 新手 | 0-3 个月 | +3% / 周 | 推荐重量应每周 +2.5 kg 上浮（线性跟随）|
| 中级 | 3-12 个月 | +1% / 周 | 推荐重量应每 2-3 周 +2.5 kg |
| 高级 | 12+ 个月 | +0.3% / 周 | 推荐重量应保持稳定，偶尔 +2.5 kg |
| 平台期 | 任意 | 0% / 周 (4 周) | 推荐重量应保持，不强行加量 |
| 退步 | 任意 | -1% / 周 | 推荐重量应下调，触发 setByRirAdjustment |

### 关键测试用例

1. **跟随**：新手用户连续 8 周 +3%/周 → 第 4、6、8 周的推荐重量应分别比第 1 周高 ≥ 7.5kg / 12.5kg / 17.5kg。
2. **cap 生效**：构造一周虚高（80 kg → 95 kg 单组测验）→ 下次推荐 ≤ 83.2 kg（+4%）。
3. **降权异常组**：异常组（RIR=0, 重量比常态低 50%）应被设 outlier 过滤。
4. **RIR 偏差校准**：用户连续 8 次到力竭组报 RIR=0 但实际 Epley 预测能多做 3 次 → userRirBias ≈ +3，下游推荐 RIR=2 时按 RIR=5 看待，加重 ≈ +5 kg。
5. **退步**：连续 3 周 e1RM 下降 → 推荐重量同步下调，不卡在峰值。
6. **数据不足回退**：< 3 组历史 → makeSuggestion 用 startWeight；不报错。
7. **bucket 区间**：compound (squat, kind='compound') 推荐 RIR 1-3；isolation (curl, kind='isolation') 推荐 RIR 0-2。

### Smoke 验证伪代码

```ts
const fitNewbieHistory = build8WeekHistory({
  exercise: 'bench',
  startWeight: 60,
  weeklyGrowthPct: 3,
  targetReps: 5,
});
const week1Rec = makeSuggestion(template, fitNewbieHistory.slice(0, 1));
const week8Rec = makeSuggestion(template, fitNewbieHistory);
expect(week8Rec.weight - week1Rec.weight).toBeGreaterThanOrEqual(15);
expect(week8Rec.weight - week1Rec.weight).toBeLessThanOrEqual(25);
```

---

## 接入方式（最小改动原则）

1. `progressionRulesEngine.makeSuggestion` 内部新增一段 opt-in 路径：
   - 检查 setWeightFineTune 是否有 `fallbackReason === undefined`（即数据充足）
   - 是 → 用 fine-tune 的 suggestedWeightKg 替代原 baseline
   - 否 → 保留现有逻辑
2. `exerciseTypeBucket` 在 makeSuggestion 入口被调用一次：
   - bucket.recommendedRir{Min,Max} 写入 suggestion.targetRir（仅在 template 未显式设定 targetRir 时）
3. `rirCalibration` 在每次 sync /  PV mount 时跑一次，结果缓存在
   `appData.adaptiveCalibration.userRirBias`（不持久化也可以，重 mount 再算）。
4. setByRirAdjustment 在 Focus 训练页"完成一组"reducer 内消费，给出
   "建议下一组" 提示。**本 PR 不接入 UI** —— 仅引擎层暴露。

---

## 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| Fine-tune 把测验日的 PR 当作长期趋势 | 推荐重量虚高 | weekly +4% cap + 异常值过滤（±30% 截断） |
| 用户填错 RIR 时校准跑偏 | 推荐变形 | confidence=low 时不应用偏差 |
| 跨日 / 跨时区 hash 不稳 | 推荐每天微妙变化 | hash 只看 history 内容，不看 todayKey |
| 旧用户没 baseline e1RM | 第 1 周推荐保守 | 用 startWeight + repMin 当 baseline，不阻塞 |

---

**实施顺序**: 计划 → 接入 makeSuggestion (单 PR) → smoke 测试 (单 PR) → 浏览器验证 → 部署。
