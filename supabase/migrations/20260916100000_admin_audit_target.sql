-- =============================================
-- 감사 로그 — 대상 키·이름 기록, 시크릿 필드 제거, 복원 키 수정
-- (관리자 검토 2026-09-16, A1·A3·A2 부분)
--
-- A1: row_id가 항상 `id` 컬럼에서만 나와서 landing_promo(PK locale)·
--     admin_user_verifications(PK user_id)는 대상이 '-'로 남았다. 테이블별
--     키를 쓰고, 사람이 읽을 대상 이름(row_label)도 같이 남긴다.
-- A3: audit_redact가 길이(1000바이트)만 봐서 distribution_accounts.credentials
--     의 짧은 토큰은 평문으로 기록됐다. 필드명 기준으로 항상 제거한다.
-- A2: admin_restore_audit_entry가 모든 테이블을 t.id로 찾아 landing_promo는
--     복원이 아예 안 됐다. 테이블별 키 컬럼으로 찾는다. (값이 커서 생략된
--     필드 때문에 복원이 거부되는 근본 문제는 별도 버전 테이블로 푼다.)
-- =============================================

alter table public.admin_audit_log add column if not exists row_label text;

-- ---------------------------------------------
-- A3. 시크릿 필드는 크기와 무관하게 항상 제거
-- ---------------------------------------------
create or replace function public.audit_redact(j jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $fn$
  select coalesce(
    jsonb_object_agg(
      key,
      case
        when key ~* '(credential|token|secret|password|api_key)'
          then jsonb_build_object('__audit_redacted__', true)
        when length(value::text) > 1000
          then jsonb_build_object('__audit_omitted_bytes__', length(value::text))
        else value
      end
    ),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(j, '{}'::jsonb));
$fn$;

-- 제거된 필드도 "복원 불가"로 취급한다 — 안 그러면 복원이 토큰 자리를
-- {"__audit_redacted__":true}로 덮어쓴다.
create or replace function public.audit_omitted_fields(j jsonb)
returns text[]
language sql
immutable
set search_path = public
as $fn$
  select coalesce(array_agg(e.key order by e.key), '{}')
  from jsonb_each(coalesce(j, '{}'::jsonb)) e
  where (jsonb_typeof(e.value) = 'object'
         and (e.value ? '__audit_omitted_bytes__' or e.value ? '__audit_redacted__'))
     or (jsonb_typeof(e.value) = 'string' and e.value #>> '{}' like '[생략됨 %')
$fn$;

-- 이미 남아 있는 행 스크럽(현재 연결 계정 0개라 대부분 빈 작업이지만 안전장치)
update public.admin_audit_log
   set before = public.audit_redact(before),
       after  = public.audit_redact(after)
 where table_name = 'distribution_accounts';

-- ---------------------------------------------
-- A1. 테이블별 키·이름
-- ---------------------------------------------
create or replace function public.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before_full jsonb;
  v_after_full  jsonb;
  v_full        jsonb;
  v_before jsonb;
  v_after  jsonb;
  v_changed text[];
  v_row_id text;
  v_row_label text;
begin
  if TG_OP = 'INSERT' then
    v_after_full := to_jsonb(NEW);
    v_before := null;
    v_after := public.audit_redact(v_after_full);

  elsif TG_OP = 'DELETE' then
    v_before_full := to_jsonb(OLD);
    v_before := public.audit_redact(v_before_full);
    v_after := null;

  else -- UPDATE
    v_before_full := to_jsonb(OLD);
    v_after_full := to_jsonb(NEW);

    select array_agg(e.key order by e.key)
      into v_changed
      from jsonb_each(v_after_full) e
     where e.key <> 'updated_at'
       and v_before_full -> e.key is distinct from e.value;

    if v_changed is null then
      return NEW;
    end if;

    select public.audit_redact(jsonb_object_agg(k, v_before_full -> k)) into v_before
      from unnest(v_changed) k;
    select public.audit_redact(jsonb_object_agg(k, v_after_full -> k)) into v_after
      from unnest(v_changed) k;
  end if;

  v_full := coalesce(v_after_full, v_before_full);

  v_row_id := case TG_TABLE_NAME
    when 'landing_promo'            then v_full ->> 'locale'
    when 'admin_user_verifications' then v_full ->> 'user_id'
    else v_full ->> 'id'
  end;

  v_row_label := case TG_TABLE_NAME
    when 'admin_users'           then v_full ->> 'email'
    when 'admin_notices'         then v_full ->> 'title'
    when 'guide_articles'        then v_full ->> 'title'
    when 'scenario_catalog'      then coalesce(v_full #>> '{content,ko,title}',
                                               concat_ws(' · ', v_full ->> 'region', v_full ->> 'theme'))
    when 'landing_promo'         then concat_ws(' · ', v_full ->> 'locale', v_full ->> 'hero_title')
    when 'distribution_accounts' then concat(v_full ->> 'label', ' (', v_full ->> 'platform', ')')
    when 'insight_keywords'      then v_full ->> 'keyword'
    when 'content_reports'       then v_full ->> 'target_label'
    else null  -- admin_user_verifications: 이메일은 auth.users에 있어 화면에서 조인
  end;

  insert into public.admin_audit_log (
    actor_email, actor_id, table_name, operation, row_id, row_label, changed_fields, before, after
  ) values (
    nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    v_row_id,
    nullif(v_row_label, ''),
    v_changed,
    v_before,
    v_after
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- 기존 행 백필 — UPDATE 로그는 바뀐 컬럼만 담고 있어 키가 없을 수 있다(그건 그대로 둔다)
update public.admin_audit_log
   set row_id = coalesce(after ->> 'locale', before ->> 'locale')
 where table_name = 'landing_promo' and row_id is null;
update public.admin_audit_log
   set row_id = coalesce(after ->> 'user_id', before ->> 'user_id')
 where table_name = 'admin_user_verifications' and row_id is null;

-- ---------------------------------------------
-- A2(부분). 복원 시 테이블별 키 컬럼으로 찾는다
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
  v_allowed text[] := array['guide_articles', 'landing_promo', 'admin_notices', 'scenario_catalog'];
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

  v_key_col := case v_table when 'landing_promo' then 'locale' else 'id' end;

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
