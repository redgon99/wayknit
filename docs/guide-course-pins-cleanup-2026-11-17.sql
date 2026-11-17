-- 공개 코스 가이드의 가짜 코스 핀 정리 (2026-11-17) — Supabase SQL Editor에서 실행.
--
-- AI 일정표를 핀으로 옮길 때 "청계천 → 성수 이동", "입니다.", "(확인 필요)", "휴식" 같은 일정표 줄까지 장소 검색이 돼
-- 엉뚱한 곳(춘천 택시회사, 서면 한의원, 인제 빙어축제 등)에 찍혔다. 2026-11-17 기준 16개 가이드에서 34개.
-- 공개 화면은 이미 코드에서 걸러 낸다(src/lib/guides.ts isSchedulePseudoPin). 이 SQL은 DB에서도 지운다.
-- 실행 전 원본을 공개되지 않는 backup 스키마에 통째로 보관한다. 되돌리기는 맨 아래 주석 참고.

begin;

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table if not exists backup.guide_course_pins_20261117 as
  select id, slug, course_pins, now() as saved_at
  from public.guide_articles
  where status = 'published' and kind = 'course';

update public.guide_articles g
set course_pins = (
  select coalesce(jsonb_agg(p order by ord), '[]'::jsonb)
  from jsonb_array_elements(g.course_pins) with ordinality as t(p, ord)
  where not (
    length(trim(p->>'name')) <= 2
    or trim(p->>'name') ~ '(→|(^|\s|·)이동($|\s|\(|·)|입니다|확인 필요|일정까지|안내하고|로 안내|^\*|자유시간|귀가|체크인|휴식$|점심/|^점심$|^저녁 식사$|^저녁$)'
  )
)
where g.status = 'published'
  and g.kind = 'course'
  and exists (
    select 1 from jsonb_array_elements(g.course_pins) p
    where length(trim(p->>'name')) <= 2
       or trim(p->>'name') ~ '(→|(^|\s|·)이동($|\s|\(|·)|입니다|확인 필요|일정까지|안내하고|로 안내|^\*|자유시간|귀가|체크인|휴식$|점심/|^점심$|^저녁 식사$|^저녁$)'
  );

commit;

-- 확인: 핀 수가 242 → 208이어야 한다.
select
  (select sum(jsonb_array_length(course_pins)) from backup.guide_course_pins_20261117) as pins_before,
  (select sum(jsonb_array_length(course_pins)) from public.guide_articles where status = 'published' and kind = 'course') as pins_after;

-- 되돌리기:
-- update public.guide_articles g set course_pins = b.course_pins
-- from backup.guide_course_pins_20261117 b where b.id = g.id;
