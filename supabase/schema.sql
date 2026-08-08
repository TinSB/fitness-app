-- Rede 云端同步 schema（Supabase Postgres）
--
-- 设计约束（来自 ios/packages/RedeSync 的合并语义，改这里必须同步改那边）：
-- ① 训练记录 append-only、按 session_id 去重 → upsert 幂等，同 id 重传不产生新行
-- ② 配置整块 LWW → 每用户一行，updated_at 决胜
-- ③ 增量拉取按 updated_at 游标分页 → 必须有 (user_id, updated_at) 索引
-- ④ payload 用 jsonb 而非 bytea/text：>2KB 自动 TOAST 压缩省 2-4x，
--    同时 owner 在 Dashboard 仍能直接读和 SQL 查询。不要改成客户端 gzip——
--    那样省 25x 但后台只能看到二进制，与「我能看到数据」的硬要求冲突。
-- ⑤ schema_version 随行存储 → 客户端 fail-closed 跳过高版本记录，不猜不改
--
-- 合规（App Store 5.1.3(ii)：健康类 app 不得把个人健康信息存 iCloud）：
-- 本方案不用 iCloud，故 5.1.3(ii) 不适用；但仍不上传 HealthKit 体重——
-- 它在 App 内本来就只在内存里用，从不落 canonical。

-- ---------------------------------------------------------------------------
-- 训练记录：每场一行
-- ---------------------------------------------------------------------------
create table if not exists public.training_sessions (
    user_id        uuid        not null references auth.users (id) on delete cascade,
    session_id     text        not null,
    payload        jsonb       not null,
    schema_version int         not null,
    device_id      text        not null,
    updated_at     timestamptz not null default now(),
    primary key (user_id, session_id)
);

-- 增量拉取的游标索引：where user_id = ? and updated_at > ? order by updated_at
create index if not exists training_sessions_cursor_idx
    on public.training_sessions (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- 配置（画像/计划/设置）：每用户一行，整块 LWW
-- ---------------------------------------------------------------------------
create table if not exists public.user_config (
    user_id        uuid        primary key references auth.users (id) on delete cascade,
    payload        jsonb       not null,
    schema_version int         not null,
    device_id      text        not null,
    updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 表级授权。必须先 revoke all 再按需 grant，不能只写 grant。
--
-- 原因（实测 2026-08-07，建完表查 information_schema 发现的）：新表默认就带着
-- anon/authenticated 的 REFERENCES + TRIGGER + **TRUNCATE**。而 Postgres 的 RLS
-- 只覆盖 select/insert/update/delete，**TRUNCATE 不受行级策略约束**——留着这个
-- 权限等于给一条绕过 RLS 清空全表所有用户数据的路。PostgREST 目前不暴露
-- truncate，但纵深防御不能靠「上游碰巧没开这个口」。
--
-- 结果：anon 零权限（没登录不该碰到任何一行），authenticated 只有 CRUD 四项，
-- 再由下面的 RLS 限制到「只能是自己的行」。
-- ---------------------------------------------------------------------------
revoke all on public.training_sessions from anon, authenticated;
revoke all on public.user_config       from anon, authenticated;

grant select, insert, update, delete on public.training_sessions to authenticated;
grant select, insert, update, delete on public.user_config       to authenticated;

-- ---------------------------------------------------------------------------
-- RLS：用户只能读写自己的数据。没有这段，anon key 等于全库公开。
-- ---------------------------------------------------------------------------
alter table public.training_sessions enable row level security;
alter table public.user_config       enable row level security;

drop policy if exists "own sessions" on public.training_sessions;
create policy "own sessions" on public.training_sessions
    for all
    using      (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "own config" on public.user_config;
create policy "own config" on public.user_config
    for all
    using      (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at 由服务端盖章，不信客户端时钟
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists training_sessions_touch on public.training_sessions;
create trigger training_sessions_touch
    before insert or update on public.training_sessions
    for each row execute function public.touch_updated_at();

drop trigger if exists user_config_touch on public.user_config;
create trigger user_config_touch
    before insert or update on public.user_config
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 删号：App 内必须提供（审核 5.1.1(v)）。auth.users 级联删除会带走两张表。
-- 客户端调用 auth.admin.deleteUser 需要 service role key（绝不进客户端），
-- 所以走这个 security definer 函数，让用户能删自己。
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;
    delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
