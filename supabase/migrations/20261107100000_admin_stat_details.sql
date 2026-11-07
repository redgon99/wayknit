-- =============================================
-- 현황 관리 칩 상세보기 + 자료 수 집계 교정
--
-- 1) 공유자료 현황 칩은 숫자만 있고 내역을 볼 곳이 없었다. 칩을 누르면 뜨는
--    모달용 목록 RPC 3개를 추가한다. 소유자 이메일(auth.users)이 필요하고
--    끌어오기는 여러 테이블을 묶어야 해서 기존 관리자 목록과 같이 RPC로 둔다.
--
-- 2) 자료는 20260908200000에서 trip_materials로 옮겨졌고 앱은 payload를 비운다.
--    그런데 admin_share_stats·admin_plaza_listings는 계속 payload의 materials를
--    세고 있어 실제보다 적게 나왔다. 칩 숫자와 모달 목록이 맞도록 함께 고친다.
--    둘 다 반환 형태가 그대로라 drop 없이 create or replace로 바꾼다.
--
-- 모두 SECURITY DEFINER이므로 첫 줄에서 is_admin()을 직접 확인한다.
-- 적용 방법: HANDOFF §1-2 참고 — `supabase db push`를 쓰지 않는다.
-- =============================================

-- ---------------------------------------------
-- 1) 여행 목록 — 총 여행 / 공개 여행 / 공유마당 등록 칩이 함께 쓴다
--    p_filter: 'all' | 'public' | 'listed'
-- ---------------------------------------------
create or replace function public.admin_trip_rows(
  p_filter text default 'all',
  p_search text default null,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  slug text,
  owner_email text,
  is_public boolean,
  listed_in_plaza boolean,
  plaza_listed_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_filter text := coalesce(p_filter, 'all');
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  with base as (
    select t.id as tid,
           coalesce(nullif(t.title, ''), '제목 없음') as ttitle,
           t.slug as tslug,
           u.email::text as oemail,
           t.is_public as pub,
           t.listed_in_plaza as listed,
           t.plaza_listed_at as listed_ts,
           t.updated_at as updated_ts
      from public.wayknit_trips t
      left join auth.users u on u.id = t.owner_id
     where v_filter = 'all'
        or (v_filter = 'public' and t.is_public)
        or (v_filter = 'listed' and t.listed_in_plaza)
  ),
  filtered as (
    select * from base b
     where v_search is null
        or b.ttitle ilike '%' || v_search || '%'
        or b.oemail ilike '%' || v_search || '%'
  )
  select f.tid, f.ttitle, f.tslug, f.oemail, f.pub, f.listed, f.listed_ts, f.updated_ts,
         count(*) over ()::bigint
    from filtered f
   order by case when v_filter = 'listed' then f.listed_ts end desc nulls last,
            f.updated_ts desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------
-- 2) 업로드 자료 목록 — 본문(body)은 내려보내지 않고 제목·종류만
-- ---------------------------------------------
create or replace function public.admin_material_rows(
  p_search text default null,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  trip_id uuid,
  material_id text,
  title text,
  kind text,
  file_name text,
  trip_title text,
  author_email text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  with base as (
    select m.trip_id as tid,
           m.material_id as mid,
           coalesce(nullif(m.data ->> 'title', ''), '제목 없음') as mtitle,
           m.data ->> 'kind' as mkind,
           m.data ->> 'fileName' as mfile,
           coalesce(nullif(t.title, ''), '제목 없음') as ttitle,
           m.created_by_email as aemail,
           m.created_at as created_ts
      from public.trip_materials m
      join public.wayknit_trips t on t.id = m.trip_id
  ),
  filtered as (
    select * from base b
     where v_search is null
        or b.mtitle ilike '%' || v_search || '%'
        or b.mfile ilike '%' || v_search || '%'
        or b.ttitle ilike '%' || v_search || '%'
        or b.aemail ilike '%' || v_search || '%'
  )
  select f.tid, f.mid, f.mtitle, f.mkind, f.mfile, f.ttitle, f.aemail, f.created_ts,
         count(*) over ()::bigint
    from filtered f
   order by f.created_ts desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------
-- 3) 끌어오기 이력
-- ---------------------------------------------
create or replace function public.admin_import_rows(
  p_search text default null,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  source_title text,
  source_slug text,
  source_is_public boolean,
  source_owner_email text,
  importer_email text,
  cloned_title text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  with base as (
    select i.id as iid,
           coalesce(nullif(s.title, ''), '제목 없음') as stitle,
           s.slug as sslug,
           s.is_public as spub,
           su.email::text as semail,
           iu.email::text as iemail,
           coalesce(nullif(c.title, ''), case when c.id is not null then '제목 없음' end) as ctitle,
           i.created_at as created_ts
      from public.share_plaza_imports i
      join public.wayknit_trips s on s.id = i.source_trip_id
      left join auth.users su on su.id = s.owner_id
      left join auth.users iu on iu.id = i.importer_id
      left join public.wayknit_trips c on c.id = i.cloned_trip_id
  ),
  filtered as (
    select * from base b
     where v_search is null
        or b.stitle ilike '%' || v_search || '%'
        or b.semail ilike '%' || v_search || '%'
        or b.iemail ilike '%' || v_search || '%'
  )
  select f.iid, f.stitle, f.sslug, f.spub, f.semail, f.iemail, f.ctitle, f.created_ts,
         count(*) over ()::bigint
    from filtered f
   order by f.created_ts desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------
-- 4) 자료 수 집계 교정 — payload 대신 trip_materials를 센다
-- ---------------------------------------------
create or replace function public.admin_share_stats()
returns table (
  total_trips bigint,
  public_trips bigint,
  listed_trips bigint,
  total_materials bigint,
  total_imports bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where t.is_public)::bigint,
    count(*) filter (where t.listed_in_plaza)::bigint,
    (select count(*) from public.trip_materials)::bigint,
    (select count(*) from public.share_plaza_imports)::bigint
  from public.wayknit_trips t;
end;
$$;

create or replace function public.admin_plaza_listings(
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  owner_id uuid,
  owner_email text,
  listed_at timestamptz,
  materials_count int,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  with listed as (
    select t.id as tid,
           coalesce(nullif(t.title, ''), '제목 없음') as ttitle,
           t.owner_id as oid,
           u.email::text as oemail,
           t.plaza_listed_at as listed_ts,
           (select count(*)::int from public.trip_materials m where m.trip_id = t.id) as mcount
      from public.wayknit_trips t
      left join auth.users u on u.id = t.owner_id
     where t.listed_in_plaza
  ),
  filtered as (
    select * from listed l
     where v_search is null
        or l.ttitle ilike '%' || v_search || '%'
        or l.oemail ilike '%' || v_search || '%'
  )
  select f.tid, f.ttitle, f.oid, f.oemail, f.listed_ts, f.mcount,
         count(*) over ()::bigint
    from filtered f
   order by f.listed_ts desc nulls last
   limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------
-- 5) 권한 — 새 함수는 PUBLIC/anon 회수 후 authenticated에만 부여
--    (교체한 두 함수는 create or replace라 기존 권한이 유지된다)
-- ---------------------------------------------
do $do$
declare
  sig text;
  sigs text[] := array[
    'public.admin_trip_rows(text, text, int, int)',
    'public.admin_material_rows(text, int, int)',
    'public.admin_import_rows(text, int, int)'
  ];
begin
  foreach sig in array sigs loop
    execute format('revoke all on function %s from public', sig);
    execute format('revoke all on function %s from anon', sig);
    execute format('grant execute on function %s to authenticated', sig);
  end loop;
end;
$do$;
