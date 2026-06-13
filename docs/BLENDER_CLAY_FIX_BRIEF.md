# Larder Clay 返修 Brief v2 — 交 Claude Code 改 `build_fix.py`

> 2026-06-04 · 基于实渲 12 张 PNG 终检 + 通读 `assets/clay/build_all.py` 与 `build_fix.py`。
> 终检结论:**7 过、5 待修 + 1 全局地台**。已过关 7 个的**几何不改**;但地台是全局修复,需随全量复跑一起重渲(几何不变、只是地台变好)。注:`banana`/`avocado` 的好版本目前只在 `build_fix.py`,`build_all.py` 里仍是差版本——见 §3。

---

## 0. 先修两个脚本级根因(最重要,否则白改)

**根因 A — `build_fix.py` 的 `FIXES` 只注册了 banana。**
文件顶部注释写着"v2 targeted fixes for: banana, avocado, salmon, spinach, chicken",而且 `b_salmon / b_spinach / b_chicken / b_avocado` 的 v2 都写好了,但:
```
FIXES = [ ("banana", b_banana, (1.15, 0.45)) ]   # ← 只有 banana 被调用
```
所以这一轮**根本没重渲 chicken/salmon/spinach**——它们当前 PNG 还是 `build_all.py` 的 v1。返修第一步:把全部待修项注册进 `FIXES` 并各配 shadow 参数。

**根因 B — 地台灰方块 = `add_contact_shadow()` 的假阴影 plane 有缺陷。**
它建了一个 `size=3.0` 的**方形** plane,材质用球形渐变控制 Alpha:`ColorRamp` element[0]=黑@0、element[1]=**(0.6,0.6,0.6)@1**,接到 Alpha。结果是**中心透明、外缘 Alpha 0.6 灰**——正好反了,渲出一圈可见的半透明灰方块边(就是终检看到的"硬边地台")。而且这个 plane 有不透明暖棕 Base Color、会被灯照亮。
**改法(首选):换成 Cycles 原生 shadow catcher**——plane 设 `ob.is_shadow_catcher = True`(Blender 4.x:`ob.is_shadow_catcher`;旧版 `ob.cycles.is_shadow_catcher=True`),去掉自发光材质;它只在物体落影处显示柔暗、其余全透明,无方块、无硬边。
**退一步(若不用 shadow catcher):** plane 改圆形、缩到刚好兜住物体、Alpha 渐变**反向**(中心实 → 外缘 0 透明),并把外缘色降到 0。

---

## 1. 逐个食材返修规范(只改这 5 个 builder)

### chicken 生鸡胸 — P0(最严重,且是 ED 友好关键项)
- **现状**:`build_all` 版 `scale (1.28,0.95,0.6)` 太扁,像橙色肥皂砖;渲面疑似法线翻转露出**白色破洞**。
- **目标**:圆润饱满的肾形肉块,表面光滑无破面,顶面一道**极浅**中缝。
- **手法**:用 `build_fix` 已有的 v2 `b_chicken`(`scale 1.25,0.95,0.72` + 中缝)为基,并:① 厚度再加到 `z≈0.78` 更饱满;② **建模后强制重算法线朝外**(`bpy.ops.mesh.normals_make_consistent(inside=False)` 于 edit mode,或 bmesh `recalc_face_normals`)杜绝白洞;③ 中缝深度再减半,避免"裂开"感。

### salmon 三文鱼 — P0
- **现状**:白纹是**立在顶面的竖直薄片**(`stripe` cubes,scale≈0.05,0.5,0.03),像插片/缝,完全不像鱼肉。
- **目标**:一块鱼排 + **横向、略弯的浅色脂肪纹**(垂直于楔形长轴、贴合表面)。
- **手法(首选,无插片)**:删掉 stripe cubes,改用**程序化纹理**——第二组浅色 `#f9e6da` 通过 `ShaderNodeTexWave`(bands、沿鱼排长轴 X 方向、3–4 条)`Mix` 进 Base Color,带轻微扭曲模拟弧形花纹。这样花纹是表面的,不是几何。
- **备选(几何)**:浅色横条沿 **Y 方向横跨**鱼排、沿 X 排 3–4 道,极薄地**贴伏表面**(不是立起),并随鱼排弧面略弯。

### spinach 菠菜 — P1
- **现状**:`build_fix` v2 把叶 taper 加到 0.85 → **更尖更硬**,像多肉/菠萝顶,方向错了。
- **目标**:圆润宽叶簇,叶端**圆钝**、略皱、深绿,多片低伏成簇。
- **手法**:叶片加宽(`scale.x` 0.36→~0.5),**去掉 pointed taper**(taper 指数降到 ~1.2 且保留叶端宽度,不收成尖),片数 6–8 绕一圈,整体压低外翻(`rotation.x` 加大让叶下伏),叶面加 `Displace`+`Noise` 轻皱。

### almond 杏仁 — P1
- **现状**:`scale z=0.32` 太厚 + 中缝太深 → 像带裂缝的小桃子。
- **目标**:扁平水滴尖形,一端尖一端圆,薄。
- **手法**:`z` 压到 ~0.20;加大尖端 taper;**中缝去掉或压到极浅**(现在的 crease 让它像裂开)。

### yogurt 酸奶 — P1
- **现状**:dome(40 段)与 cup cone(48 段)边缘不对齐 → **杯口锯齿**;顶部 `peak` 小锥太小,**酸奶卷看不到**。
- **目标**:干净杯口 + 顶部明显**螺旋酸奶卷**(soft-serve swirl)。
- **手法**:① 去锯齿——dome 略大于杯口外径盖住接缝,或加一圈细环遮缝,并让 dome 段数匹配 cone;② 酸奶卷——用**螺旋曲线**(`bezier`/`nurbs` 螺旋 2–3 圈、半径向上收)+ `bevel_depth` 转 mesh,替换现在的小 peak,做出明显旋出的奶卷尖。

---

## 2. 验收(每个比对,不达标不入库)
- 暖哑、无镜面高光、左上主光向**与已过关 7 个一致**。
- chicken 无破面/白洞;salmon 像鱼排横纹而非插片;spinach 像菠菜而非多肉;almond 像杏仁而非桃;yogurt 杯口干净 + 有明显奶卷。
- **地台**:所有图底部只剩柔和透明落影,**无灰方块、无硬边**。
- 12 张并排(`_contact_sheet.png`)风格统一。

## 3. 复跑约束(全量,因地台是全局修复)
统一落到 `build_all.py` 一个脚本,**headless 全量复跑 12 张**——只重渲 5 个会留下其余图的灰方块。
- **先同步好版本**:把 `build_all.py` 里的 `b_banana`、`b_avocado` 换成 `build_fix.py` 的 v2(好版本只在 build_fix,不同步全量跑会让这俩退回差版本)。
- 修 `add_contact_shadow` → **Cycles shadow catcher**(`plane.is_shadow_catcher=True` + 去自发光材质),全 12 张地台统一。
- 重做 5 个 builder:`chicken/salmon/spinach/almond/yogurt`(见 §1)。
- **不改**:其余 5 个(`tomato/egg/oats/rice/broccoli`)几何 + 母场景(相机/灯光/材质/色彩管理/1024²透明/Standard)。
- 复跑 `blender --background --python build_all.py`,覆盖 12 张 + 刷新 `_contact_sheet.png`。

---

### 给 Claude Code 的启动 prompt(可直接粘)
```
返修并最终化 Larder clay 食材图标(12 个)。先读规范:
/Users/xuhaochen/Developer/Rede/docs/BLENDER_CLAY_FIX_BRIEF.md
目录:/Users/xuhaochen/Developer/Rede/assets/clay/
把所有修复统一落到 build_all.py 并 headless 全量复跑 12 张(地台是全局问题,
只重渲 5 个会留下其余图的灰方块)。

先修三个坑:
1. 同步好版本:build_all.py 里 banana、avocado 换成 build_fix.py 的 v2
   (好版本只在 build_fix,不同步全量跑会让这俩退回差版本)。
2. 地台:add_contact_shadow() 方形 plane + Alpha 球形渐变方向反了(外缘 0.6 灰、
   中心透明)→ 灰方块。改 Cycles shadow catcher(plane.is_shadow_catcher=True、
   去自发光材质,只留柔和透明落影)。
3. 重做 5 个 builder(细节见 brief §1):
   - chicken:圆润肾形、加厚 z≈0.78、建模后 normals_make_consistent(inside=False)
     杜绝白洞、中缝极浅。
   - salmon:删竖直白插片,改程序化 Wave 纹理沿长轴做 3–4 道横向略弯浅色脂肪纹。
   - spinach:叶端圆钝去尖、加宽、6–8 片低伏成簇 + Noise 轻皱。
   - almond:压扁 z≈0.20、尖端更尖、去/极浅中缝。
   - yogurt:dome 盖住杯口接缝消锯齿;螺旋曲线+bevel 做明显 soft-serve 奶卷。

不改:其余 5 个(tomato/egg/oats/rice/broccoli)几何、母场景
(相机/灯光/材质/色彩管理/1024²透明/Standard)。

复跑:/Applications/Blender.app/Contents/MacOS/Blender --background --python build_all.py
(Blender 5.1.2;路径不对先定位可执行文件)。覆盖 12 张 ingredient.*.png +
刷新 _contact_sheet.png。跑完把 _contact_sheet.png 路径发我。
```
