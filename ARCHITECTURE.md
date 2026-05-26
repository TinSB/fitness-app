# IronPath 架构概览

这份文档面向"刚接手这套代码、需要 1 小时建立心智模型"的工程师。它**不**详细描述每个引擎，而是说明每一层的责任、边界和最关键的不变量。详细行为见对应文件和测试。

## 顶层目录

```
ironpath/
├── src/                     # 应用源码
├── apps/api/                # Node 端 dev API runner (SQLite-backed)
├── packages/{contracts,core}/  # 跨 src/apps 共享的最小公共代码
├── tests/                   # vitest 测试套件（5500+ 测试）
├── scripts/                 # 构建辅助：size check / token scan / predeploy
├── public/                  # PWA 资源 (manifest, service worker, icons)
├── docs/                    # 历史 phase 决策文档（314 篇）
├── *.md                     # 根级总览类文档
└── supabase/migrations/     # Supabase 迁移（云同步用，目前未上线）
```

## 应用层（src/）

```
src/
├── main.tsx              # 浏览器入口，挂载 React，注册 service worker
├── App.tsx               # 根组件（2260 行；持有 AppData + 全局 reducer + lazy 路由）
├── features/             # 5 个主页面 + 子面板（移动端首屏只挂今日 / 训练，其余 React.lazy）
├── uiOs/                 # 移动端 OS-shell 风格组件（导航 / 设置 / theme）
├── ui/                   # 通用基础组件（不依赖 AppData）
├── presenters/           # 把 engine 输出转成 view-model（features 直接消费）
├── engines/              # 100+ 个纯函数引擎，所有训练决策都在这一层
│   └── explainability/   # 解释层：把决策翻译成中文可读理由
├── models/               # TypeScript 类型 + JSON Schema (training-model.ts / *.schema.json)
├── data/                 # 训练动作库、模板、默认值（content 与 model 之间）
├── content/              # 证据规则、术语、专业 copy（i18n 之外的"内容"）
├── i18n/                 # 术语 / 文案 / 格式化器（中文为默认）
├── config/               # 环境校验 (environmentValidation)、appConfig (STORAGE_VERSION)
├── storage/              # 持久化：localStorage adapter、migration、sanitize、validation
├── sync/ cloudSync/      # 客户端云同步状态机
├── cloudProduction/      # 服务端云同步运行时（Supabase 适配器、auth wiring 等）
├── productionApi/        # 生产 API 客户端
├── productionCutover/    # 切换"本地 → 云"路径的迁移逻辑
├── personalProduction/   # 个人云同步运行时
├── auth/                 # 认证边界类型与适配器
├── workers/              # Web Worker（Apple Health XML 分块解析）
├── observability/        # 客户端遥测桩（目前最小占位）
├── devApi/               # dev 模式下的 API 实验面板（不进生产构建）
└── prototype/            # 内部产品原型预览（独立 prototype.html 入口）
```

## 关键数据流

### 启动

```
main.tsx
  └─ ReactDOM.createRoot
       └─ App
            ├─ persistence.load() ────► storage/localStorageAdapter
            │                              └─ migrateTrainingData → sanitizeData → validate
            └─ useState(AppData)
                 └─ buildEnginePipeline(appData, currentDate)
                      ├─ trainingDecisionContext (today / history / readiness / pain / level)
                      ├─ todayStateEngine
                      ├─ dataHealthEngine
                      ├─ nextWorkoutScheduler
                      ├─ dailyTrainingAdjustmentEngine
                      ├─ coachActionEngine
                      └─ todayStateEngine (再次，组合 UI 输入)
```

### 训练推荐闭环（已建成）

```
sessionBuilder.createSession
  └─ applyStatusRules (exercisePrescriptionEngine)
       ├─ readinessEngine ────► readiness signal
       ├─ buildAdaptiveDeloadDecision (adaptiveFeedbackEngine)
       ├─ applyAdaptiveExerciseRules
       ├─ painPatternEngine
       ├─ loadFeedbackEngine
       └─ getLoadBias (adaptiveRecommendationEngine) ◄── adaptiveCalibration
  └─ buildSetPrescription (progressionRulesEngine)
       └─ adaptiveTopSetFactor / adaptiveBackoffFactor ► topWeight / backoffWeight
  └─ buildRecommendationSnapshotsForSession
       └─ session.recommendationSnapshots := [{ recommended, applied bias, context }]

[用户完成训练]

trainingCompletionEngine.completeTrainingSessionIntoHistory
  └─ finalizeTrainingSession
  └─ reconcileScreeningProfile (pain / performance drop / issue scores)
  └─ applyCompletedSessionToCalibration
       ├─ reconcileRecommendationRecords  → outcome + acceptance
       └─ updateEntry                     → EWA 更新 loadBias，必要时冻结
  └─ history := [finished, ...history].slice(0, 500)
```

### 时间状态机（lapse）

`trainingLapseEngine.buildTrainingLapseSignal(history, nowIso)` 把距离上次训练的天数映射成 5 档：

| stage | 范围 | 行为 |
|---|---|---|
| fresh | < 4 天 | 正常推进 |
| normal | 4–9 天 | 正常波动 |
| lapsed | 10–20 天 | pain / issue scores 衰减 60%，循环不动 |
| long_lapsed | 21–45 天 | 疲劳重置 + 推拉腿循环回推日；calibration 部分回 1.0 |
| dormant | > 45 天 | 全部重置：疲劳清空、循环回推日、bias 归中性 |

接入点：`reconcileScreeningProfile`、`buildAdaptiveDeloadDecision`、`pickSuggestedTemplate`、`applyStatusRules` 末尾。所有接入点都接受 `nowIso` 以保证测试可重现。

## 不变量（必须维护）

1. **engines 是纯函数。** 不直接读写 localStorage / DOM / 网络；所有副作用集中在 `storage/` 和 `App.tsx` 的 reducer 内。
2. **AppData 是 source of truth。** UI 只从 AppData + engine 输出渲染；不要在组件 state 里复制 AppData 字段。
3. **持久化必经 sanitize。** 任何新字段都要在 `appDataSanitize.ts` 加 sanitizer；否则云同步往返会被丢弃。
4. **schema 升级走 migration。** 改 required 字段或删字段要在 `appDataMigration.ts` 加 vN→vN+1 migration，并升 `STORAGE_VERSION`。
5. **服务端代码不进客户端 bundle。** `node:http` / `node:sqlite` / `devApiRunner` 等标记被 `.github/workflows/ironpath-ci.yml` 的 dist token scan 守卫。
6. **训练建议不能含医疗诊断口吻。** UI 文案审计在 `scripts/scan-production-dist-safety.mjs` 和多个 boundary 测试里。
7. **时间相关引擎要可注入。** 涉及 lapse / deload / calibration 衰减的入口都接 `nowIso`，禁止裸用 `Date.now()`。

## 测试架构

| 类别 | 文件 | 数量 |
|---|---|---|
| 行为测试（engines、presenters、storage） | `tests/<name>.test.ts` | ~840 |
| Boundary 守卫（历史 phase 文件不能再被某 PR 改） | `tests/*Boundary.test.ts` | 274 |
| DocsParity 守卫（实现与对应 doc 措辞同步） | `tests/*DocsParity.test.ts` | 90 |
| 代码质量守卫 | `tests/codeQualityHygieneGuard.test.ts` | 7 |
| 构建脚本守卫 | `tests/checkDistSizeScript.test.ts` | 5 |

跑全量：`npm test`（必须，因为部分 dev API runner 测试需要 `npm_execpath` 才能启动子进程）。

## 已知风险与折中

参见 `ARCHITECTURE_DECISIONS.md`（如有）和 `BUG_DISCOVERY_REPORT.md`。本文不重复列出。

## 不在本文档范围

- 每个 engine 的具体 API：见对应文件 + 测试
- 训练科学依据：见 `README.md` 顶部 + `src/content/evidenceRules.ts`
- 产品形态：见 `AGENTS.md`、`UI_BLUEPRINT.md`、`UI_SPEC.md`
- 上线流程：见 `RELEASE_CHECKLIST.md`、`DEPLOYMENT_CHECKLIST.md`
