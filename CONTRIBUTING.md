# IronPath 贡献指南

本项目是一个本地优先的私人训练系统（React + Vite + TypeScript）。这份文档面向修复 bug、增加功能或重构现有代码的协作者，目的是让你在第一次提交前就理解项目的底线规则。

## 准入前必读

- 主语言：简体中文；代码、命令、API 名、错误日志保持英文原文。
- 主导航固定：今日 / 训练 / 记录 / 计划 / 我的。每个页面的责任见 `AGENTS.md`，不要在不属于它的页面塞功能。
- 默认收敛在 `src/i18n/terms.ts` 和 `src/content/*.ts`；不要在 UI 里硬编码新术语。
- 训练建议遵守 `README.md` 顶部的证据层（Tier A/B/C）。任何"医学/诊断"语气都不允许出现在用户面。

## 本地开发

```bash
npm install
npm run dev            # http://127.0.0.1:3000/
npm run typecheck      # tsc --noEmit
npm test               # vitest run（必须用 npm 入口，否则部分 devApi 测试因缺 npm_execpath 失败）
npm run build          # 生产构建
npm run build:size-check  # 严格 chunk 体积门禁
npm run predeploy:check   # typecheck + test + build + size-check 一站式
```

## 修改流程

1. **先理解再修改。** 项目大量逻辑沉淀在 `src/engines/`，相关引擎、调用链和测试通常已经在隔壁文件里。`grep` 一下再动。
2. **改之前先看测试。** 项目有 ~5500 个测试；改一个引擎前先跑相关测试，确认基线绿；改完再跑一遍。
3. **不允许引入的东西**（由 `tests/codeQualityHygieneGuard.test.ts` 守卫）：
   - `any` 类型注解或断言；用 `unknown` + 类型守卫代替
   - `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`
   - `debugger` 语句
   - `eval` / `new Function()`
   - `dangerouslySetInnerHTML`
   - `console.log`（`console.warn` / `console.error` 用于真实错误上报是允许的）
4. **不要在不理解的情况下改 schema。** `src/models/training-model.ts`、`src/models/training-data.schema.json`、`src/data/appConfig.ts` 的 `STORAGE_VERSION` 是数据契约。新字段加 optional 即可；改 required / 删字段需要同时写 migration 并升 schema 版本。
5. **不要在改动里夹带格式化扫荡。** 单个 PR 只做一件事；自动格式化和功能改动分开提。

## 写测试的硬要求

- 一切引擎逻辑都要有引擎层测试（`tests/<engineName>.test.ts`）。
- 涉及时间的引擎（lapse、calibration、deload 等）必须支持 `nowIso` 注入；测试里不要依赖墙钟。
- 用 `tests/fixtures.ts` 的 `makeSession` / `makeAppData` 而不是手搓 `TrainingSession`。
- Boundary / freeze-check 测试（`tests/*Boundary.test.ts`、`tests/*DocsParity.test.ts`）是历史 phase 的回归锁。**不要为了让 PR 绿就放宽它们。** 如果你的合法改动触发了它们，正确做法是把改动 commit 掉（让 `git diff` 重新为空），而不是改测试断言。

## 提交规范

- Commit 标题用祈使句、约 70 字符以内，描述"为什么"而不是"改了什么"。
- 正文展开背景、影响范围、验证手段。复杂改动至少列出"已跑 typecheck / 全量测试"。
- 不要 `--no-verify` 跳过钩子；不要 `--amend` 已经推过的 commit；不要 force push 到 main。

## CI

- `.github/workflows/ironpath-ci.yml` 在 PR 和 main push 上跑：typecheck → test → build → dist token scan。
- dist token scan 会拒绝把 server-only 标记（`node:http`、`node:sqlite`、`devApiRunner` 等）漏到客户端 bundle。如果你新加了仅服务端使用的工具，让它独立 chunk 或者只从 `apps/api` 引用。

## 数据安全 / 隐私

- 不要 commit `.env*`（已 gitignored），不要把任何真实凭据/token 写进源码或测试。`src/config/environmentValidation.ts` 显式拒绝接收 secret 值。
- 不要新引入直接 DOM sink（`innerHTML`、`dangerouslySetInnerHTML`、`window.open`）。
- 任何持久化新字段都要在 `src/storage/appDataSanitize.ts` 加 sanitizer，否则云同步往返会丢字段且可能被脏数据击穿。

## 文档

- 重大架构/产品决策更新到 `ARCHITECTURE.md`、`README.md` 或对应的 `docs/<TOPIC>.md`。
- `CHANGELOG.md` 在每次合并面向用户可感知的变化时更新（不要为内部重构刷流水）。
- 不要新增 `*.md` 来替代 PR description；先用 PR/commit message 沉淀决策，证明长期参考价值后再独立成文。

## 上线门禁

参见 `RELEASE_CHECKLIST.md`。最小要求：

1. `npm run predeploy:check` 全绿
2. `npm audit` 无 high/critical
3. `tests/codeQualityHygieneGuard.test.ts` 通过
4. README 中"Vercel 部署后测试"清单的 7 项手测过一遍
5. `CHANGELOG.md` 已更新本次面向用户的变化
