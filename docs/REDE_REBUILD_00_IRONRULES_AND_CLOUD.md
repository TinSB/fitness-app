# Rede 原生账号 / 云同步 / watchOS 决策记录

> **状态:** 已拍板的未来原生架构输入。本文不授权第一版干净 runtime 引入账号、网络、云、CRDT 或 watchOS。任何实现必须先修改并通过 `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` 的 architecture gate。

## 1. 保留决策

Rede 的目标实现仍是 native iOS local-first app:本地 JSON AppData 是唯一 canonical source of truth,SwiftUI app 层保持薄,业务逻辑在 Swift packages,raw AppData 不直接进入训练引擎。现有 Swift/iOS 代码只是 reference inventory,不是云/账号实现基线。

未来账号 / 云同步 / watchOS 的产品方向已经确定:

| 决策 | 口径 |
|---|---|
| 本地优先 | 本地数据永远可练、可写、可导出;云失败不得阻断本地训练。 |
| 账号 | 可选、late、显式触发;不挡训练、不挡订阅、不静默上传本地数据。 |
| 云同步 | 用户明确 opt-in 后才启用;云是备份和多设备中继,不是默认主真相。 |
| 合并模型 | 同步模型采用记录级 CRDT 自动合并,优先服务 active session 和训练日志。 |
| watchOS | 训练中 Apple Watch 可作为同一 active session 的并发操控端。 |
| 写入闸 | 未来每个 CRDT op 仍必须经过 gated write path 的验证、应用和 honest failure 语义。 |
| 服务端权威 | 不采用 server-primary 训练真相;cloud-primary 只有未来另开架构闸才可讨论。 |

## 2. 不变工程铁律

这些规则从目标 iOS 架构延伸到未来同步架构:

1. 核心纯净:平台 IO 在边缘,训练逻辑在 Swift packages。
2. 数据必净化:raw AppData 不进入 TrainingDecision、Progress、PlanAdjustment 或 MuscleLevelEstimator。
3. 唯一写闸:canonical 写入必须有校验、backup/rollback 语义、atomic save 和 honest failure。
4. 派生视图不是真相:LocalSnapshot、Widget、HealthKit export、UI projection、分享卡和未来 sync receipts 都不得成为训练真相。
5. 不假成功:本地写失败、云写失败、owner mismatch、schema mismatch、merge failure 都必须显式失败或进入本地可用模式。
6. 不删本地:登录、登出、同步失败、云端删除和账号删除不得静默删除本机训练数据。

## 3. CRDT 与 snapshot 的边界

未来同步不能用整树 AppData blob 作为冲突合并真相。整树 snapshot 仍有价值,但职责不同:

| 数据形态 | 职责 |
|---|---|
| 记录级 CRDT / operation journal | active session、completed set、session event、训练历史追加、训练中手机/手表并发编辑。 |
| Typed config record | profile scalar、unit setting、screening、program config、template confirmation 等低频配置;需要明确 owner、schemaVersion 和 conflict policy。 |
| AppData snapshot | 备份、导出、恢复锚点、schema migration check、灾难恢复;不是训练日志并发合并算法。 |
| Derived projection | DataHealth、analytics、e1RM、muscle level、share snapshot;可重算,不作为云端 source of truth。 |

实现时必须先定义 record 粒度,再定义 snapshot 如何从 records 重建或验证。不能把“存一棵树”误写成“用整树覆盖解决同步”。

## 4. watchOS 并发要求

watchOS 的核心场景是训练中手机和手表同时编辑同一个 active session:

- 手表完成一组,手机修改下一组目标。
- 手机替换动作,手表继续显示可执行的下一步。
- 任一端离线短暂断连后恢复,两端记录必须自动合并。
- 冲突不得靠用户在训练中手动评审整树差异。

因此 active session 必须是一等并发对象。WatchConnectivity 是手机和手表的近实时传输层;云同步是跨设备/备份传输层。二者共享同一 record/CRDT 语义,不能各自发明一套真相。

## 5. 账号、云和合规规则

账号只服务用户明确理解的价值:

- 多设备同步。
- 换机恢复。
- 跨产品联动。
- 用户支持和数据可带走。

账号不得成为:

- 开始训练的门槛。
- 订阅购买的强制前置。
- 本地数据上传的默认授权。
- 分享系统 MVP 的依赖。

合规规则:

- Sign in with Apple。
- 应用内删号。
- 删除前导出。
- 健康/训练数据不用于广告定向。
- owner mismatch fail-closed。
- service role key 绝不进入客户端。
- 隐私标签、FTC HBNR、Washington MHMDA、CCPA/CPRA 等要求在云实现前刷新。

## 6. 实现前必须补齐的工程切片

任何 runtime 实现前必须先有 Master-approved implementation slice:

1. CRDT 选型和 Swift package 边界。
2. AppData 到 records 的 domain mapping。
3. active session record model。
4. operation journal、idempotency 和 schema migration。
5. WatchConnectivity transport。
6. Supabase Auth/Postgres/RLS transport。
7. owner scope 和 account binding。
8. local backup/export/restore gate。
9. sync failure UI 和 recovery path。
10. privacy/security acceptance tests。

## 7. 非目标

第一轮实现不做:

- server-primary 训练真相。
- 自动后台上传。
- 默认创建账号。
- 公开 feed、排行榜、好友关系。
- 教练/学员多租户。
- 云端 DataHealth repair 直接覆盖本地。
- HealthKit 原始数据云同步。
- 分享卡外部归因或 referral 链接。

这些能力需要新的商业、隐私、合规和架构 gate。
