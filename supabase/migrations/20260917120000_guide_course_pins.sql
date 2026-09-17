-- 추천 여행코스 가이드 상세 지도 핀
alter table public.guide_articles
  add column if not exists course_pins jsonb not null default '[]'::jsonb;

comment on column public.guide_articles.course_pins is
  'course kind: [{order,name,time?,lat,lng,label?}] for guide detail map pins';
