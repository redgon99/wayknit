-- WayMeld → Wayknit 개명에 따른 DB 객체 이름 변경.
--
-- 과거 마이그레이션 파일은 그대로 둔다(당시 이력이므로). 이 파일 하나가 개명을 표현한다.
-- 적용 방법: HANDOFF §1-2 참고 — `supabase db push`가 아니라 대시보드 SQL 에디터 또는
-- MCP apply_migration으로 원격에 직접 적용한다.
--
-- 이름만 바꾸며 데이터는 건드리지 않는다. FK(share_plaza_imports·trip_invites·
-- trip_collaborators)와 supabase_realtime publication 멤버십은 rename을 자동으로 따라간다.

-- 1. 테이블
alter table public.waymeld_trips rename to wayknit_trips;

-- 2. 제약조건 (pkey·unique는 동명 인덱스도 함께 따라간다)
alter table public.wayknit_trips rename constraint waymeld_trips_pkey to wayknit_trips_pkey;
alter table public.wayknit_trips rename constraint waymeld_trips_slug_key to wayknit_trips_slug_key;
alter table public.wayknit_trips rename constraint waymeld_trips_owner_id_fkey to wayknit_trips_owner_id_fkey;

-- 3. 보조 인덱스
alter index public.waymeld_trips_owner_idx rename to wayknit_trips_owner_idx;
alter index public.waymeld_trips_plaza_listed_idx rename to wayknit_trips_plaza_listed_idx;
alter index public.waymeld_trips_plaza_locale_idx rename to wayknit_trips_plaza_locale_idx;
alter index public.waymeld_trips_slug_idx rename to wayknit_trips_slug_idx;

-- 4. 트리거·정책
alter trigger waymeld_trips_updated_at on public.wayknit_trips rename to wayknit_trips_updated_at;
alter policy waymeld_trips_admin_select on public.wayknit_trips rename to wayknit_trips_admin_select;

-- 5. 함수 본문의 테이블 참조.
--    함수 본문은 파스트리가 아니라 텍스트로 저장돼 rename을 따라가지 않는다 —
--    그대로 두면 전부 "relation waymeld_trips does not exist"로 깨진다.
--    정의를 다시 읽어 참조만 바꿔 재생성한다(권한·소유자는 그대로 유지된다).
do $$
declare
  r record;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.prosrc like '%waymeld_trips%'
  loop
    execute replace(pg_get_functiondef(r.oid), 'waymeld_trips', 'wayknit_trips');
  end loop;
end $$;

-- 6. 이름 자체에 브랜드가 든 함수 (본문은 5단계에서 이미 교정됨)
alter function public.delete_waymeld_mock_mail_users() rename to delete_wayknit_mock_mail_users;
