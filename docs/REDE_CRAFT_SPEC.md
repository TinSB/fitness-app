# Rede 品质层 + 工艺规格 + 文件级路线 (Craft Layer & Build Spec)

> **状态:** Canonical（2026-06-11 自 .ai-tmp 工作稿转正，登记于 DOCS_MANIFEST）· **日期:** 2026-06-08（首版） · **聚焦:** Rede（方法跑通后套用 Larder）
> **为什么有这份:** 上一版设计路线稿（早期 `DESIGN_SYSTEM_ROADMAP` 工作稿，未进仓库、已并入本文 Part C）只给了 token 与流程。但 **token 只保证「一致」，不保证「不通用」**。AI 做设计必然回归训练均值＝组件堆叠。这份补上 token **之上**的一层——把「锻铁/Emberline」这种词，变成可机器复刻、可被 CI 强制的规格。
> **配套:** 本会话已渲染 `Rede Today` 的 generic→crafted 对比图，本文 Part B 是其像素级落地。
> **实现状态（2026-06-13）:** 本工艺层已在 `ios/Rede` 原生落地并随 App shipping——`RedeTheme`（locked tokens：base `#15130F` / ember `#E1652B` 等）、`RedeComponents`（`ForgedCard` / `ForgedGrain` / `EngraveDivider` 等签名组件）、`quality-gate.cmd` 的每视图 ForgedCard 预算门禁。以下 Part B–K 的 Phase / brief 为规格与历史规划，落地实现以代码为准。
> **⚠ 2026-06-08 修正（先读 Part J）:** 通读全部设计文档后发现 A–I 里有我自造、与 canonical 冲突的参数。视觉真源 ＝ `docs/REDE_PRODUCT_DESIGN_LANGUAGE.md`。凡冲突**以 Part J 为准**：导航是 **4 tab（Today / Train / Progress / Plan）**，Settings 非 tab；并有 Recovery / Caution / Risk / Trust 语义色。**⚠ 视觉最终 locked 以 §11 / Part J·J8 / Part K 为准（owner 定的暖底 `#15130F` / Ember `#E1652B` / 卡片 12px / 仪表标签 letterspacing / SF Pro tabular）——本行早期写的 `#111312` / `#E85D2A` / 8pt / ls0 已被 J8 反转，勿用。**

---

## Part A — 品质层 (Craft / Art-direction Layer)

> 设计系统通常只到 token + 组件库，这恰恰是「通用化放大器」。Part A 是阻止通用的那层，分四块：签名系统、构图法则、AI 味禁区、工艺清单。

### A1. 签名系统 (Signatures) — 把「词」变成「可机器复刻的规格」

识别度来自少数被反复使用、可拥有的视觉装置。Rede 定 **5 个签名**，每个给「定义 / 精确规格 / 唯一性 / 禁用」。

**S1 · Emberline（熔铁线）— 第一签名**
- **定义:** 一条克制的熔铁色路径，只表示「下一步」。
- **规格:** 宽 2px；色 `#E1652B`（ember，唯一品牌橙）；直线或单段 90° 折线；端点为实心三角节点，指向目标；长度＝从判断到下一步元素的实际距离，不为装饰延长。
- **唯一性:** **每屏至多一条**，必须指向当前唯一的「下一步」（建议 / 当前组 / 主操作三者之一）。出现两条＝错。
- **运动:** 只沿自身方向「推进」（draw-on 200–250ms ease-out）；不闪烁、不发光、不脉冲。
- **禁用:** 背景、卡片边框、图标着色、成功/恢复态、分隔线、glow。

**S2 · 刻线（Engrave / Knurl）— 结构分隔与刻度**
- **定义:** 取自杠铃滚花与刻度的短竖线节奏，作分隔与标尺，替代通用 1px 描边。
- **规格:** 竖线高 6–9px、间距 20px、宽 1px、色＝separator `#2E2A22`（暖灰、低对比）；端点两根略长收边。用于区块分隔、数值轨道、进度标尺。
- **唯一性:** 分隔优先用刻线而非整条描边；同屏刻线风格统一。
- **禁用:** 当装饰纹理铺满；当圆角卡片外框。

**S3 · 仪表数字（Instrument numerals）— 训练 App 的数字是主角**
- **定义:** 把关键数字当仪表读数排版。
- **规格:** 等宽 tabular-nums；数值字号 ≥ 单位 2 档且更亮（值 primary、单位 tertiary）；右对齐成列；值与单位基线对齐；主数值 ≤ display 档，**禁止超大化到「庆祝」尺度**。重量 / 容差 / RIR 一律此处理。
- **唯一性:** 一屏只有一个「主读数」拿最大字号，其余降级为数据条。
- **禁用:** 彩色数字、数字叠图标徽章、等距彩色 stat 卡墙。

**S4 · 判断块（Verdict block）— 版式签名，不只是原则**
- **定义:** 每个高频页先给一句「结论 / 判断」，再给依据，是一个固定版式装置。
- **规格:** 占 hero 位；结论 1–2 行（title 档 / weight 500 / 左锚）；其下 1 行依据（body / secondary）；判断块独占视觉重心，四周留白 ≥ lg。
- **唯一性:** 每屏只有一个判断块，且它是 Emberline 的起点。
- **禁用:** 用图表 / 模块墙开屏；用「分析中」制造黑箱。

**S5 · 锻铁面（Forged surface）— 材质签名**
- **定义:** 暖调石墨深色，靠色调抬升，不靠渐变 / 阴影 / 玻璃堆叠。
- **规格:** 不用纯黑纯白（base `#15130F` · raised `#211E18` · sunken `#100E0B` · 文字 `#ECE6D8`）；抬升＝surface 色调上移 + 至多极轻暖阴影；一屏 ≤ 3 层 surface；允许极细颗粒，禁渐变。
- **禁用:** 彩色渐变 hero、玻璃叠玻璃、霓虹、纯黑底。

### A2. 构图法则 (Composition Doctrine) — 直接杀死「组件堆叠」

硬规则，违反即返工：

1. **每屏一个 hero。** 一个元素拿最大视觉权重（通常是判断块），其余一律降级。没有「全是重点」。
2. **判断先于数据。** 先结论后依据、先动作后明细。开屏不铺模块墙。
3. **左锚 + 刻意不对称。** 仪表式左对齐，数字右对齐成列；拒绝「什么都居中」的安全构图。
4. **密度有节奏。** 组内紧（xs/sm）、组间松（lg/xl）；拒绝全局等距 16px 堆叠。留白是工具不是浪费。
5. **降级而非并列。** 次要信息收成一条「数据条」，不是又一排等高卡。一屏 stat 卡数 ＝ 0。
6. **一屏一个主操作。** 其余操作降为文字级；主操作不做全宽彩色 pill。
7. **一处口音。** 全屏只有一个 ember 口音（S1）；其余单色调。颜色不编码情绪。
8. **控制权恒定。** 「查看依据 / 撤销 / 降级」始终在、视觉权重恒定，用户始终握有最终动作。

### A3. AI 味禁区 (Anti-pattern Catalog) — 给 AI 的负向约束

> 这张表可直接贴进发给 Claude Code / v0 的约束里。AI 需要「不准长这样」才不会回退到均值。

| 错（AI 默认） | 为什么是 AI 味 | Rede 改法 |
|---|---|---|
| 等高彩色 stat 卡墙（2×2 / 横排） | 全是重点＝没有重点；色彩噪声 | 一个主读数 + 一条降级数据条 |
| 渐变 / 发光的 readiness 大环 | 数据被「庆祝」、黑箱感 | 判断块一句给结论；数字仪表化 |
| 全宽彩色 pill 主按钮 | 通用 SaaS 味、抢重心 | 单一锻铁主操作 + ember 左缘 |
| 问候语 + emoji + 日期开屏 | 填充、去专业 | 刻线 overline + 判断块直入 |
| 每卡一个 drop shadow | 通用 Material 味 | 色调抬升，至多极轻暖阴影 |
| 彩色圆形 / emoji 图标 | 玩具感，与锻铁气质冲突 | 单线刻线风图标，单色 |
| 什么都居中、全局等距 | 安全＝平庸 | 左锚、密度节奏、不对称 |
| 彩虹色数据可视化 | 颜色当装饰 | 单色 + 唯一 ember 口音 |
| 「AI 分析中…」spinner | 制造黑箱、拖延判断 | 立即给判断，依据可展开 |
| 圆角 + 玻璃 + 渐变叠满 | 堆材质冒充高级 | 减法纪律才出高级 |

### A4. 工艺清单 (Craft Checklist) — 每屏过审 pass/fail

- [ ] 这屏的**唯一 hero**是谁？只有一个吗？
- [ ] Emberline 是否**恰好一条**且指向真实的「下一步」？
- [ ] 主数字是否等宽、右对齐、单位弱于数值、未超大化？
- [ ] 分隔是否优先用刻线而非整框描边？
- [ ] 是否**零渐变、零 glow、零纯黑纯白**？抬升是否靠色调？
- [ ] 是否**只有一处 ember 口音**，其余单色调？
- [ ] 是否**没有等高卡墙**？次要信息是否收成数据条？
- [ ] 主操作是否唯一、非全宽彩色 pill？
- [ ] 密度是否有节奏（组内紧 / 组间松），而非全局 16px？
- [ ] 图标是否单线单色、与锻铁气质一致（无 emoji）？
- [ ] 「查看依据 / 撤销 / 降级」是否在，用户是否始终有控制权？
- [ ] 文案是否走 `REDE_PRODUCT_COPY_BASELINE.md` 语气（先判断、不炒作）？
- [ ] AA 对比度、触控 ≥ 44pt、Dynamic Type 不截断？
- [ ] **减法测试:** 去掉这屏 20% 的元素，信息还完整吗？（能，则说明原本在堆）

---

## Part B — Today 页工艺规格 (pixel-level，对应对比图右屏)

把对比图右侧拆成可实现规格。这是「用一个真实页把方法砸实」。

- **画布:** 375 × 812（@1x 基准），安全边距 20px，锻铁面 base `#15130F`，无渐变。
- **区 1 · overline:** `TODAY · PUSH A`，11px / letter-spacing 2.5px / tertiary `#9C9484`；顶距 22px。
- **区 2 · 判断块（hero）:** 左内缩 14px（给 Emberline 让位）；结论 21px / 500 / `#ECE6D8` / 行高 1.35，2 行；依据 13px / `#9C9484`，上距 10px；判断块上下留白 ≥ 20px。
- **Emberline:** x ＝ 20px 竖线，宽 2px，色 `#E1652B`，从判断块顶（y≈74）延至 NEXT 行（y≈300），端点实心三角指向 NEXT。**全屏唯一。**
- **区 3 · 刻线分隔:** 满栏主线 + 约 13 根刻度竖线，色 `#2E2A22`；与上区距 22px。
- **区 4 · NEXT 读数:** `NEXT` 11px / ls2 / tertiary；左「Bench press」15px / primary，右 `185`（34px / mono / 500 / primary）+ `lb`（13px / tertiary）；下行 `5 reps · RIR 2` 12px / mono / secondary，右对齐。
- **区 5 · 数据条（降级）:** `Readiness 82 · Sleep 7:10 · HRV 48 · Vol 14k`，12px / mono / tertiary，中点分隔；无图标、无卡。
- **区 6 · 主操作:** 单按钮 `Start`，bg `#211E18`，左缘 2px ember，14px / 500 / primary，左锚不全宽；其右 `View reasoning` 13px / tertiary（保留控制权）。
- **区 7 · Tab:** 4 个单线图标 tertiary，active（home）顶加 2px × 14 ember tick；细、退后。
- **节奏:** 判断块四周松（≥ 20）、数据条内紧；左锚不对称；全屏一处 ember 口音。

> 这是**方法示范**，不是终稿设计。它证明同样的信息，靠 S1/S3/S4 + 减法就能从「组件堆叠」变成有重心、有性格。

---

## Part C — 路线下钻到文件级

> 把早期设计路线稿的 Phase 展到文件 / token / 脚本级（该路线稿已并入本文 Part C），并且——**把 Part A 的品质层做成机器可强制的 lint/CI**，这才是防 AI 味回潮的关键。

### C1. Token 仓库目录树（决策 C1 分层落地）

```
packages/tokens/
  src/
    foundation/            # 两产品共享：结构与语法
      spacing.json  radius.json  type.json  elevation.json
      motion.json   breakpoint.json  zindex.json  a11y.json
    brand/
      ironpath/
        color.primitive.json   # graphite + ember 色板
        typeface.json
        signature.json         # S1–S5 参数（emberline 宽/色/唯一性、刻线间距…）
      larder/ …
    semantic/
      color.role.json          # surface/onSurface/accent/positive/warning…（角色名共享）
      elevation.role.json
    theme/
      ironpath-dark.json  ironpath-light.json
      larder-dark.json    larder-light.json
  config/style-dictionary.config.mjs
  build/                       # 生成物（gitignored，CI 产出）
    css/    swift/
  scripts/verify-craft.mjs     # 品质层 CI 校验
  package.json
```

### C2. DTCG 样例（节选，`$value`/`$type` 格式）

`foundation/spacing.json`
```json
{ "space": {
  "xs": { "$value": "8px",  "$type": "dimension" },
  "md": { "$value": "16px", "$type": "dimension" },
  "lg": { "$value": "24px", "$type": "dimension" }
}}
```

`brand/ironpath/color.primitive.json`
```json
{ "ironpath": {
  "graphite": { "900": {"$value":"#15130F","$type":"color"},
                "800": {"$value":"#211E18","$type":"color"} },
  "ember":    { "600": {"$value":"#E1652B","$type":"color"} },
  "bone":     { "100": {"$value":"#ECE6D8","$type":"color"} }
}}
```

`semantic/color.role.json`（只引用 primitive，**不写裸值**）
```json
{ "color": {
  "surface":   { "base":   {"$value":"{ironpath.graphite.900}","$type":"color"},
                 "raised": {"$value":"{ironpath.graphite.800}","$type":"color"} },
  "onSurface": { "primary":{"$value":"{ironpath.bone.100}","$type":"color"} },
  "accent":    { "next":   {"$value":"{ironpath.ember.600}","$type":"color"} }
}}
```

`brand/ironpath/signature.json`（**品质层参数也进 token**）
```json
{ "signature": {
  "emberline": { "width":{"$value":"2px","$type":"dimension"},
                 "color":{"$value":"{ironpath.ember.600}","$type":"color"},
                 "maxPerScreen":{"$value":1,"$type":"number"} },
  "engrave":   { "tick":{"$value":"7px","$type":"dimension"},
                 "gap": {"$value":"20px","$type":"dimension"} }
}}
```
**关键:** 签名是 token，不是口头约定。`maxPerScreen: 1` 能被 lint 读取并强制（见 C5）。

### C3. Style Dictionary 配置（要点，不贴全码）

`config/style-dictionary.config.mjs`：对 `brand × mode` 笛卡尔积循环，动态生成 4 套 theme，每套两个 platform——
- `source` ＝ `foundation/*` + 对应 `brand/<b>/*` + `semantic/*` + `theme/<b>-<m>.json`
- `platforms.css` → `format: css/variables`，选择器 `:root[data-brand][data-theme]`
- `platforms.ios` → `format: ios-swift/class.swift`
- 全程 `outputReferences: true`，保留 foundation→brand→semantic 的引用层级
- 给 Claude Code 的实现点：用循环 + `getPlatformConfig` 生成 4 套，**不手写 4 份配置**。

### C4. 生成物样例

`build/css/ironpath.dark.css`
```css
:root[data-brand="ironpath"][data-theme="dark"]{
  --ip-space-md:16px;
  --ip-color-surface-base:#15130F;
  --ip-color-accent-next:#E1652B;
}
```
`build/swift/RedeTokens.swift`
```swift
public enum IPColor { public static let surfaceBase = Color(hex:0x15130F)
                      public static let accentNext  = Color(hex:0xE1652B) }
public enum IPSpace { public static let md: CGFloat = 16 }
```
\+ **SwiftUI 薄适配层**（手写一次，长期稳定）：`Theme.color.surface.base` 映射到生成枚举，组件只认 `Theme.*`。

### C5. CI 与品质强制（防 AI 味回潮的核心）

`.github/workflows/tokens.yml`：token / UI 改动 → build 4 套 → `verify-craft` → 上传产物 diff。

`scripts/verify-craft.mjs` **fail the build if**：
- UI 源码出现裸 hex / 裸 px（必须走 token 变量）。
- 命中 `linear-gradient` / `radial-gradient`（禁渐变，A3）。
- `box-shadow` 超出白名单（禁堆阴影，A3）。
- 单屏 Emberline 实例数 > `signature.emberline.maxPerScreen`（扫描组件树 / 快照，S1）。
- semantic 层存在裸值；theme 缺角色；**Larder theme 出现失败红**（红线）。
- **截图回归:** 对关键页跑 desktop/mobile 渲染（沿用今天 `.ai-tmp` 的 render 做法）与基线比对。

> 把 A2/A3 的硬规则**编译进 CI**，AI 实现就回不到「组件堆叠」——这是「让 AI 不出 AI 味」唯一可靠的办法：不靠它自觉，靠机器拦。

### C6. 组件文件清单（Phase 4，双端共享 spec、各端实现）

| 组件 | spec | iOS (SwiftUI) | Web |
|---|---|---|---|
| VerdictBlock（S4） | `specs/verdict-block.md` | `…/Components/VerdictBlock.swift` | `…/verdict-block.tsx` |
| Emberline（S1） | `specs/emberline.md` | `…/Emberline.swift` | `…/emberline.tsx` |
| InstrumentReadout（S3） | `specs/instrument-readout.md` | `…/InstrumentReadout.swift` | `…/instrument-readout.tsx` |
| EngraveDivider（S2） | `specs/engrave-divider.md` | `…/EngraveDivider.swift` | `…/engrave-divider.tsx` |
| ForgedButton | `specs/forged-button.md` | `…/ForgedButton.swift` | `…/forged-button.tsx` |
| DataStrip（降级数据条） | `specs/data-strip.md` | `…/DataStrip.swift` | `…/data-strip.tsx` |

每个 spec 含：anatomy / 状态 / 变体 / token 映射 / a11y / 动效 / Do-Don't。组件只认 semantic + signature token。**注意签名组件（S1–S4）先于通用组件做**——它们才是品牌记忆点。

### C7. 给 Claude Code 的下一步 brief（Phase 1，可直接发）

```
目标   : 建 packages/tokens 骨架 + 最小跨端管线 + 品质 lint 雏形。
范围   : 目录树(C1) + DTCG 样板(C2，每文件放 3–5 个值) + SD 配置(C3)
         + 生成 css/swift(C4) + signature.json + verify-craft.mjs(先做前 3 条规则)。
输入   : 本文 Part A/C；两份设计语言散文文档。
约束   : DTCG $value 格式；引用只能 foundation→brand→semantic→theme，禁反向(lint)；
         semantic 无裸值；Larder 分支不含失败红。
产出   : npm run build 出 ironpath dark/light 两套 css+swift；
         npm run verify 能拦裸 hex / 渐变 / 反向引用。
验收   : 改一个 ember 值 → 4 处产物联动更新；
         故意加第二条 Emberline → verify 报错退出。
超出范围: 填全量 token(Phase 2)、组件实现(Phase 4)。
```

---

**一句话:** token 防「不一致」，品质层防「通用」；把品质层编译进 CI，AI 才不会把它做成组件堆叠。

---

## Part D — 签名库跨页验证 (Signature Stress-test)

> 把 Part A 的签名套到三个差异极大的页（训练中 / 复盘 / 计划），目的不是出图，是**压测签名库、找出缺口**。结论：S1–S5 主干成立，但需三处补强，固化为 v0.2。配套对比图见本会话。

### D1. 训练中 (Active set) — 压测「极简 + 仪表」

- **用途:** 单组执行，瞄一眼就走。
- **hero:** **仪表读数本身**（`185 lb`），不是判断块。
- **签名应用:** S3 升为 hero；S1 + S2 合并成左侧「进度轨」（4 组刻度，当前组 ember 节点）；专注态**全程无 Tab**，chrome 全退。休息计时走 mono 仪表 + 单色消耗条，**不做环、不庆祝**。
- **缺口 1 → hero 不止「判断块」一种。** 动作页的 hero 是仪表。需要「hero 原型」分类（D4）。
- **缺口 2 → Emberline 会「前进」。** 记一组后 ember 节点下移到下一组——S1 的运动不只 draw-on，还有「沿进度轨推进」。

### D2. 复盘 (Review) — 压测「抗数据墙」

- **用途:** 周复盘，数据最多、最容易堆成彩虹图墙。
- **hero:** 判断块回归（`Strong week. Back lagging.`）——**数据页依然判断先行**。
- **签名应用:** 图表**单色**（bone 灰），只有「背部」那根用 ember 标记＝本周唯一要修的事；S1 指向它；其余收成数据条。
- **缺口 3 → 数据可视化要成文规则。** A3 只说了「禁彩虹」，没给正向规则。新增「单色数据 + 唯一 ember 标记结论点」（D4）。
- **成立:** 「判断先于数据」在数据最多的页反而最关键——它把图表墙压成「一个结论 + 一处证据」。

### D3. 计划 (Plan) — 压测「Emberline 路径」

- **用途:** 周 / 周期视图，看安排与进度。
- **hero:** **路径本身**（本周训练路线），既非判断块也非大数字。
- **签名应用:** S1 进入**路径模式**——一条贯穿全屏的 ember 路线，从已完成穿到「今天 / 下一次」；节点＝各次训练（已完成实心暗、今天 ember、未来空心）；S2 刻线轨承载节点。
- **缺口 4 → Emberline 有两种模态。** 「指针」（Today / 训练中：短，指一个下一步）与「路径」（计划：贯穿，标一条进程）。两者都守「唯一 + 只表示下一步 / 进程」。
- **成立:** 路径模式没破坏唯一性——全屏仍只有一条 ember。

### D4. 签名库 v0.2（把四个缺口固化成规则）

**新增 · hero 原型 (Hero archetype)** ——「每屏一个 hero」细化为三选一：

| 原型 | 用于 | hero 元素 |
|---|---|---|
| 判断型 (verdict-led) | Today / 复盘 | S4 判断块 |
| 仪表型 (instrument-led) | 训练中 / 单指标详情 | S3 主读数 |
| 路径型 (path-led) | 计划 / 周期 | S1 路径 + S2 轨 |

规则：每屏**只能选一种** hero 原型；选了就把其余一律降级。

**S1 升级 · Emberline 双模态**
- **指针模 (pointer):** 短，从判断 / 读数指向一个「下一步」。用于 Today、训练中。
- **路径模 (path):** 贯穿，沿 S2 轨标「已完成 → 下一步」的进程。用于计划、周期。
- 不变：每屏唯一；只表示下一步 / 进程；不装饰。

**S2 升级 · 进度轨 (Progression rail)**
刻线从「分隔 / 刻度」扩展出第三用途：承载序列节点（组 / 训练 / 周），与 Emberline 路径模合用。节点态：已完成（实心暗）/ 当前（ember）/ 未来（空心）。

**新增规则 · 单色数据 (Monochrome data)** —— 补进 A3：
- 图表 / 趋势一律**单色**（bone / graphite 梯度），禁分类彩色。
- 每图**至多一个 ember 标记**，标「唯一要看的那个点 / 那根柱」。ember 标记 ＝ 该图的结论，呼应 S1。
- 无奖励式增长动效；趋势只做值平移。

### D5. 遗留问题（留给你拍板）

1. 专注态（训练中）是否**完全隐藏 Tab**？倾向是，但导航取舍需你确认。
2. 路径模 ember 是否允许**单段 90° 折线**跨越非相邻节点？建议否，保持直读。
3. 多图页的「唯一 ember 标记」怎么办？建议：一屏一个总结论 ember，各图内不再各自标，避免口音泛滥。

---

**Part D 小结:** 签名库主干（S1–S5）经三页压测成立；补强为 **v0.2** ＝ hero 三原型 + Emberline 双模 + 进度轨 + 单色数据规则。把这四条加进 `signature.json` 与 `verify-craft`，签名库即「验全」。

---

## Part E — 海报 ≠ App：落到真实密度 (Poster vs Shippable)

> 反思：前面的工艺图视觉对，但**太像海报**。把成因与修正固化下来，否则品质层会被做成「好看但不像 App」。本会话已重渲染 Today / 训练中 的真实 App 版作基准。

### E1. 为什么会变成「海报」

- **过度留白:** 一屏一个焦点 + 大片空——海报语法，不是 App 密度。
- **签名当装饰:** Emberline / 大数字 / 刻线被当 graphic 摆，不兼作功能件。
- **缺 App 骨架:** 删了状态栏、导航头、周选择、可点控件、可滚动列表、Tab 栏。
- **排版戏剧化:** letterspaced 大写 overline、超大 display 数字——editorial，不是 utility。
- **一屏只一个功能区:** 海报只需一个信息；App 屏要把一件事做完，多区协作。

### E2. 真实密度规则（补进 A2 构图法则，续 9–13）

9. **App 骨架必备。** 每屏含：状态栏、导航头（标题 + 真实控件）、可滚动内容、真实 Tab / 底栏。专注态（训练中）可隐 Tab，但保留 header 控件（如暂停、Skip）。
10. **签名兼作功能件。** Emberline ＝ 主操作 / 当前项的功能标记（按钮左缘、当前组 tick、当前日高亮），不是独立装饰条；仪表数字活在真实控件里（步进器、set 表）；刻线 ＝ 真实分隔 / 进度，不是纹样。
11. **真实可点性。** 控件长得能点：filled 按钮、步进器（−/＋）、chevron 行、勾选、Skip；**不是一行文字假装按钮**。
12. **有层级地密。** 列表给足行（可滚动）、信息够用；hero 仍唯一，但其余是「功能性降级」，不是「删到只剩一句」。**减法是去冗余，不是去功能。**
13. **utility 排版。** 用接近 iOS Text Style 的字阶；大写仅极小范围（优先 sentence-case section label）；display 数字只给真正的主读数。

### E3. anti-pattern 补一条（接 A3）

| 错（AI 或矫枉过正） | 为什么 | 改法 |
|---|---|---|
| 海报味：一句话 + 大留白 + 装饰性签名 | 好看但不像 App、不能用 | 真实密度 + 签名兼作功能件 + 完整 App 骨架 |

> 注意两个失败方向是**对称的**：一端是 AI 默认的「组件堆叠」（密但无重心），另一端是过度克制的「海报」（有重心但不像 App）。品质层要落在中间——**有重心地密**。

### E4. 校验补充（verify-craft 增项）

- 关键页必须含：nav header、可滚动列表（≥ 设定行数）、真实控件、Tab 或等价导航（专注态豁免）。
- 每个签名实例必须**绑定功能**（主操作 / 当前项 / 分隔 / 进度）；纯装饰实例报警。

**Part E 小结:** 品质层不变——变的是「在哪用」。海报版证明 DNA 对，App 版证明 DNA 在真实密度下也成立。两版都留作基准：**看气质对照海报版，看落地对照 App 版。**

---

## Part F — 字阶与醒目度 (Type Scale & Prominence)

> 两条新反馈：① 休息计时必须够醒目；② 字号不能统一，要有字阶对比才有高级感。两者同源——都是**字阶 / 层级**问题。本会话已重渲染休息态 + 字阶参考卡。

### F1. Rede 模块化字阶 (Type ramp)

| tier | px | 用途 | 字重 | mono |
|---|---|---|---|---|
| display | 56–60 | 休息计时、关键大读数 | 700 | ✓ |
| title | 28 | 主数值（重量 / PR） | 700 | ✓ |
| headline | 20 | 屏标题（Today） | 600 | |
| subhead | 17 | 卡片标题（Push A） | 600 | |
| body | 15 | 主行文本（动作名、判断句） | 400 | |
| callout | 13 | 次级数值（set 数据） | 400 | ✓（数字） |
| caption | 12 | 元信息、子标签 | 400 | |
| overline | 11 | 字段 / 区块标签 | 500 | （仅此档可 letterspacing） |

规则：相邻档对比 ≥ ~1.3×；每屏用 3–4 档 + **一个 display / title 时刻**；数字档 tabular mono；正文档位以 400 / 500 为主，hero / 铭牌 / 仪表数字按 Part J·K 升至 **600 / 700**（与 `ios/Rede/RedeTheme` 实现一致：regular/medium/semibold/bold）；**禁止全屏统一字号**。各档映射 iOS Text Style 以继承 Dynamic Type（至 AX5）。

→ 这套进 `foundation/type.json`（决策 C1 的共享 foundation；Larder 已有同构 8 级字阶，Rede 对齐——**比例共享、字族各自**）。

### F2. 高级感来自字阶对比（补进 A2，续 14）

14. **有层级地变字号。** 高级感来自档位差，不是更多装饰。一屏必须有明显的「大-中-小」≥ 3 级；全屏 13–14px 平铺 ＝ 廉价感。**最大的元素 ＝ 这屏此刻的 hero。**

### F3. 醒目度 ＝ 状态化 hero（补进 D4 hero 原型）

- **hero 随「屏状态」切，不只随「屏类型」。** 训练中有两态：
  - **记录态 (logging):** hero ＝ set 步进器（输入焦点）。
  - **休息态 (resting):** hero ＝ **休息计时**，display 档大号、留白抬升、单色消耗条；ember 落「开始下一组」；计时**一眼可读（隔几米能看清）**。
- 规则：任一时刻仍只有一个 hero；状态切换时 hero 随之切换、另一方降级。休息计时在休息态**绝不**降成页脚小行（前一版的错，本版已纠正）。

### F4. 校验补充（verify-craft 增项）

- 单屏字号种类 < 3 → warn（平铺 / 无层级）。
- 休息态计时必须 display 档；非 display → fail。

**Part F 小结:** 字阶定死 + hero 随状态走，「醒目」与「高级感」就都靠层级、不靠堆装饰。

---

## Part G — 训练中交互：单 hero 块原地状态转换 (Set ⇄ Rest)

> 已拍板：训练中用**一个固定位置的大 hero 块**，在两态间原地转换，不另起组件。这是 F3「状态化 hero」的落地形态，定为 Rede 训练中的 canonical 交互。本会话已渲染两态对照。

**状态机:**
```
执行态 (Set) ──点「完成这组」──▶ 休息态 (Rest) ──归零 / 点「下一组」──▶ 执行态 (Set, n+1)
  显示 重量·组数·RIR                 显示 display 级倒计时               显示 set n+1 的 重量·组数·RIR
  主操作:完成这组                     控制:+30s / 下一组(Skip)            循环
```

**同一块、两套内容（位置与尺寸恒定）:**
- **执行态:** 三值仪表簇——WEIGHT（最大，display/title 档）/ REPS / RIR；主操作「完成这组」(ember)。三值可点改为**实际值**（做少了就改 reps）。
- **休息态:** display 级倒计时（F1 display 档）+ 单色消耗刻度条；ember 落「下一组」；辅助「+30s」。

**规则:**
1. 块的**位置与尺寸在两态间不变**，只换内容 + 切换 ember 落点（执行态 ember 在「完成这组」；休息态 ember 在「下一组」）。全屏仍只有一处 ember 口音。
2. 转换是**原地 morph**（交叉淡入 + 数字过渡 200–250ms ease-out），不是跳新页 / 新组件；Reduce Motion 即时切换。
3. 任一时刻只有一个 hero（就是这块）；header / 进度条 / set 表始终在，作密度与上下文，但不抢焦点。
4. 休息归零**自动推进**到下一组执行态（可在设置关）；点「下一组」立即推进。
5. 一组的闭环 ＝「看值 → 做 → 完成 → 休息 → 下一组」，**全程不离开这块**。

**为什么好:** 单一焦点 + 恒定位置 ＝ 训练中最低认知负荷；一眼知道「现在该干嘛 / 还剩多久」；呼应品牌「训练中只带用户完成下一组」。它也把 S3（仪表数字）、S4（判断 / 单焦点）、F1（字阶）、F3（状态化 hero）收在一个组件里——是整套品质层最集中的一次兑现。

**给 Claude Code 的实现点:** 一个 `ActiveSetHero` 组件，内部 `state: .set | .rest`；两态共用容器（固定 frame），内容用 `.transition(.opacity.combined(with:.scale(0.98)))` 原地切换；倒计时归零触发 `advance()`；ember accent 由 state 决定落点。set 表与 header 在外层，不随之重建。

---

## Part H — 状态化大块跨屏适配 (State-Hero Across Screens)

> 用 Part G 的「状态化大块」过一遍 Today / 复盘 / 计划。**结论先行：不是每屏都该套。** 有「单焦点任务 + 真实状态切换」的屏才用；多项 / 概览屏硬套就回到「为统一而统一」。本会话已渲染 Today 四态。

### H1. 适配判断表

| 屏 | 状态轴 | 驱动 | 适配 | 形态 |
|---|---|---|---|---|
| 训练中 | 时间（Set ⇄ Rest） | 自动推进 | ★★★ 强（原型） | 单块原地 morph，循环 |
| Today | 当日训练周期（Ready→进行中→完成→休息日） | 上下文 / 自动 | ★★★ 强 | 「现在该做什么」块随日推进 morph；休息日无 ember |
| 复盘 | 时间尺度（Session / Week / Cycle） | 用户选（分段控件） | ★★ 中 | 一个判断 hero 随尺度**重读**，唯一 ember 标记跟着换 |
| 计划 | （无单一状态；本质是路径 / 多项） | — | ★ 弱 / 部分 | 路径**不** morph；在路径里**内嵌**一个 Today 式「下一次」状态块 |

### H2. 各屏怎么落

- **Today（强）:** hero 块 ＝「现在该做什么」。四态：Ready（判断 + 开始）/ 进行中（set x/n + 继续）/ 完成（今日 recap + 下一次预告）/ 休息日（无 ember）。位置恒定，内容与 ember 落点随状态。**休息日没有「下一步」就不点 ember**——签名守纪律的范例。
- **复盘（中）:** 顶部分段控件 `Session / Week / Cycle` ＝ 状态；一个判断 hero 随尺度**重读**（`This week: back lagging` → `This cycle: +5% e1RM, deload due`），单色图 + 唯一 ember 标记跟着尺度换。注意：这是**用户驱动**的 state（切分段控件），不是自动推进——morph 用**即时切换**，不做循环、不做计时式过渡。
  - **已渲染确认（三态）。** 落定的细节：① 图**类型**随尺度换——Session 按动作柱 / Week 按肌群柱 / Cycle 趋势线；② 每尺度只一个 ember 标记 ＝ 该尺度的结论（Session 点 PR / Week 点缺口 / Cycle 点 deload），判断句**指名**它；③ 判断 hero 靠**字号**突出（headline 19/500），不靠 ember，守 F2。
  - **「一处 ember 口音」细化（补进 A2 rule 7）:** 分段控件选中态用**色调填充（raised tone），不点 ember**——ember 留给内容区那一处洞察。持久导航 chrome（底栏 active tab）可带**极小** ember 作系统级指示；即「**内容区一处 ember ＝ 洞察；chrome 的 active 态是另一层，最小化**」。
- **计划（弱）:** 路径是 path-led hero，是稳定的**概览**，不该原地 morph（它是多项导航，morph 会破坏全局可读）。正确用法：把路径上「今天 / 下一次」那个节点做成**内嵌的 Today 式状态块**（复用同一组件），其余节点是静态行。即「**块复用，屏不强套**」。

### H3. 总规则（补进 D4 hero 原型）

- **状态化大块只用于「单焦点任务 + 真实状态」的屏。** 判据：这屏当下有没有一个「此刻最该看 / 最该做」的单一焦点，且它会随**时间**或**用户选择**切换？有 → 用；是多项并列 / 概览 → 别套。
- **三种 morph 触发要分清:** 自动推进（训练中、Today）用带过渡的 morph；用户切换（复盘尺度）用即时切换；导航选择（计划选节点）是 master-detail，不是 morph。
- **组件复用:** 训练中 / Today / 计划内嵌 都归一个组件家族 **`StateHero`**（`ActiveSetHero`、`TodayHero` 共享「固定 frame + 状态内容 + ember 随态」机制），减少分裂，接 C6 组件清单。

**Part H 小结:** 状态化大块是个**有边界的强模式**——Today 强、复盘中、计划部分。关键是守「单焦点 + 真实状态」判据，别为套而套；该静的概览屏（计划）就让它静，只复用块、不强套屏。

---

## Part I — 简约 ≠ 简陋：材质与精修层 (Refinement / Materiality)

> 最难也最关键的一层：克制要「贵」，不能「空」。**简陋 ＝ 死空白 + 扁平方块 + 无微工艺；简约 ＝ 活空白 + 材质深度 + 每元素精修。** 元素一样少，差在**每处的工艺密度**与**空白的张力**。这层在 token 之下、签名之上，前面缺了。本会话已渲染 before/after。

### I1. 材质 (Materiality) — 让「锻铁面」在屏上成立，不只在文档里

- **锻面颗粒:** 极细噪点 / 网格纹（透明度 ~2%），给深色面实体感、不是平涂。仪表 hairline 基线网格可同时承担「颗粒」与「仪表」双重含义。
- **顶缘高光:** raised 面顶边 1px 暖白高光（~10–14% alpha）、底边极暗——模拟光打在锻铁棱上，给厚度。
- **色调深度:** 用 ≥ 3 档极近的暖灰叠层（base / raised / raised-edge），靠 tonal 不靠阴影；一屏仍 ≤ 3 层。

### I2. 仪表精修 (Instrument detail) — 把「工具感」做实

- **角标 registration:** hero / 卡片四角小 L 标（取景框 / 蓝图），把空白角落用「校准」意义填上，不是装饰。
- **精密刻度尺:** 进度 / 消耗用主-次刻度的标尺（major 每 N、minor 间隔），已耗段 chalk 提亮、剩余 dim，端点 ember caret 标「现在」；比一条实心条贵得多。
- **数字基线:** 主数字下加一条带中心刻的 hairline 基线，数字「坐」在仪表线上、不飘。
- **端点校准标:** 标尺两端给 calibration 标（0:00 / 3:00），仪表语义。

### I3. 活的负空间 (Active negative space) — 空白要被「框」，不是剩下

- **基线网格 + 比例边距:** 元素吸附 4 / 8pt 基线；边距走比例关系（非随手留）。空白是「裱框的留白」，有比例有张力。
- **取景 / 框定:** 用 registration、hairline、对齐线把主元素**框**出来——让人感到「这是被安排的空」，不是「没东西」。
- **光学对齐:** 数字右对齐成列、视觉居中而非几何居中、内圆角 ≤ 外圆角。

### I4. 存在感 (Presence) — 别薄

- 富黑（暖近黑、非纯黑）+ 够宽的明度跨度；hero 有重量（字重 / 尺寸 / 留白三者给足）；accent 精确如镶嵌——**ember 是 inlay，不是涂色**。
- **chalk（冷一档的近白）作细标记**——校准标、次级刻度。与 bone（暖白）分工：bone 给内容，chalk 给仪表细节。

### I5. anti-pattern 补一条（接 A3）

| 简陋（空） | 为什么 | 简约（精修） |
|---|---|---|
| 扁平深框 + 大数字飘在空里 | 薄、廉价、像没做完 | 锻面颗粒 + 顶缘高光 + 数字坐基线 + 精密刻度 + 框定的留白 |

### I6. token 与 verify

- material 参数进 `brand/ironpath/material.json`：`grain.opacity` · `edgeHighlight.alpha` · `registration.size` · `scale.major/minor` · `chalk` 色。
- verify 增项：hero / 关键卡须含 ≥ 1 项材质（grain / edge / registration）+ ≥ 1 项精修（基线 / 刻度）；纯扁平深框无任何精修 → warn「简陋」。

**Part I 小结:** 简约是「少而精」，不是「少」。三种失败现在夹齐了：**组件堆叠**（密而无重心，A/D）、**海报**（空而缺骨架，E）、**简陋**（空而缺工艺，I）。目标 ＝ 有重心（D）+ 真实密度（E）+ 精修材质（I）。

---

## Part J — 与 canonical 设计语言对齐：修正清单 (Reconciliation)

> **2026-06-08 通读全部设计文档后的修正。** 视觉 canonical 真源 ＝ `docs/REDE_PRODUCT_DESIGN_LANGUAGE.md`（含 IA、色板、组件、页面语言、验收 10 条）。A–I 的方法/品质层仍有效，但其中**占位值与即兴决定凡与 canonical 冲突，以下为准**。我之前未通读文档、自造了部分参数——已纠正，预览已按修正重做。

### J1. 导航修正（关键）
- ❌ 之前：5 tab（Today / Plan / Train / Stats / You）——正是 design language §9 v0-prompt（及 §0.1 / §8 的 command center / dashboard 禁区）明令禁止的「五 tab / command center」。
- ✅ canonical：**底部恰好 4 tab：Today / Train / Progress / Plan**。Settings / Profile 是**右上角低频入口，非 tab**；Coach 也不是 tab。

### J2. 色板修正（停用自造值）
| 角色 | 值 |
|---|---|
| Graphite 900 / 800（深色底 / surface） | `#111312` / `#1B1E20` |
| Steel 600 / 300（次级文字·边框 / 浅边界） | `#66707A` / `#C8CDD2` |
| Chalk 50 / Paper 0（浅色底 / 浅 surface） | `#F6F7F5` / `#FFFFFF` |
| Ember 500 / 300（品牌·主操作·当前组 / 轻强调） | `#E85D2A` / `#F28A5C` |
| Recovery / Caution / Risk / Trust（语义，仅判断需要时） | `#2F7D5B` / `#B7791F` / `#C2413A` / `#3267B7` |

- ⚠ **此「作废」已被 J8 / Part K 反转**：`#15130F` / `#E1652B`（暖）是 owner 最终 locked 值（见 §11 / Part K），**不作废**；当时改用 `#111312` / `#E85D2A` 的判断后被 owner 视觉决定推翻。**Rede 有失败红（Risk #C2413A）**——「无失败红」是 Larder 的规、不适用 Rede（此句仍有效）。
- 色彩比例：中性 70–85% / 文字·结构线 10–20% / **Ember 3–8%** / 语义色仅判断时。「像黑橙主题」就偏了。

### J3. 形状·字体修正
- **圆角 8pt**（卡片 / 按钮 / icon button）；pill = capsule。停用大圆角。
- **letter-spacing 0**：禁负字距、禁装饰性大写 overline（之前 letterspaced caps 作废）；层级靠字号 / 字重 / 颜色 + **sentence case**。
- 数字：**系统 sans（SF Pro）+ tabular-nums**，非等宽代码体（之前 mono 作废）。
- 字重：关键数字 700 / 标题 650–700 / 卡片标题 600 / 正文 400–500 / 标签 500。不整屏粗体。

### J4. 必用的命名组件（之前漏用）
- **Load Plate**：重量数字容器，中心一个关键数 + ≤2 辅助信号 + 一行理由（`185 lb / Bench press / 3×5 RIR 2 / Hold today.`）。非多环仪表。
- **Decision Receipt**（差异化）：`Call / Signal / Change / Control`，默认收起、按需展开。不是日志、不写算法名、不是聊天气泡。
- **Progress Rail**：上次 → 今天 → 下次，强调「变化原因」非堆指标。
- **Steel Cards**：一卡一判断；**同屏 ≥5 张同权重卡 = IA 错**。

### J5. 「简陋」的真正解
docs 主张**克制**，但克制 ≠ 空。信息完整靠两条，不靠平铺多卡 / 多图：① **组件内部丰富**（一张 Steel Card 内即有 Load Plate + 2 信号 + 理由行 + Receipt）；② **渐进披露**（Call 先行，Receipt 默认收起、按需展开；肌群完整元数据进详情页）。之前「简陋」＝既抽走真实组件、又留死空白——**把真实组件 + 真实文案放回去，屏自然满且不堆。**

### J6. 之前漏掉的内容
- **肌群发展等级系统**：`Lv.1–20` + 整体级别（校准中 / 初级 / 进阶初期 / 中级 / 高级 / 精英）+ 置信度 + 均衡度（`背部 Lv.8 · 正在补足`、`整体均衡度 76`、`本月背部 Lv.8→Lv.9`）。是 Progress 的核心填充。
- **明暗：已定（owner，2026-06-08）＝保持 dark 为主视觉。** design language §3.3 原文是「日常 UI 浅色为一等公民、Progress/Plan 不强行黑底、dark 用于品牌张力」——本决定是对该节的**有意偏离**：dark 升为日常 UI 主模式。✅ 已回写 canonical `REDE_PRODUCT_DESIGN_LANGUAGE.md §3.3 + §11`（2026-06-08）。token 双模备好，浅色作次级 theme 随时可加。
- **诚实校准态**：新用户「正在校准肌群等级」持续 2–4 次，不假装自信判断（onboarding 已改）。
- **Paywall**：卖「判断依据」非「更多图表」；**不写具体价格**（交 App Store）；禁「解锁全部潜能」类。
- **文案四锚点**：判断 / 带练 / 证据 / 控制权；sentence case、动词开头、结论先行；禁 AI / 营销 / 医疗 / 保证 / 羞辱 / 隐私绝对化。

### J7. 验收（直接采用 design language §10）
5 秒看懂今天练不练 · 4 tab 正确 · 首屏有明确下一步非指标堆 · 无 AI/机器人/蓝紫渐变 · Ember 只作路径·当前动作 · Train 能直接完成当前组 · Progress 证明效果但不像后台 · Plan 有调整原因+撤销 · Settings 不在底部 tab · 文案像 COPY_BASELINE。

### J8. 视觉方向决定（owner，2026-06-08）

owner 审完两版后**选定视觉 ＝ Parts A–I 的「暖锻铁 + 仪表」品质层皮**，不是 design language 字面值：
- 暖底 `#15130F` 系 + 暖 Ember `#E1652B`（vs 文档 `#111312` / `#E85D2A`，差异小，可后续微调对齐）。
- **letterspaced 大写仪表标签**（仅 overline / 小标签；正文与判断句仍 sentence case + 真实文案）——vs 文档 letter-spacing 0。
- 卡片圆角 ~12px + 顶缘高光 + 角标 registration（Part I 材质）——vs 文档 8pt。
- mono tabular 数字（仪表感）——vs 文档 sans tabular。

**分工定死：皮按品质层（A–I），骨架 / IA / 组件 / 文案按 canonical。** 语义色（Recovery / Caution / Risk / Trust）仍按文档在判断时出现。
✅ 已回写 canonical §11（2026-06-08）：locked tokens（base `#15130F` / Ember `#E1652B` …）+ 仪表标签 letterspacing 例外 + 卡片 12px，均登记在案。

**Part J 小结:** 方法层（品质层、状态化 hero、材质精修）成立；结构层对齐文档（4 tab、命名组件、肌群等级、真实文案）；视觉层 owner 选定品质层暖皮。三层分工：**结构=canonical，视觉=Parts A–I 暖皮，冲突项已回写 canonical §11（2026-06-08，无遗留文档欠债）。**

---

## Part K — 像素基准 Today + Locked Tokens (2026-06-08)

> **Today 像素终稿 ＝ 其余屏对齐基准。** 以下值已锁定并回写 canonical §11；真机最后只微调颗粒 / 高光 1–2%。

### K1. Locked tokens
| 角色 | 值 |
|---|---|
| Base / Surface / Hairline | `#15130F` / `#1F1C17` / `#2A261F` |
| Text 主 / 次 / 三 | `#ECE6D8` / `#C9C2B4` / `#9C9484` |
| Ember 500 / 300 | `#E1652B` / `#F0875A` |
| Recovery / Caution / Risk / Trust（判断时） | `#2F7D5B` / `#C79A3A` / `#C2413A` / `#3267B7` |

### K2. 字阶·形状·材质·间距
- **字阶：** 关键数字 700（**SF Pro + tabular-nums**；渲染中的 `mono` 仅 widget 近似，最终**不引入等宽代码体**，遵 design §4.1/§11.3、避 §4.1 装饰字体红线——本条覆盖 A–J 中所有「mono 数字」表述）· 屏标题 23/600 · 卡片标题 16/600 · 正文 14/400–500 · 仪表标签 11 caps ls2.2 tertiary · caption 12。
- **形状：** 卡片圆角 12 · 按钮 10 · chip = capsule。
- **材质：** 锻面颗粒 ~1.5% · 顶缘高光 `rgba(236,230,216,0.08)` · 四角 registration L 12px / stroke `#5F594C` 1px（hero / 关键卡）。
- **间距：** 页边距 18 · 卡片内边 14 · 8pt 节奏。

### K3. Today 件清单（其余屏照搬）
锻面 + 顶缘高光卡 · **Decision Receipt**（Ready 点 + Call + Signal/Change + Apply/Hold/Swap + Why⌄）· 会话卡含 **Load Plate**（右上 `185 lb · NEXT`）· Start training（ember）· **Progress Rail**（last→today→next + 置信度）· 4-tab 底栏。

**Part K 小结:** Today 锁定 → 其余屏按 K1–K3 对齐即一致。下一步可起 **Phase 1**：K1 写成 `foundation` + `material.json`，把 Decision Receipt / Load Plate / Progress Rail / StateHero 写成组件交 Claude Code。

