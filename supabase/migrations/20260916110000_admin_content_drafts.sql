-- =============================================
-- 관리자 콘텐츠 — 초안 · 게시 버전 이력
-- (관리자 검토 2026-09-16, 묶음 2: L1·A2 나머지·C4·L4 기반)
--
-- L1(랜딩 초안 저장이 라이브를 덮음)·A2(landing_promo는 menu_tree가 커서
-- 감사 로그로 복원 불가)·C4(가이드 운영본을 직접 수정) 세 문제가 전부
-- "게시본과 작업본이 한 행"이라는 같은 원인이라 범용 테이블 하나로 푼다.
--
-- data/snapshot는 각 라이브 테이블의 행과 같은 모양(JSON)이다 — 어떤 컬럼이
-- 있는지는 admin_publish_draft/admin_restore_version이 allowlist로 안다.
-- =============================================

create table if not exists public.admin_content_drafts (
  table_name text not null,
  row_key    text not null,
  data       jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (table_name, row_key)
);

create table if not exists public.admin_content_versions (
  id bigint generated always as identity primary key,
  table_name   text not null,
  row_key      text not null,
  version      int not null,
  snapshot     jsonb not null,
  published_by uuid references auth.users(id),
  published_at timestamptz not null default now(),
  note         text,
  unique (table_name, row_key, version)
);

create index if not exists admin_content_versions_lookup
  on public.admin_content_versions (table_name, row_key, version desc);

alter table public.admin_content_drafts enable row level security;
alter table public.admin_content_versions enable row level security;

drop policy if exists admin_content_drafts_admin_all on public.admin_content_drafts;
create policy admin_content_drafts_admin_all on public.admin_content_drafts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_content_versions_admin_all on public.admin_content_versions;
create policy admin_content_versions_admin_all on public.admin_content_versions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------
-- landing_promo 공개 SELECT 구멍 — is_published=false 초안 행도 누구나
-- REST로 읽을 수 있었다(보고서가 놓친 것). 초안은 이제 별도 테이블이라
-- landing_promo엔 게시본만 남지만, 한 번도 게시 안 한 언어의 빈 행까지
-- 공개로 읽히던 걸 막는다.
-- ---------------------------------------------
drop policy if exists landing_promo_select_all on public.landing_promo;
create policy landing_promo_select_published_or_admin on public.landing_promo
  for select using (is_published = true or public.is_admin());

-- ---------------------------------------------
-- 게시 — 초안을 라이브에 반영하고, 반영 직전 라이브 행을 버전으로 남긴다
-- ---------------------------------------------
create or replace function public.admin_publish_draft(p_table text, p_key text)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_draft jsonb;
  v_key_col text;
  v_live jsonb;
  v_next_version int;
  v_allowed text[] := array['landing_promo', 'guide_articles'];
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.' using errcode = '42501';
  end if;
  if not (p_table = any(v_allowed)) then
    raise exception '% 은(는) 초안/게시를 지원하지 않습니다.', p_table using errcode = '22023';
  end if;

  select data into v_draft
    from public.admin_content_drafts
   where table_name = p_table and row_key = p_key;
  if v_draft is null then
    raise exception '게시할 초안이 없습니다.' using errcode = 'P0002';
  end if;

  v_key_col := case p_table when 'landing_promo' then 'locale' else 'id' end;

  execute format('select to_jsonb(t) from public.%I t where t.%I::text = $1', p_table, v_key_col)
    into v_live using p_key;

  select coalesce(max(version), 0) + 1 into v_next_version
    from public.admin_content_versions
   where table_name = p_table and row_key = p_key;

  if v_live is not null then
    insert into public.admin_content_versions (table_name, row_key, version, snapshot, published_by)
    values (p_table, p_key, v_next_version, v_live, auth.uid());
  end if;

  if p_table = 'landing_promo' then
    -- jsonb_populate_record는 draft에 없는 컬럼을 명시적 NULL로 채운다(테이블
    -- 기본값이 아니다) — updated_at은 NOT NULL이고, UPDATE 트리거만 있어서
    -- (BEFORE UPDATE, 이 locale이 처음 게시되는 INSERT 경로엔 안 붙음)
    -- 직접 채우지 않으면 제약 위반으로 실패한다(로컬 테스트에서 재현·확인).
    v_draft := v_draft || jsonb_build_object(
      'is_published', true, 'locale', p_key, 'updated_at', now()
    );
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)
         on conflict (%I) do update set %s',
      p_table, p_table, v_key_col,
      (select string_agg(format('%I = excluded.%I', k, k), ', ')
         from jsonb_object_keys(v_draft) k where k <> v_key_col)
    ) using v_draft;
  else
    -- guide_articles: status는 초안이 아니라 라이브가 이미 갖고 있던 값을 유지한다
    -- (게시 대상은 이미 published 상태인 글이므로 대부분 no-op이지만, 명시적으로 보존)
    v_draft := v_draft || jsonb_build_object('id', p_key)
      || case when v_live ? 'status' then jsonb_build_object('status', v_live -> 'status') else '{}'::jsonb end;
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) x where t.%I::text = $2',
      p_table,
      (select string_agg(format('%I = x.%I', k, k), ', ')
         from jsonb_object_keys(v_draft) k where k <> v_key_col),
      p_table, v_key_col
    ) using v_draft, p_key;
  end if;

  delete from public.admin_content_drafts where table_name = p_table and row_key = p_key;

  return v_next_version;
end;
$fn$;

revoke all on function public.admin_publish_draft(text, text) from public;
revoke all on function public.admin_publish_draft(text, text) from anon;
grant execute on function public.admin_publish_draft(text, text) to authenticated;

-- ---------------------------------------------
-- 버전 복원 — 스냅샷을 "초안"으로만 되돌린다. 라이브는 건드리지 않는다
-- (관리자가 미리보기로 확인 후 "게시"를 눌러야 실제로 반영됨 — A2에서
-- 지적된 "잘못 복원하면 라이브가 바로 망가지는" 위험을 없앤다)
-- ---------------------------------------------
create or replace function public.admin_restore_version(p_version_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_table text;
  v_key text;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.' using errcode = '42501';
  end if;

  select table_name, row_key, snapshot
    into v_table, v_key, v_snapshot
    from public.admin_content_versions where id = p_version_id;

  if v_table is null then
    raise exception '해당 버전을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  insert into public.admin_content_drafts (table_name, row_key, data, updated_by)
  values (v_table, v_key, v_snapshot, auth.uid())
  on conflict (table_name, row_key) do update
    set data = excluded.data, updated_by = excluded.updated_by, updated_at = now();

  return jsonb_build_object('table', v_table, 'row_key', v_key);
end;
$fn$;

revoke all on function public.admin_restore_version(bigint) from public;
revoke all on function public.admin_restore_version(bigint) from anon;
grant execute on function public.admin_restore_version(bigint) to authenticated;

-- ---------------------------------------------
-- 감사 로그의 복원 allowlist에서 landing_promo·guide_articles 제거
-- (버전 테이블이 대체 — 두 경로가 공존하면 혼란만 커진다)
-- ---------------------------------------------
create or replace function public.admin_restore_audit_entry(p_audit_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_table text;
  v_op text;
  v_row_id text;
  v_before jsonb;
  v_omitted text[];
  v_set text;
  v_key_col text;
  v_allowed text[] := array['admin_notices', 'scenario_catalog'];
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.' using errcode = '42501';
  end if;

  select table_name, operation, row_id, before
    into v_table, v_op, v_row_id, v_before
    from public.admin_audit_log where id = p_audit_id;

  if v_table is null then
    raise exception '해당 로그를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_table in ('landing_promo', 'guide_articles') then
    raise exception '% 은(는) 이제 버전 이력에서 복원합니다(이전 버전 패널 참고).', v_table using errcode = '22023';
  end if;

  if not (v_table = any(v_allowed)) then
    raise exception '% 은(는) 되돌리기를 지원하지 않습니다.', v_table using errcode = '22023';
  end if;

  if v_op = 'INSERT' then
    raise exception '추가는 되돌릴 수 없습니다. 해당 화면에서 삭제하세요.' using errcode = '22023';
  end if;

  if v_before is null or v_before = '{}'::jsonb then
    raise exception '이 로그에는 복원할 이전 값이 없습니다.' using errcode = '22023';
  end if;

  v_omitted := public.audit_omitted_fields(v_before);
  if array_length(v_omitted, 1) > 0 then
    raise exception '값이 커서 기록되지 않았거나 비밀값이라 제거된 필드가 있어 되돌릴 수 없습니다: %',
      array_to_string(v_omitted, ', ') using errcode = '22023';
  end if;

  v_key_col := 'id';

  if v_op = 'UPDATE' then
    if v_row_id is null then
      raise exception '이 로그에는 대상 키가 없어 되돌릴 수 없습니다.' using errcode = '22023';
    end if;

    select string_agg(format('%I = x.%I', k, k), ', ')
      into v_set from jsonb_object_keys(v_before) k;

    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) x where t.%I::text = $2',
      v_table, v_set, v_table, v_key_col
    ) using v_before, v_row_id;

  elsif v_op = 'DELETE' then
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
      v_table, v_table
    ) using v_before;
  end if;

  return jsonb_build_object('table', v_table, 'operation', v_op, 'row_id', v_row_id, 'restored', v_before);
end;
$fn$;

revoke all on function public.admin_restore_audit_entry(bigint) from public;
revoke all on function public.admin_restore_audit_entry(bigint) from anon;
grant execute on function public.admin_restore_audit_entry(bigint) to authenticated;
