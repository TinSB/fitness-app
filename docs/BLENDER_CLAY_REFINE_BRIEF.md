# Larder Clay 精致化 — 混合路线 Brief（程序化精修 + Rodin 有机体）

> 2026-06-04 · 路线:混合。简单体程序化精修打底,最难的有机体用 Rodin 高精度起形 + clay 统一化。
> 沿用上轮母场景 + **软椭圆暖落影**(若那轮地台修复未并入,先并入,无矩形)。

## 0. 分工(关键:别全上 Rodin)
| 组 | 食材 | 做法 |
|---|---|---|
| 程序化精修(打底,全 12) | 全部 | subdiv + bevel + 微起伏 + 准比例 + 真细节 |
| **Rodin 高精度起形(仅 3)** | **chicken / salmon / spinach** | Rodin 生成形 → clay 统一化,覆盖程序化版 |
| 程序化即可(不上 Rodin) | tomato / egg / oats / rice / banana / broccoli / avocado / yogurt / almond | 精修到位即可 |

真正靠 Rodin 救的是**肉 / 鱼 / 叶**(程序化天花板最低的);broccoli、avocado 程序化已不错,精修即可。

## 1. 程序化精修规范(全 12 打底 · 不依赖 Rodin · 现在就能跑)
- **Subdivision Surface**:render level 2–3,所有 mesh,置于修改器栈前部,杜绝低面棱角。
- **Bevel**:轮廓硬边小半径倒角(width ~0.01–0.02,segments 2),clay 圆润手作感。
- **表面微起伏**:`Displace + Noise/Clouds` 极弱(strength ~0.01–0.02),破塑料完美感;仅有机 / 果体,碗杯不加。
- **准比例**:逐个微调(番茄略高、蛋立卵、香蕉更弯…)。
- **真实细节(提精致的关键)**:
  - tomato:蒂改真实 **5 瓣尖星萼 + 短蒂柄**(替换现在的低面小块)。
  - oats:燕麦粒改**扁椭片**(非 ico 球),大小不一、叠放。
  - rice:米粒改**细长两头尖**(非方块)。
  - broccoli:花球加一层**更小的次级颗粒**(密簇感)。
  - 其余按真实形各补 1–2 处细节。

## 2. Rodin 起形 → clay 统一化(chicken / salmon / spinach)

### 2a. 生成(接入二选一)
- **A 推荐 · hyper3d.ai 网站**:手动文生 3D,下载 glb/obj 到 `assets/clay/rodin/`。**不动官方连接器、配置最少**。
- **B · 社区版 blender-mcp**:`uvx blender-mcp` + addon + 勾 Hyper3D + hyper3d.ai/fal.ai API key;可在 Claude Code 里直接调 Rodin。但要先拆官方连接器(一个 Blender 同时只连一个 MCP)。
- **Rodin prompt 模板**(每个生成 2–3 个挑最好):
  - chicken:`single raw chicken breast fillet, smooth rounded plump form, soft matte clay, no texture, plain studio`
  - salmon:`single salmon fillet, smooth rounded slab, one end thinner, soft matte clay, no scales`
  - spinach:`small cluster of fresh spinach leaves, soft rounded leaves, matte clay, simple`

### 2b. clay 统一化(Claude Code · glb 到位后)
1. 导入 glb → `Remesh(voxel)` 或 `Decimate` 降面至 ~5–20k + `Shade Smooth`(可加轻 subdiv)。
2. **删 Rodin 自带材质,套统一 `clay_mat`**(对应 base color / sss),丢高频写实,保哑光统一。
3. salmon 纹理仍用上轮**程序化 Wave 横纹**(贴新形态表面)。
4. `frame_objects` 摆进母场景框(占画面 ~70%)+ 同母场景渲染。
- 铁律:**只要 Rodin 的大形态,丢掉它的写实细节 / 材质**——否则与程序化体风格割裂。

## 3. 先切片(强制)
先只走 **chicken** 的 Rodin 全链(生成 → clay 化 → 渲染),放进 Kitchen 行 + 详情,看精致度够不够、和程序化体并排统不统一。**过了再铺 salmon / spinach**。一个挡住三个的返工。

## 4. 验收 + 复跑
- 精致度:有倒角、表面微起伏、形态准、细节到位,**与 DrawKit / UI8 档对齐**。
- 统一:Rodin 体与程序化体**同一套哑光 clay + 左上光**,并排无割裂。
- 地台:软椭圆暖影,无矩形。
- 全量复跑 12 + 刷新 `_contact_sheet.png`。

## 并行安排
- **现在就能跑**:§1 程序化精修全 12,不等 Rodin。
- **同时**:你去 hyper3d.ai 生成 chicken / salmon / spinach 的 glb。
- glb 到位 → Claude Code 做 §2 clay 化 → 覆盖那 3 个。

---
### Claude Code prompt(§1 程序化精修 · 现在就能跑)
```
精致化 Larder clay 图标的程序化部分(不依赖 Rodin,现在跑)。改 assets/clay/build_all.py,
按 /Users/xuhaochen/Developer/ironpath/docs/BLENDER_CLAY_REFINE_BRIEF.md §1:给全 12 个加
Subdivision Surface(render 2–3)+ 轮廓 Bevel 倒角 + 有机/果体加极弱 Displace+Noise 微起伏 +
修准比例 + 补真实细节(番茄真 5 瓣星萼、燕麦扁椭片、米粒细长两头尖、broccoli 次级颗粒等)。
母场景与软椭圆落影不改。headless 全量复跑 12 + 刷新 _contact_sheet.png 发我。
chicken/salmon/spinach 先出程序化精修版打底,稍后用 Rodin 覆盖。
```
