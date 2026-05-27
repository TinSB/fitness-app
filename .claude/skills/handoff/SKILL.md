---
name: handoff
description: 产出可交接的任务收尾报告，下游零起点继续。读完后调用 `/handoff`。
---

# Skill: handoff

## 何时使用
- 任务完成（已实施 + 已验证），准备结束当前会话。
- 准备开 PR、合并、部署前的最后整理。
- 需要把上下文交给下一个 Claude 会话或人类 reviewer。

## 主入口
`.claude/commands/handoff.md` 是权威定义。
直接使用：在 Claude Code 里输入 `/handoff`。

## 关键产出（缺一不可）
- root cause
- changed files / tests added/updated
- validation commands & results（含 lockfile diff、pnpm-lock 不存在、git diff --check）
- browser smoke + iPhone/PWA smoke（或 N/A 并说明）
- data safety statement
- package/lockfile statement
- PR number / merge status / deployment status
- known limitations
- next recommended task
- exact commands run

## 硬约束
- 任意必输字段缺失 = 未完成。
- 不允许“看起来应该没问题”这种模糊措辞。
- 没开 PR 必须说明原因。

## 推荐衔接
本命令通常是最后一步。
