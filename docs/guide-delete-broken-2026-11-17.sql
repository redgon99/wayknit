-- 깨진 공개 가이드 3개 삭제 (2026-11-17, 사용자 결정 "삭제") — Supabase SQL Editor에서 실행.
-- Claude가 실행하려 했으나 실행 승인이 거절돼 파일로 남긴다.
--  - 1일차-에메랄드빛-동부-해안-bpshe : 요약이 "This is a copy of a shared ChatGPT chat", 본문은 제주 일정
--  - 원하시면-이어서-춘천-출발-제천-…-7yg3m : 제목·슬러그가 챗봇 답변 문장
--  - 경주-역사-맛집-하루-일정-f4np0 : 다른 경주 가이드(6aaba896)의 깨진 중복
-- 이 글을 참조하는 곳은 distribution_posts.source_guide_id 하나뿐이고 삭제 시 null로 바뀐다(on delete set null).
-- 행 전체를 backup 스키마에 보관한 뒤 지운다. 되돌리기는 맨 아래.

begin;

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table if not exists backup.guide_articles_deleted_20261117 as
  select g.*, now() as deleted_at from public.guide_articles g where false;

insert into backup.guide_articles_deleted_20261117
  select g.*, now() from public.guide_articles g
  where g.id in ('6d46288e-7a7e-4803-b3c4-cab03aed2395',
                 'fedaf416-f9a9-40d6-8929-42d3f4750613',
                 '3557bf25-5d5e-4886-932e-53afd811da61');

delete from public.guide_articles
where id in ('6d46288e-7a7e-4803-b3c4-cab03aed2395',
             'fedaf416-f9a9-40d6-8929-42d3f4750613',
             '3557bf25-5d5e-4886-932e-53afd811da61');

commit;

-- 확인: backed_up 3, 공개 가이드 96 → 93
select (select count(*) from backup.guide_articles_deleted_20261117) as backed_up,
       (select count(*) from public.guide_articles where status = 'published') as published_now;

-- 되돌리기(deleted_at만 빼고 다시 넣는다):
-- insert into public.guide_articles select id, slug, title, summary, body_md, summary_en, topic_tags, status,
--   source_analysis_ids, source_urls, locale, created_by, published_at, created_at, updated_at, kind, course_pins,
--   translations, reviewed_by, reviewed_at from backup.guide_articles_deleted_20261117;
