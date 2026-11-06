-- 접속 로그 추세: 시간대/일별 그래프와 이전 기간 대비 증감.
--
-- "내부 접속" 판정이 집계·추세 두 함수로 갈라지지 않도록 access_log_views 하나로 모은다.
-- access_log_views는 관리자 확인이 없으므로 어떤 역할에도 실행 권한을 주지 않는다 —
-- 소유자 권한으로 도는 admin_access_log* 함수 안에서만 호출된다.

create or replace function public.access_log_views(
  p_since timestamptz,
  p_until timestamptz default null
)
returns table (
  id bigint,
  path text,
  locale text,
  user_id uuid,
  session_id text,
  created_at timestamptz,
  internal boolean,
  visitor text
)
language sql
stable
set search_path = public
as $$
  with internal_users as (
    select u.id
    from auth.users u
    join public.admin_users a on lower(a.email) = lower(u.email)
    union
    select v.user_id
    from public.admin_user_verifications v
    where v.is_test
  ),
  internal_sessions as (
    select distinct e.session_id
    from public.analytics_events e
    join internal_users i on i.id = e.user_id
    where e.session_id is not null
      and e.session_id <> 'anon'
  ),
  base as (
    select
      e.id,
      coalesce(e.props->>'path', '/') as path,
      e.locale,
      e.user_id,
      e.session_id,
      e.created_at
    from public.analytics_events e
    where e.event = 'page_view'
      and e.created_at >= p_since
      and e.created_at < coalesce(p_until, 'infinity'::timestamptz)
  )
  select
    b.id,
    b.path,
    b.locale,
    b.user_id,
    b.session_id,
    b.created_at,
    -- in 대신 exists: user_id가 NULL(비로그인)이면 in은 NULL이 되어 실제 방문자가 통째로 빠진다.
    (
      b.path = '/admin'
      or b.path like '/admin/%'
      or exists (select 1 from internal_users i where i.id = b.user_id)
      or exists (select 1 from internal_sessions s where s.session_id = b.session_id)
    ) as internal,
    -- 로그인 전후 방문이 두 명으로 세어지지 않게 세션의 소유자로 묶는다.
    coalesce(
      b.user_id::text,
      case
        when b.session_id is not null
          then max(b.user_id::text) over (partition by b.session_id)
      end,
      b.session_id,
      'unknown'
    ) as visitor
  from base b;
$$;

revoke all on function public.access_log_views(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.admin_access_log(
  p_since timestamptz,
  p_path text default null,
  p_include_internal boolean default false,
  p_row_limit integer default 300
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_row_limit, 300), 1), 50000);
  v_path text := nullif(lower(trim(coalesce(p_path, ''))), '');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with views as (
    select *
    from public.access_log_views(p_since) a
    where v_path is null or strpos(lower(a.path), v_path) > 0
  ),
  filtered as (
    select *
    from views a
    where p_include_internal or not a.internal
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'visitors', (select count(distinct f.visitor) from filtered f),
    'excluded', case
      when p_include_internal then 0
      else (select count(*) from views a where a.internal)
    end,
    'top_paths', (
      select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'count', t.cnt) order by t.cnt desc, t.path), '[]'::jsonb)
      from (
        select f.path, count(*) as cnt
        from filtered f
        group by f.path
        order by cnt desc, f.path
        limit 10
      ) t
    ),
    'rows', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'path', r.path,
            'locale', r.locale,
            'logged_in', r.user_id is not null,
            'session_id', r.session_id,
            'created_at', r.created_at
          )
          order by r.created_at desc, r.id desc
        ),
        '[]'::jsonb
      )
      from (
        select f.*
        from filtered f
        order by f.created_at desc, f.id desc
        limit v_limit
      ) r
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_access_log(timestamptz, text, boolean, integer) from public, anon;
grant execute on function public.admin_access_log(timestamptz, text, boolean, integer) to authenticated;

create or replace function public.admin_access_log_trend(
  p_since timestamptz,
  p_until timestamptz,
  p_prev_since timestamptz,
  p_prev_until timestamptz,
  p_path text default null,
  p_include_internal boolean default false,
  p_bucket text default 'day',
  p_tz text default 'Asia/Seoul'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_path text := nullif(lower(trim(coalesce(p_path, ''))), '');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_bucket not in ('hour', 'day') then
    raise exception 'invalid bucket: %', p_bucket using errcode = '22023';
  end if;

  with scoped as (
    select *
    from public.access_log_views(p_prev_since, p_until) a
    where (p_include_internal or not a.internal)
      and (v_path is null or strpos(lower(a.path), v_path) > 0)
  ),
  cur as (
    select * from scoped s where s.created_at >= p_since and s.created_at < p_until
  ),
  prev as (
    select * from scoped s where s.created_at >= p_prev_since and s.created_at < p_prev_until
  ),
  series as (
    select gs as bucket
    from generate_series(
      date_trunc(p_bucket, p_since at time zone p_tz),
      date_trunc(p_bucket, p_until at time zone p_tz),
      ('1 ' || p_bucket)::interval
    ) gs
  ),
  counted as (
    select
      date_trunc(p_bucket, c.created_at at time zone p_tz) as bucket,
      count(*) as views,
      count(distinct c.visitor) as visitors
    from cur c
    group by 1
  )
  select jsonb_build_object(
    'buckets', (
      select jsonb_agg(
        jsonb_build_object(
          'at', to_char(s.bucket, 'YYYY-MM-DD"T"HH24:MI'),
          'views', coalesce(c.views, 0),
          'visitors', coalesce(c.visitors, 0)
        )
        order by s.bucket
      )
      from series s
      left join counted c on c.bucket = s.bucket
    ),
    'current', (
      select jsonb_build_object('views', count(*), 'visitors', count(distinct c.visitor)) from cur c
    ),
    'previous', (
      select jsonb_build_object('views', count(*), 'visitors', count(distinct p.visitor)) from prev p
    ),
    -- 기록이 시작되기 전까지 걸친 이전 기간과 비교하면 증가율이 부풀려진다.
    'previous_complete', coalesce(
      (select min(e.created_at) from public.analytics_events e where e.event = 'page_view') <= p_prev_since,
      false
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_access_log_trend(timestamptz, timestamptz, timestamptz, timestamptz, text, boolean, text, text) from public, anon;
grant execute on function public.admin_access_log_trend(timestamptz, timestamptz, timestamptz, timestamptz, text, boolean, text, text) to authenticated;

notify pgrst, 'reload schema';
