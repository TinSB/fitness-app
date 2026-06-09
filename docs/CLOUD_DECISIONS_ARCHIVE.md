# Cloud / Account Decision Archive

> **状态:** 账号、云、同步和跨产品联动的决策归档。本文保留已拍板的未来方向和被取代输入,不授权第一版干净 runtime 引入网络、账号、云或 CRDT。实现权威仍以 `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` 的批准版本为准。

## 1. 当前保留决策

| 主题 | 决策 |
|---|---|
| Auth provider | Supabase Auth 是首选方向;Clerk 仅为备选;不采用自建 auth 或 Auth.js 作为首发方向。 |
| Backend | Supabase Postgres + RLS 是未来云同步候选栈;baseline repo 不含 approved Supabase runtime client 或 backend implementation。 |
| Account timing | 账号 late + optional;不强制注册、不挡训练、不挡 App Store 订阅。 |
| Subscription | 订阅与账号解耦;StoreKit / App Store entitlement 是首发付费闭环。 |
| Cloud role | 云是 backup + multi-device relay;本地仍是 source of truth。 |
| Sync consent | 只有用户显式 opt-in 后才同步;不自动上传 anonymous-local 数据。 |
| Merge model | 训练日志和 active session 采用记录级 CRDT / operation 合并;整树 snapshot 只做备份、导出、恢复锚和校验。 |
| Failure mode | 云不可用、auth invalid、owner mismatch、schema mismatch 或 merge failure 时保持 local app available。 |
| Data ownership | Derived outputs 不上升为 source of truth;DataHealth、analytics、e1RM、muscle level、share snapshot 都可重算。 |

## 2. 账号和 owner scope

账号模型必须显式区分:

- `accountId`
- `ownerUserId`
- provider subject id
- device id
- local owner id
- anonymous-local scope

账号绑定必须由用户明确确认。系统不得从本地文件、设备名、邮箱缓存或订阅状态静默推断账号归属。

登出和删号规则:

- 登出不删本地训练数据。
- 删号必须先提供导出。
- 云数据删除、本地备份删除和账号删除必须是不同确认。
- owner mismatch 必须 fail-closed。

## 3. 数据模型边界

未来云端数据分三类:

| 类别 | 例子 | 云端职责 |
|---|---|---|
| Mergeable records | active session event、completed set、session append、training log mutation | CRDT / operation journal 合并。 |
| Low-frequency config | profile scalar、unit、screening、program config、template confirmation | typed record + explicit conflict policy。 |
| Snapshot artifacts | AppData snapshot、export bundle、backup candidate | 备份、恢复、校验、迁移;不做并发覆盖真相。 |

不得把整树 snapshot 当作“最后写入者覆盖”的同步方案。snapshot 可以帮助恢复,但不能替代 record-level merge。

## 4. Security and RLS invariants

必须保留:

- RLS:用户只能访问自己的 account scope。
- service role key 绝不进客户端。
- mutation 必须有稳定 operation id / idempotency key。
- schemaVersion、sourceSnapshotHash 或等价校验字段必须参与写前验证。
- remote write 前后都要能解释是否真正成功。
- health / training data 不用于广告定向或未披露 analytics。

## 5. Rede ↔ Diet Companion

跨产品联动需要账号,但账号只是桥,不是任一产品的使用门槛。

目标方向:

- Rede 到饮食是解耦只读输入:训练目标、身材目标、训练消耗摘要。
- 饮食产品保留自己的营养数据和用户选择优先级。
- 两产品的数据隔离、RLS、删除、导出、订阅权益和隐私标签必须在统一架构切片里定义。

当前缺口:

- 两产品统一架构尚未实现。
- 饮食云存储模型尚未单独定义。
- 跨产品账号隔离和 RLS 规则尚未写入 Master-approved implementation slice。

## 6. 被取代输入

以下内容只作为历史来源,不再作为实现依据:

- PWA 时代的整树 snapshot + 手动冲突评审作为同步主方案。
- Vercel / dev API / browser sync / PWA route implementation。
- “云端 document snapshot repo 直接承载全部同步语义”的旧实现设想。
- 自动后台同步、silent account inference、cloud-primary 训练真相。

保留它们的原因是可追溯安全不变量:不假成功、不删本地、owner mismatch fail-closed、service role key 不进客户端、导出优先、合规优先。

## 7. 实现前开放问题

进入 runtime 前必须逐项拍板:

1. CRDT 选型:Automerge-swift、Yjs bridge 或自研 operation model。
2. record 粒度:set、exercise event、session event、program config 的边界。
3. operation journal 与 canonical JSON AppData 的重建/校验关系。
4. WatchConnectivity 与 Supabase transport 的 ordering、retry 和 reconciliation。
5. backup/export/restore 与 CRDT records 的一致性证明。
6. account binding UX、delete/export UX 和 privacy labels。
7. analytics / referral / share attribution 是否以及何时进入云 gate。
