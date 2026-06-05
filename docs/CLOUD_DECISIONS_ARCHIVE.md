# 云端/账号/后端 已定决策归档(合并自 ~264 份 PWA 云规划)

> 这份是把 docs/ 里几十份 PWA 时代云/账号/后端/同步 TDD 文档(ACCOUNT_/API_/AUTH_/BACKEND_/CLOUD_/SUPABASE_/SESSION_/SYNC_/PHASE* 等)的**已拍板决策**合并成的单一记录。原始 264 份文档已删除(其完整副本在 outputs 备份 + git 历史)。**实现层 PWA 代码不再继承(重做用 CRDT 重写);继承的是下面的选型与契约。**

## 一、认证 / 账号
- **Provider = Supabase Auth**(首选;Clerk 备选;Auth.js/自建 不选)。与 Supabase Postgres + RLS 对齐。
- **账号 = late / 可选**:不强制注册、不挡练、不挡订阅。
- **订阅与账号解耦**:订阅走 App Store / Apple ID(App 内无需账户即可订阅)。账号只用于**同步 + 跨产品(IronPath↔饮食)联动**,当价值卖、不当门槛。
- **身份字段四元**:account id / owner user id / provider subject id / device id / local owner id 必须区分;账号**绝不从本地静默推断**,绑定需显式确认 + owner mismatch 检测。
- **生命周期**:注册/登录 adapter-first、显式触发、本机数据不自动上传;登出不删本地 emergency backup;删号 export-before-delete、区分账号删/云数据删/本地备份删、显式不可逆、绝不静默删本地。
- **合规**:Sign in with Apple + 应用内删号 + Apple 隐私标签。

## 二、后端
- **栈 = Supabase(Postgres + Auth + RLS)**;后端是独立 production API service(非 Vercel serverless / 非 devApiRunner)。
- **backend-boundary first**:前端不直接写云 AppData;客户端 typed、route-specific(每条 route 一个命名函数,拒绝通用 request(method,path);带 mutationId/idempotencyKey/sourceSnapshotHash)。
- **repository 形态**:document-style snapshot repo(readLatest / createBackupCandidate / validateBeforeWrite / writeCandidate),写前必 backup + 校验。
- ⚠️ **iOS 重做:栈留,PWA 实现丢**(为原生重建干净 sync)。

## 三、数据模型 + source of truth
- **云存 = document-first AppData 整树 snapshot(不拆表)**,概念表 `cloud_appdata_snapshots`,带 snapshotId/accountId/ownerUserId/sourceSnapshotHash/schemaVersion/createdAt/operationId/validationStatus。与 iOS 本机 open-bag AppData 整树天然契合。
- **本地永远 source of truth + fallback + migration source + emergency backup**;云 = 备份/多设备中继,**非替换**。cloud-primary 一路推迟、需另开闸。
- **account-scoped**:owner scope 四态(anonymous-local/device-local/backend-primary-candidate/cloud-account-candidate);owner mismatch fail-closed;anonymous-local 不自动上传。
- **ownership matrix**:云可拥有 = history/active session/templates/settings/screening;derived(DataHealth/analytics/e1RM)永不当 source;DataHealth repair/backup/reset over HTTP = blocked。
- **RLS**:owner_user_id = auth.uid() 才能读写;account_id 与 owner_user_id 一致;**service role key 绝不进客户端**;owner mismatch reject。

## 四、同步 + 冲突
- **显式 opt-in,绝不自动/后台/轮询。** V1 = 单用户多设备(非 coach/student、非社交、非多租户)。
- **演进 4 步**:read mirror → write shadow → explicit opt-in sync → cloud-primary(全 acceptance 闸后再议)。
- **offline-first**:不登录也能练;离线本地权威。(PWA 拒 offline mutation queue 是 snapshot 语境结论;CRDT 路线下离线合并是核心,需重设。)
- **幂等**:远程写有稳定 operationId + idempotencyKey;operation journal。
- **失败→本地模式**:云失败(unavailable/conflict/owner_mismatch/auth_invalid 等)一律保 localAppAvailable、localDataDeleted:false、可 rollback,绝不破坏本地。
- ⚠️ **iOS 重做拍板:冲突模型 = 全量 CRDT 自动合并**(取代 PWA 的"整树 snapshot + 手动冲突评审")。冲突场景清单可复用,合并实现换 CRDT。

## 五、饮食联动(IronPath ↔ 饮食)
- **账号 = 两产品共享身份桥**;跨产品联动需账号(用户想要饮食计划时自驱注册)。
- **联动 = 解耦只读**:IronPath → 饮食单向只读同步(目标/身材/训练消耗);饮食优先级 = 用户手动 > IronPath同步 > 默认;无 IronPath 饮食 App 完整可用。
- 饮食自身:营养全美标(USDA/Open Food Facts/FDA)、离线优先、健康/饮食敏感数据本地优先最小上云、严禁喂广告。
- 时序:先收尾迁移 + 等饮食文档 → 出两产品**统一架构**(免做两遍)。饮食文档已齐;**统一架构立项文档尚未写**。

## 六、重做拍板(2026-06-05,见 IRONPATH_REBUILD_00)
- **同步 = 方案 B 全量 CRDT**;**新增 watchOS**(训练中 Apple Watch 操控)→ 手表+手机并发编辑 active session 印证 CRDT。
- 连带:共享核心跨 iOS/watchOS、两传输(WatchConnectivity 近实时 + Supabase opt-in)、active session 一等并发对象、gated 写路径升级成 CRDT op 校验点。
- 待定子项:CRDT 选型(Automerge-swift?)、AppData 拆可合并记录的粒度、两传输编排、CRDT 下 schema 演进、两产品统一架构。

## 七、开放/未决
- CRDT 与"整树 snapshot 存储"的统一(CRDT 要记录级可合并,非整树 blob diff)——重做核心岔口。
- 两产品统一架构未落文档;饮食云存储模型未单独定义;跨产品账号数据隔离/RLS 未细化;freemium"免费限历史范围"数据层实现未定。

## 八、稳固共识基线(PWA/iOS 两边一致,可直接当地基)
本地永远 source-of-truth · 云=备份/中继 · owner mismatch fail-closed · service-role 不进客户端 · 不删本地/不假成功 · 账号 late+可选+解耦订阅 · document-first 不拆表 · 合规红线(FTC HBNR/华盛顿 MHMDA/加州 CCPA-CPRA、健康数据不喂广告)。
