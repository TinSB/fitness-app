# 安全策略

## 项目特性与威胁面

IronPath 是一个本地优先的 PWA：

- 默认完全在浏览器端运行，训练数据存在 `localStorage`。
- 没有强制账号系统，没有默认服务端依赖。
- 可选的云同步路径（Supabase）目前**默认关闭**，需要用户在"我的 → 云同步"显式开启。
- 不提供医疗诊断；任何疼痛 / 不适提示只用于训练层面的保守处理。

因此主要威胁面来自：

1. **持久化数据完整性**：用户在浏览器里的数据被脏数据或上游 schema 漂移污染。
2. **第三方依赖供应链**：`react`、`ajv`、`@supabase/supabase-js`、`vite` 及其传递依赖。
3. **客户端注入**：通过用户输入、导入文件（CSV/JSON/`export.xml`）触发 XSS / DoS。
4. **云同步路径上**的认证与传输（Supabase OAuth + REST + RLS）。

## 已部署的防御

- TypeScript `strict: true`；自动化测试拒绝 `any` / `@ts-ignore` / `eval` / `dangerouslySetInnerHTML` / `console.log`（见 `tests/codeQualityHygieneGuard.test.ts`）。
- 持久化：`appDataMigration.ts` + `appDataSanitize.ts` + `validateAppDataSchema` 三道关，任何字段都要单独 sanitize；schema 用 ajv (`ajv@^8.17.1`).
- 环境变量：`src/config/environmentValidation.ts` 显式拒绝把 secret 值传给浏览器层；`.env*` 被 gitignored，CI 与 boundary 测试断言它们不被 commit。
- 构建：`scripts/scan-production-dist-safety.mjs` 扫描产物，拒绝把 `node:http` / `node:sqlite` / `devApiRunner` 等服务端标记漏到客户端 bundle；同样的扫描在 `.github/workflows/ironpath-ci.yml` 中作为 CI step。
- 体积门禁：`scripts/check-dist-size.mjs` 对入口 chunk (默认 500 KB) 与 lazy chunk (默认 750 KB) 分别设阈值，下次任何漂移都会让 CI 红。
- 危险 DOM sink 全数为 0：扫描显示 src 中没有 `innerHTML` 赋值、`dangerouslySetInnerHTML`、`window.open`、`eval`、`new Function()`。
- 依赖审计：`npm audit` 当前 0 vulnerabilities（通过 `package.json` 的 `overrides` 把 `fast-uri` 强制锁到 ≥ 3.1.2，规避 GHSA-q3j6-qgpj-74h6 和 GHSA-v39h-62p7-jpjc）。
- Apple Health XML 分块解析放在 Web Worker，避免主线程 DoS。

## 数据存储

- 默认仅 `localStorage`，按 key 分散存储；用户清浏览器数据即等同于销毁。
- 备份：用户可在"记录"或"我的"页导出 / 导入 JSON 备份。导入会走完整 migrate + sanitize + validate 流程，无效数据不会覆盖现有 AppData。
- 云同步：可选。开启后通过 Supabase Auth + RLS-protected 表存储，token 不写入本地代码或日志。

## 报告漏洞

如果你认为发现了影响用户数据或安全的问题，**不要**直接公开 issue。

1. 提交一个标题为 "Security report" 的 GitHub issue 简短描述影响范围，不要贴 PoC。
2. 等待维护者私信沟通后再披露细节。
3. 我们会在确认后 14 天内回复，并在修复合并后 30 天内披露。

## 已知接受的折中

- **`localStorage` 不加密**：项目假设 device 物理与浏览器 sandbox 已经是用户的信任边界；不为对手已经控制浏览器进程的情况防御。
- **没有强制 2FA / 账号锁**：当前版本无账号；云同步 V1 之后由 Supabase Auth 负责。
- **客户端遥测最小化**：`src/observability/` 目前只是占位；任何引入埋点/上报的 PR 都必须先评审隐私影响。
- **第三方 workout 数据来源不被认证**：用户手动导入的 CSV / JSON / `export.xml` 经过 sanitize 后才进入 AppData，但内容信任本身在用户侧。

## 安全相关测试入口

| 文件 | 守的边界 |
|---|---|
| `tests/codeQualityHygieneGuard.test.ts` | 禁止 `any` / `eval` / `dangerouslySetInnerHTML` 等回归 |
| `tests/checkDistSizeScript.test.ts` | 体积门禁脚本本身的回归 |
| `tests/*Boundary.test.ts` | 历史 phase 不能被新 PR 改的文件清单 |
| `tests/runtimeBoundaryTestHelpers.ts` | 共享：`.env*` 不存在 / 不被 tracked 的断言 |
| `scripts/scan-production-dist-safety.mjs` | 客户端 bundle 不含服务端标记或被禁的措辞 |
