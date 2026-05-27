# CLAUDE_SKILLS_REBUILD_V1

本文件记录：把用户在另一台电脑上常用的 Codex Skills，按记忆**在本仓库内重建**为 Claude Code 项目级 commands / skills 的过程、产物、和注意事项。原 Codex 文件源不可获得，本次重建是基于用户记忆的**新版本（V1）**，不是历史复刻。

## 1. 为什么重建

- 用户原先在另一台电脑上配置了一组 Codex Skills（包括 `/diagnose`、`/grill-with-docs`、`/zoom-out`、`/to-issues`、`/tdd`、`/handoff`），日常 IronPath 工作高度依赖它们。
- 那台机器目前不可用，原文件无法导出。
- 本次任务的目标是**在不接触外部源、不下载社区 skill、不执行未知脚本**的前提下，按用户记忆重建一套**仅作用于本仓库**的 Claude 版本，让未来 Claude 会话能继续使用相同工作流。
- 在重建过程中同步加入两个 IronPath 专属新工作流：`/global-scan` 与 `/multi-agent-audit`，对应 IronPath 高风险领域（训练 / 推荐 / 云同步 / 存储 / AppData / PWA）。

## 2. 原 Codex Skills（按记忆列出）

> 注：以下来自记忆描述，原始 Markdown 内容已不可见。本次重建是**根据描述+用户当前的 IronPath 实战习惯**写成，不是逐字复刻。

| 旧 Codex Skill     | 大致用途（记忆）                                                                 |
|--------------------|---------------------------------------------------------------------------------|
| `/diagnose`        | 在改代码前找到真正的根因，不是症状                                              |
| `/grill-with-docs` | 用 docs / tests / 架构 / 安全契约严格拷问方案                                   |
| `/zoom-out`        | 防止隧道视野：先画系统数据流再决定怎么改                                        |
| `/to-issues`       | 把审计结论拆成独立可执行任务                                                    |
| `/tdd`             | 失败测试先行的实施流程                                                          |
| `/handoff`         | 任务收尾，产出可交接的报告                                                      |

## 3. 新建的 Claude 命令文件（主交付物）

位置：`.claude/commands/`（项目级 slash command，输入 `/<name>` 直接调用）。

| 文件                                       | 命令                  | 用途                                   |
|--------------------------------------------|----------------------|----------------------------------------|
| `.claude/commands/diagnose.md`             | `/diagnose`          | 找真根因                               |
| `.claude/commands/grill-with-docs.md`      | `/grill-with-docs`   | 用 docs/tests/契约 拷问方案            |
| `.claude/commands/zoom-out.md`             | `/zoom-out`          | 画系统图、判断 bug 类型                 |
| `.claude/commands/to-issues.md`            | `/to-issues`         | 把发现拆成独立任务                      |
| `.claude/commands/tdd.md`                  | `/tdd`               | 失败测试先行的实施                      |
| `.claude/commands/handoff.md`              | `/handoff`           | 任务收尾交接                            |
| `.claude/commands/global-scan.md`          | `/global-scan`       | **新**：高风险改动前全仓影响扫描        |
| `.claude/commands/multi-agent-audit.md`    | `/multi-agent-audit` | **新**：多 Agent 独立审计               |

所有命令文件都嵌入了**共享 IronPath 规则**（见第 6 节），未来无论从哪个命令进入都会带上这些硬约束。

## 4. 可选的 SKILL.md 文档目录

位置：`.claude/skills/<name>/SKILL.md`。

- 这些文件作为**导航/速查文档**，便于在 Claude / 编辑器里直接打开查阅。
- 它们**不构成运行时依赖**——主入口仍然是 `.claude/commands/*` 下的 slash command。
- 若未来 Claude Code 支持 project-scoped skills 的运行时加载，这些 SKILL.md 也是合规结构（带 `name` / `description` frontmatter）。

文件清单：

```
.claude/skills/diagnose/SKILL.md
.claude/skills/grill-with-docs/SKILL.md
.claude/skills/zoom-out/SKILL.md
.claude/skills/to-issues/SKILL.md
.claude/skills/tdd/SKILL.md
.claude/skills/handoff/SKILL.md
.claude/skills/global-scan/SKILL.md
.claude/skills/multi-agent-audit/SKILL.md
```

## 5. 如何调用每个命令

在本仓库内的 Claude Code 会话里，直接输入：

| 想做什么                                                | 输入                  |
|---------------------------------------------------------|----------------------|
| 找 bug 的真根因                                         | `/diagnose`          |
| 拷问一个修复方案是否站得住脚                            | `/grill-with-docs`   |
| 拉远视角看系统数据流                                    | `/zoom-out`          |
| 把审计结论拆成可单独 PR 的任务                          | `/to-issues`         |
| 进入 TDD 实施                                            | `/tdd`               |
| 产出交接报告                                            | `/handoff`           |
| 高风险改动前做全仓 inventory                            | `/global-scan`       |
| 多 Agent 独立审计（推荐/训练/云同步等高风险任务）        | `/multi-agent-audit` |

典型组合：

- 普通 bug：`/diagnose` → `/grill-with-docs` → `/tdd` → `/handoff`
- 高风险改动：`/global-scan` → `/multi-agent-audit` → `/to-issues` → `/tdd` → `/handoff`
- 担心隧道视野：在 `/diagnose` 之后插一段 `/zoom-out`

## 6. 共享 IronPath 安全规则（所有命令都内嵌）

每个命令文件里都重复嵌入了以下硬约束（这样未来无论从哪个入口进入，都不会漏掉这些规则）：

- 仓库路径：`~/Developer/ironpath`
- 默认从最新 `main` 开始
- worktree 有未提交改动 → 停下报告，不混合无关清理（除非任务本身是清理）
- 环境假设：MacBook / macOS
- 不使用 `--admin`、不绕过分支保护
- `package.json` / `package-lock.json` / `yarn.lock` 不允许非预期改动
- **`pnpm-lock.yaml` 必须不存在**
- 严禁泄露任何 token / env / service-role key / API key / cookie / 原始 AppData / 用户隐私数据
- 严禁删除 localStorage / 训练历史 / 云端数据（除非明确批准）
- 严禁静默覆盖云端数据
- 不在没有明确批准下修改 AppData / TrainingSession schema
- 标准代码改动验证：
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
- 合并后影响生产 → `npx vercel --prod`
- 涉及 mobile / PWA → 真机 / 镜像 iPhone 冒烟
- 训练 / 推荐 / 云同步 / 存储 / AppData / Settings / Focus Mode / PWA 改动 → 必做全仓搜索 + 多 Agent 复审
- **不允许用单文件窄补丁解决复杂 bug**

## 7. IronPath 默认工作流（建议把它内化）

```
普通改动
  ─► /diagnose ─► /grill-with-docs ─► /tdd ─► /handoff

高风险改动（推荐 / 训练 / 云同步 / 存储 / AppData / Settings / Focus Mode / PWA）
  ─► /global-scan ─► /multi-agent-audit ─► /to-issues ─► /tdd ─► /handoff
                  ↑
       （任一阶段发现 SoT 冲突 / 多 source 矛盾，强制升级到 /multi-agent-audit）

任何阶段觉得只盯一个文件不够 → 插一段 /zoom-out
```

推荐系统的特别规则（写在 `/multi-agent-audit` 里）：
- 不允许打补丁式只改一个推荐组件。
- 多个 recommendation source 给冲突结论 → **先合并为单一 source-of-truth，再动 UI**。

## 8. 不能完整还原的部分（坦白说明）

由于原 Codex 文件不可访问，以下内容是**根据用户记忆 + IronPath 仓库现状重构**的，而不是原文复刻：

- 每个 skill 的具体措辞、强制规则数量、输出模板细节，可能与旧版略有差异。
- 旧 Codex skill 中如果有**未在记忆里被复述的边角规则**，本次重建无法包含。
- 旧 Codex 如果还有除上述六个之外的 skills（如 `/cleanup`、`/observability` 等），本次未重建——需要时用户可指认补建。
- 旧 Codex 中可能有 `mode: subagent` / `allowed-tools` 等高级配置，本次重建采取**保守纯 Markdown 形式**，不依赖运行时支持。

如果之后想要更接近旧版的版本：
- 在另一台机器恢复访问后，把旧文件直接对照拷贝过来覆盖即可。
- 这次的 V1 设计上是**安全可替换**的：覆盖 `.claude/commands/*` 不会影响应用代码。

## 9. 下一步建议

1. 在本仓库内开一个 PR：`Rebuild IronPath Codex Skills for Claude V1`，验证一遍每个命令的可调用性。
2. 找一个低风险任务（例如已知的小 typo / lint 问题）走一遍 `/diagnose → /tdd → /handoff`，检验工作流。
3. 找一个推荐相关或云同步相关的真实任务走一遍 `/global-scan → /multi-agent-audit`，确认它能复现你过去依赖的“严格多视角审计”体验。
4. 如果某个命令的输出风格不符合期望，**直接修改对应的 `.claude/commands/*.md` 文件**，不需要重新跑这个 rebuild 流程。
5. 等旧 Codex 文件能恢复后，对照本 V1 做 diff，把缺失的细节补回。
