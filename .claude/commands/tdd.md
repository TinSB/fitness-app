---
description: 测试驱动的实施流程：先写失败的测试，再写最小可行修复。
---

# /tdd — 测试驱动实施

目的：把已经诊断清楚的修复，按 TDD 流程实施：**先写会失败的测试 → 确认它因为正确的理由失败 → 写最小修复 → 跑测试 → 跑完整验证 → 加回归测试**。

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

## 必须执行的步骤

1. **先写或更新失败的测试**
   - 测试位置和现有 test suite 风格保持一致。
   - 测试名要描述**行为**，不是“函数 X 返回 Y”。
   - 覆盖 happy path 之外，至少覆盖触发 bug 的边界条件。

2. **运行该测试，确认它失败**
   - 必须确认失败的**原因正确**（不是因为 import 错、不是因为 typo）。
   - 如果失败原因不对，先修测试本身，不要进下一步。

3. **写最小修复**
   - 改动尽量集中、可读、不引入新抽象。
   - 不允许为了让测试过而**弱化测试断言**。
   - 不允许删除现有的失败覆盖（除非用户明确同意）。

4. **跑聚焦测试**
   - 先跑刚写的测试 + 该模块的相邻 tests。
   - 通过后再扩到整套。

5. **跑完整验证（所有代码改动都要跑）**
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

6. **加回归测试**
   - 为原始 bug 加一条专门的 regression test，命名清晰指向 bug。
   - 如果 bug 涉及训练 / 推荐 / 云同步 / 存储 / AppData / PWA，**至少**加 1 条 integration 或 smoke 测试。

## 硬约束

- **不允许在没有失败测试的情况下直接改代码**。
- 不允许通过放宽断言 / 改测试期望来让红变绿。
- 不允许删除已有失败用例（除非用户明确说可以）。
- 不允许跳过完整验证流程。
- 涉及 schema / cloud / storage 的改动：必须额外明示 data safety statement。

## 输出结构（实施完成后）

```
Failing test added: <文件:行>
Failed reason confirmed: …
Smallest fix: <文件: 修改概要>
Focused tests: <命令 + 结果>
Full validation:
  - api:dev:build: pass/fail
  - typecheck: pass/fail
  - test: pass/fail
  - build: pass/fail
  - production-dist-safety scan: pass/fail
  - lockfile diff: clean / dirty（必须 clean）
  - pnpm-lock 存在性: 否（必须不存在）
  - git diff --check: clean
Regression test added: <文件:行>
Data safety statement: …
```

完成后建议接 `/handoff` 产出可交付总结。
