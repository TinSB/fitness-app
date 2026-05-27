---
description: 任何重要改动之前，先做一次完整的全仓影响扫描。
---

# /global-scan — 全仓影响扫描

目的：在动任何重要代码之前，强制做一次**全仓搜索 + 清单化**，避免“以为只动一处其实牵动十处”。**本命令禁止编辑代码**，只产出 inventory。

## 共享 IronPath 规则（每个命令都遵守）

- 仓库路径：`~/Developer/ironpath`
- 默认从最新 `main` 开始，除非用户明确指示其他分支。
- 如果 worktree 有未提交改动，**先停止并报告**，不要把本次任务和无关清理混在一起（除非任务本身就是清理）。
- 假设环境：MacBook / macOS。
- 不要使用 `--admin`，不要绕过分支保护。
- 不允许 `package.json` / `package-lock.json` / `yarn.lock` 出现非预期改动。
- `pnpm-lock.yaml` **必须保持不存在**。
- 永远不要泄露 token、env 值、service-role key、API key、cookie、原始 AppData 或任何用户隐私数据。
- 永远不要删除 localStorage、训练历史或云端数据，除非用户明确批准。
- 永远不要静默覆盖云端数据。
- 不要在没有明确批准的情况下修改 AppData 或 TrainingSession schema。
- 代码改动后的标准验证流程：
  ```bash
  npm run api:dev:build
  npm run typecheck
  npm test
  npm run build
  node scripts/scan-production-dist-safety.mjs
  git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml
  test ! -e pnpm-lock.yaml
  git diff --check
  ```
- 合并后若影响生产行为：`npx vercel --prod`
- 涉及 mobile / PWA：必要时做真机 iPhone 或镜像 iPhone 冒烟。
- 训练逻辑、推荐逻辑、云同步、存储、AppData、Settings、Focus Mode、PWA 改动 → 必须做全仓搜索 + 多 Agent 复审。
- 不要用单文件窄补丁解决复杂 bug。

## 何时必须使用本命令

只要任务命中以下任一类型，**强制要求**先跑 `/global-scan` 再做任何决策：

- 推荐系统（recommendation）
- 训练逻辑（training cycles / progression / fineTune / conservative prescription）
- 云同步（cloud sync / sync-on / receipts / conflicts）
- 存储（localStorage / AppData / IndexedDB）
- AppData / TrainingSession schema
- Settings 页
- Focus Mode
- PWA / Service Worker / cache

## 必须执行的步骤

1. **扫描范围**
   - `src/` 全部
   - `tests/` 全部
   - `docs/` 全部
   - `scripts/` 全部
   - 必要时扫 `.github/`、`api/`、`public/`

2. **搜索策略（不能只搜函数名）**
   - **语义关键词**：用功能描述词搜，例如 “consolidate prescription”、“sync receipt”、“training cycle gap”。
   - **中英文 UI 文案双搜**：UI 文案常常只在中文里出现，用 `rg -uu` 同时扫源码 + JSON + i18n。
   - **相似组件而非完全匹配**：搜命名相近的组件 / hook / store，找出可能是“另一个 source-of-truth”的兄弟实现。
   - **schema 字段名 + 类型名 + storage key**：找出所有 producer / consumer。

3. **产出 Inventory 表（必输）**
   每一行：
   | file | symbol/component | responsibility | input | output | consumer | source-of-truth status | 处置（keep / replace / delete / convert-to-signal） |

   - **source-of-truth status**：是 / 否 / 冲突（与谁冲突）
   - **处置**：建议是保留、替换、删除，还是改成只发信号不存数据。

4. **识别冲突**
   - 多个组件都写同一份数据 → 标记 source-of-truth 冲突。
   - 多个 surface 显示同一数据但来源不一致 → 标记 presentation 冲突。
   - 旧实现尚未删除但已有新实现接管 → 标记 dead code 待清理。

5. **风险标注**
   - 数据风险：是否会覆盖用户历史、训练记录、云端数据。
   - UI 风险：哪些 surface 会被联动改动。
   - 部署风险：是否需要 `npx vercel --prod`、是否需要真机 PWA 冒烟。

## 硬约束

- **本命令不允许编辑代码**。
- 不允许只搜函数名就结束——必须做语义 + 中文文案搜索。
- 不允许把扫描结果浓缩成“看了一下，没问题”——必须给 inventory 表。
- 如果扫到 source-of-truth 冲突，**直接升级到 `/multi-agent-audit`**，不要在本命令里继续。

## 输出结构

```
扫描范围: src/ tests/ docs/ scripts/ + …

搜索关键词:
- 语义：…
- 函数 / 组件 / hook：…
- 中文 UI 文案：…
- schema / storage key：…

Inventory:
| file | symbol | responsibility | input | output | consumer | SoT | 处置 |
|------|--------|----------------|-------|--------|----------|-----|------|
| …    | …      | …              | …     | …      | …        | …   | …    |

冲突:
- source-of-truth 冲突: …
- presentation 冲突: …
- dead code 待清理: …

风险:
- 数据风险: …
- UI 风险: …
- 部署风险: …

下一步: /diagnose / /zoom-out / /multi-agent-audit / /to-issues
```
