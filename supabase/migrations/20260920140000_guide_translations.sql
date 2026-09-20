-- =============================================
-- 가이드 카드 다국어 통합(2026-09-20)
--
-- §32-12에서 처음엔 "언어마다 별도 행"으로 만들었는데, 사용자가 원한 건
-- 그게 아니라 scenario_catalog처럼 "한 콘텐츠, 언어 전환 버튼"이었다.
-- scenario_catalog.content(jsonb, 로케일 키)와 같은 패턴을 그대로 가져온다
-- (20260814000000_scenario_catalog.sql 참고).
--
-- 기존 title/summary/body_md/locale 컬럼은 그대로 "대표(기본) 언어"로
-- 남긴다 — 기존 가이드·관리자 화면·공개 상세페이지 전부 안 건드려도 된다.
-- translations는 그 외 보조 언어만 담는 추가 칸이다.
-- =============================================

alter table public.guide_articles
  add column if not exists translations jsonb not null default '{}'::jsonb;

comment on column public.guide_articles.translations is
  '보조 언어 버전 — {"en":{"title":"…","summary":"…","bodyMd":"…"}, "ja":{…}}. '
  '행 자체의 title/summary/body_md/locale은 대표(기본) 언어.';
