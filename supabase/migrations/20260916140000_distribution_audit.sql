-- =============================================
-- D3(관리자 검토 2026-09-16) — 게시 감사
--
-- distribution_posts는 20260904020000에서 "수집·발행 파이프라인이 대량으로
-- 쓰는 테이블"이라 감사 대상에서 통째로 뺐다. AI 초안 생성(distribution-draft)
-- 한 번에 platforms × countries 조합만큼 INSERT가 쏟아지니 맞는 판단이었다.
--
-- 그런데 D3가 실제로 원한 건 그 INSERT 홍수가 아니라 "사람의 승인·수정·
-- 게시·삭제·재시도"다. content_reports(사용자가 대량 INSERT, 관리자는
-- UPDATE/DELETE만)와 정확히 같은 모양이라 같은 해법을 쓴다 — UPDATE·DELETE만
-- 감사한다. 이러면:
--   - AI 초안 생성 INSERT 홍수는 안 남는다(그대로 원래 의도 유지)
--   - 승인(draft→approved)·게시 성공/실패(status·external_post_id·
--     posted_at 변경)·편집(제목·본문·계정 변경)·삭제·재시도는 전부 UPDATE/
--     DELETE라 그대로 잡힌다
--   - distribution-publish 엣지함수(서비스 롤)의 갱신은 actor_id가 없어
--     "시스템"으로 표시된다 — 기존 관례 그대로
--   - "외부 게시 ID와 요청 단위 식별자 연결"은 별도 컬럼 없이 해결된다:
--     UPDATE 감사는 바뀐 컬럼 전체를 스냅샷하므로 게시 성공 시
--     external_post_id·external_url·posted_at이 after에 고스란히 남는다
-- =============================================

do $$
begin
  if to_regclass('public.distribution_posts') is not null then
    drop trigger if exists audit_distribution_posts on public.distribution_posts;
    create trigger audit_distribution_posts
      after update or delete on public.distribution_posts
      for each row execute function public.log_admin_action();
  end if;
end;
$$;

-- row_label — 플랫폼·국가·제목(또는 본문 앞부분)으로 사람이 알아볼 수 있게.
-- landing_promo 사례처럼 CASE 안에 새 분기 하나만 추가하면 된다.
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
    when 'distribution_posts'    then concat_ws(' · ', v_full ->> 'platform', v_full ->> 'country',
                                               left(coalesce(nullif(v_full ->> 'title', ''), v_full ->> 'body', ''), 40))
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
