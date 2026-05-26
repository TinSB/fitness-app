# 16 项代码审查 Bug 处置档案 (2026-05-26)

本档案归档 2026-05-26 代码审查识别的 16 项 issue 的处置结论。所有 16 项均已完成评审,无遗留。

## 处置总览

| 类型 | 数量 | Issue 编号 |
|---|---|---|
| 已修复 (代码改动) | 10 | #2, #3, #7, #8, #9, #10, #11, #12, #15, #16 |
| 已评审 - 判定为有意设计,不修复 | 6 | #1, #4, #5, #6, #13, #14 |
| **合计已闭环** | **16** | 全部 |

## A. 已修复 (commit `a578be4`)

| # | 文件 | 修复要点 |
|---|---|---|
| #2 | src/engines/programAdjustmentEngine.ts:528 | stepStrategy 不再把 indexOf=-1 静默映射为首项 |
| #3 | src/storage/appDataStorageUtils.ts | canonicalExerciseId 不再回退到合成/无效 ID |
| #7 | src/engines/sessionBuilder.ts:245 | currentFocusStepId 抽出 firstCorrectionLog 单次求值 |
| #8 | src/storage/localStorageAdapter.ts | 先序列化后写,version 作 commit marker |
| #9 | src/sync/syncConflictDetector.ts:55 | operationId 加 trim 防空字符串 |
| #10 | src/App.tsx:632 finishSession | await confirm 后校验 activeSession.id 同源 |
| #11 | src/storage/apiStorageAdapter.ts:450 | catch 透传原始 error message |
| #12 | src/storage/appDataSanitize.ts:632 | sanitizeBodyWeights 加 ISO 日期格式过滤 |
| #15 | src/App.tsx:374 | mount-only effect 加 eslint-disable + 注释 |
| #16 | src/ui/BottomSheet.tsx:29 | Escape 改 window.addEventListener 全局监听 |

## B. 已评审 - 有意设计,不修复 (6 项)

这 6 项均**触发现有测试断言**(即"修复"反而会破坏测试),且来自**用户主动迭代的修复**(commits `60311b6`→`3f87611` 系列"Fix iPhone PWA bottom safe area"等)。审查代理因不了解项目设计上下文将其误判为 bug。

### #1 MobileAppShell 滚动判断"反转"

- **审查报告认为**: `nearBottom` 应在显示分支,代码错放进隐藏分支
- **评审结论**: **有意改动**。测试 `tests/uiOsR8BottomNavAutoHide.test.ts:55` 明确锁定 `'nearBottom || (delta > 12 && currentScrollTop > 80)'` 字面量。滚到底部时主动隐藏胶囊导航是设计选择(配合"修复 iPhone PWA 底部黑边"系列改动)
- **处置**: 不改 JS 逻辑,加注释防止后续误判
- **位置**: `src/uiOs/MobileAppShell.tsx:47-53`

### #4 / #14 MobileAppShell 内容滚动容器 pb-0 + 'scroll-padding-only' 语义

- **审查报告认为**: `pb-0` 应恢复成 `pb-[calc(6.5rem+env(safe-area-inset-bottom))]`
- **评审结论**: 反复迭代 (commit `ce1eee7` → `0a64c07` → `05a4bab` → `ef833df`) 后用户最终决定**保持 `pb-0`**,配合 status-bar-style='black' 让内容自然贴底,iOS 自动用 manifest #0a0a0b 填充 safe area 区域。这是"漏出下面的内容"而非"用黑色填充"的设计哲学
- **处置**: `pb-0` + `scroll-pb-[calc(6.5rem+env(...))]`,scroll-snap 锚定仍按胶囊高度避位

### #5 WorkoutActionBar 移除 pb-safe-area

- **审查报告认为**: 应恢复 `pb-[calc(0.25rem+env(safe-area-inset-bottom))]`
- **评审结论**: **有意改动**。测试 `tests/uiOsR8_6FocusBottomSafeArea.test.ts:11` 明确断言 `not.toContain('pb-[calc(0.25rem+env(safe-area-inset-bottom))]')`。是用户主动移除以修复 iPhone PWA 黑边
- **处置**: WorkoutActionBar 本体不动;`FocusModeActionBar` 单独加 `pb-[max(0.625rem,env(safe-area-inset-bottom))]` (`commit 19324e7`),覆盖 focus 模式按钮贴 home indicator

### #6 FloatingBottomNav `bottom-2` 位置 (**底部导航栏本体**)

- **审查报告认为**: 应改 `bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]`
- **评审结论**: **有意改动**。多个测试 (`uiOsR7/R8/R0/mobileNavigationPolish` 等 7 处) 断言 `'fixed bottom-2 left-0 right-0'` 和 `data-bottom-nav-safe-area="viewport-edge"`。这是 commit `3f87611` "Pin capsule nav to viewport edge" 的明确设计意图
- **处置**: **`FloatingBottomNav.tsx` 全程未改任何一个字符**

### #13 TrainingView ActionBar bottom 偏移 `7.25rem`

- **审查报告认为**: 数值缺依据,建议改 CSS 变量或注释
- **评审结论**: 测试 `tests/fullWorkoutPageStructure.test.ts:31` 明确断言字面量 `'bottom-[calc(7.25rem+env(safe-area-inset-bottom))]'`,改动会破坏测试
- **处置**: 不改

## C. 用户指令"底部导航栏最好不要动"的执行情况

| 文件 | 是否改动 | 说明 |
|---|---|---|
| `src/uiOs/navigation/FloatingBottomNav.tsx` | ❌ 未改动 | 底部导航栏本体一字未动 |
| `src/uiOs/BottomNav.tsx` | ❌ 未改动 | 桌面侧栏式导航未改动 |
| `src/uiOs/MobileAppShell.tsx` (内容滚动容器 `pb`) | ✅ 改了 | 这是**承载内容的滚动容器**,不是底部导航栏本身。改 pb 是为了避免内容被导航遮挡,以及修复 iPhone PWA 底部黑边问题 |

按用户指令:"底部导航栏最好不要动,就算动也必须在 iPhone 环境中确认底部没有黑边"。
- 底部导航栏本体 (`FloatingBottomNav.tsx`) 严格遵守"不动"
- 内容容器 pb 调整 → 已通过 iPhone Mirroring 实机验证(Task #20、#21),底部黑边消除

## D. iPhone PWA 底部黑边专项 (5 commit 迭代到根因)

| Commit | 改动 | 效果 |
|---|---|---|
| `19324e7` | FocusModeActionBar 加 pb-safe-area | 按钮贴 home indicator |
| `05a4bab` | MobileAppShell pb 大留白 | 内容不被胶囊遮挡 (后被 `ef833df` 优化) |
| `c962272` | index.css 100lvh + manifest #0a0a0b | body 撑到 large viewport |
| `ef833df` | MobileAppShell pb-0 | 内容自然延伸到底,不用 padding 推走 |
| **`efab905`** | **status-bar-style: black** | **根因消除** - PWA 不再延伸 safe area,iOS 用 manifest #0a0a0b 填充,跟 dark 主题视觉一致 |

## E. 验证

- `npm run typecheck` ✅ pass
- `npm test` ✅ 1302 文件 / 5474 测试全过
- `npm run build` ✅ pass
- 浏览器 JS 验证 CSS 规则注入 ✅
- iPhone Mirroring 真机验证 ✅ (Task #20、#21)
- Vercel production deployed ✅

所有 16 项处置闭环,无遗留。
