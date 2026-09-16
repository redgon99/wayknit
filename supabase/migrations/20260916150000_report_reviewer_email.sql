-- =============================================
-- R1(관리자 검토 2026-09-16) — 신고 처리 담당자 표시 + 제재 처리 시 자동 메모
--
-- reviewed_by(uuid)만 있어 화면에서 "누가 처리했는지" 보여주려면 auth.users를
-- 매번 조인해야 했다. trip_materials.created_by_email과 같은 패턴으로
-- 이메일을 같이 저장해 화면에서 바로 쓴다.
--
-- admin_moderate_report()는 제재(콘텐츠 비공개/게시중지)와 신고 종결을 한
-- 트랜잭션으로 묶는데, 지금까지 admin_note를 안 건드려서 "조치 완료" 신고에
-- 처리 메모가 비어 있는 게 정상이었다(사람이 따로 안 적으면). 콘텐츠에
-- 실제로 손을 댄 경우와 상태만 바꾼 경우를 화면에서 구분할 수 있게, 관리자가
-- 메모를 안 남겼으면 자동으로 표시해 둔다.
-- =============================================

alter table public.content_reports add column if not exists reviewed_by_email text;

create or replace function public.admin_moderate_report(p_report_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_type text;
  v_target text;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
  v_actor text;
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.' using errcode = '42501';
  end if;

  select r.target_type, r.target_id into v_type, v_target
    from public.content_reports r where r.id = p_report_id;
  if v_type is null then
    raise exception '신고를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  v_actor := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');

  if v_type in ('trip', 'plaza_listing') then
    select jsonb_build_object('is_public', t.is_public, 'listed_in_plaza', t.listed_in_plaza)
      into v_before
      from public.waymeld_trips t where t.id::text = v_target;
    if v_before is null then
      raise exception '대상 여행이 이미 삭제되었습니다.' using errcode = 'P0002';
    end if;

    if v_type = 'trip' then
      update public.waymeld_trips
         set is_public = false, listed_in_plaza = false
       where id::text = v_target;
    else
      update public.waymeld_trips
         set listed_in_plaza = false
       where id::text = v_target;
    end if;

    select jsonb_build_object('is_public', t.is_public, 'listed_in_plaza', t.listed_in_plaza)
      into v_after
      from public.waymeld_trips t where t.id::text = v_target;

    select array_agg(k order by k) into v_changed
      from jsonb_object_keys(v_after) k
     where v_before -> k is distinct from v_after -> k;

    if v_changed is not null then
      insert into public.admin_audit_log (
        actor_email, actor_id, table_name, operation, row_id, changed_fields, before, after
      ) values (
        v_actor, auth.uid(), 'waymeld_trips', 'UPDATE', v_target, v_changed, v_before, v_after
      );
    end if;

  elsif v_type = 'guide' then
    select jsonb_build_object('status', g.status) into v_before
      from public.guide_articles g where g.id::text = v_target;
    if v_before is null then
      raise exception '대상 가이드가 이미 삭제되었습니다.' using errcode = 'P0002';
    end if;

    update public.guide_articles set status = 'draft' where id::text = v_target;

    select jsonb_build_object('status', g.status) into v_after
      from public.guide_articles g where g.id::text = v_target;

  else
    raise exception '이 대상 유형(%)에는 제재 액션이 없습니다.', v_type
      using errcode = '22023';
  end if;

  -- 제재와 신고 처리를 한 트랜잭션으로 묶는다. 담당자 이메일도 같이 남기고,
  -- 사람이 아직 메모를 안 적었으면 "제재가 실제로 있었다"는 걸 화면에서
  -- 바로 알 수 있게 자동 문구를 채운다(R1).
  update public.content_reports
     set status = 'resolved',
         reviewed_by = auth.uid(),
         reviewed_by_email = v_actor,
         reviewed_at = now(),
         admin_note = coalesce(nullif(admin_note, ''), '[자동] 콘텐츠 제재 처리됨 — 대상을 직접 비공개/게시중지함')
   where id = p_report_id;

  return jsonb_build_object('target_type', v_type, 'before', v_before, 'after', v_after);
end;
$fn$;

revoke all on function public.admin_moderate_report(uuid) from public;
revoke all on function public.admin_moderate_report(uuid) from anon;
grant execute on function public.admin_moderate_report(uuid) to authenticated;
