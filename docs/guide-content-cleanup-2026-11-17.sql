-- 공개 가이드 한국어 원문·번역본의 챗봇 흔적 정리 (2026-11-17)
-- 실행 전 원본(요약·본문·번역)을 backup.guide_articles_content_20261117에 보관한다. 되돌리기는 맨 아래.
--  1) 링크의 utm_source=chatgpt.com 꼬리표 제거(본문·번역)
--  2) 만료되는 images.openai.com 이미지 줄 제거(본문·번역)
--  3) 본문 안 출처 favicon 칩([![Image 1](…s2/favicons…)사이트+1](…)) 제거
--  4) 챗봇 말투 서두·요약("좋아요.", "✅ 선택 반영", "선택하신 조건은 … 반영했습니다") 다듬기
--  5) 홍천 표의 깨진 줄을 표 위 안내 문장으로, 동해삼척 끝 후속 질문 목록·인사동 "말씀해 주세요" 삭제,
--     인사동 "창덕궁 공식정보" 링크가 덕수궁 주소였던 것 바로잡기

begin;

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table if not exists backup.guide_articles_content_20261117 as
  select id, slug, summary, body_md, translations, now() as saved_at
  from public.guide_articles
  where status = 'published'
    and (body_md ~ '(utm_source=chatgpt|images\.openai\.com|s2/favicons)'
      or translations::text ~ '(utm_source=chatgpt|images\.openai\.com)'
      or slug in ('서울-k-pop-하루-코스-kota7', '속초-커플-당일치기-m0hex',
                  '원주에서-횡성으로-이어지는-1일-가족-힐링여행-fjbkc', '홍천-겨울축제-감성-1박-2일-rql29',
                  '동해삼척-1일-힐링-휴식의-해안선-여행-zkel5', '인사동에서-펼쳐지는-감성-데이트-1일-코스-32a4q'));

-- 1) utm 꼬리표
update public.guide_articles
set body_md = regexp_replace(regexp_replace(body_md, '\?utm_source=chatgpt\.com&', '?', 'g'),
                             '[?&]utm_source=chatgpt\.com', '', 'g')
where status = 'published' and body_md ~ 'utm_source=chatgpt';

update public.guide_articles
set translations = regexp_replace(regexp_replace(translations::text, '\?utm_source=chatgpt\.com&', '?', 'g'),
                                  '[?&]utm_source=chatgpt\.com', '', 'g')::jsonb
where status = 'published' and translations::text ~ 'utm_source=chatgpt';

-- 2) images.openai.com 이미지 줄
update public.guide_articles
set body_md = regexp_replace(
      regexp_replace(body_md, '(^|\n)\(?!?\[[^\]\n]*\]\(https://images\.openai\.com/[^)\n]*\)\)?[ \t]*(?=\n|$)', '\1', 'g'),
      '\n{3,}', E'\n\n', 'g')
where status = 'published' and body_md ~ 'images\.openai\.com';

update public.guide_articles
set translations = regexp_replace(translations::text, '\(?!?\[[^\]]*\]\(https://images\.openai\.com/[^)]*\)\)?', '', 'g')::jsonb
where status = 'published' and translations::text ~ 'images\.openai\.com';

-- 3) favicon 출처 칩
update public.guide_articles
-- 주의: 처음 실행본은 `[^\]]*`가 줄바꿈을 넘어 '제천'·'경주'(삭제 예정 글) 본문을 지웠다. 두 글은 백업에서 되돌렸고,
-- 아래는 한 줄 안에서만 지우도록 고친 규칙이다.
set body_md = regexp_replace(body_md, ' ?\[!\[Image \d+\]\(https://www\.google\.com/s2/favicons[^)\n]*\)[^\]\n]*\]\([^)\n]*\)', '', 'g')
where status = 'published' and body_md ~ 's2/favicons';

-- 4) 서두·요약
update public.guide_articles
set summary = '서울에서 대중교통으로 하루 동안 K-POP 명소를 여유 있게 도는 코스입니다. 아래 운영정보는 2026년 9월 18일 확인 기준입니다.',
    body_md = replace(body_md,
      '✅ 선택 반영: 서울 · 당일 · K-POP 중심 대중교통 + 너무 빡빡하지 않은 균형형 코스로 잡았어요. 아래 운영정보는 2026년 9월 18일 확인 기준입니다.',
      '서울에서 대중교통으로 하루 동안 K-POP 명소를 여유 있게 도는 코스입니다. 아래 운영정보는 2026년 9월 18일 확인 기준입니다.')
where slug = '서울-k-pop-하루-코스-kota7';

update public.guide_articles
set summary = '속초 커플 당일치기 코스입니다. 오전에는 카페·점심을 먼저 두고, 호수 → 바다 → 해변을 오후에 배치했습니다. 오전에 비 예보가 있는 날에도 그대로 쓰기 좋은 순서입니다.',
    body_md = replace(body_md,
      '좋아요. 9월 19일(토) 속초 커플 당일치기로 잡았습니다. 오전에는 비 가능성이 있어 카페·점심을 먼저 두고, 호수 → 바다 → 해변을 오후에 배치했습니다. 기상청 단기예보도 19일 오전 비 이후 오후에는 맑아지는 흐름을 보여줍니다.',
      '속초 커플 당일치기 코스입니다. 오전에는 카페·점심을 먼저 두고, 호수 → 바다 → 해변을 오후에 배치했습니다. 오전에 비 예보가 있는 날에도 그대로 쓰기 좋은 순서입니다.')
where slug = '속초-커플-당일치기-m0hex';

update public.guide_articles
set summary = '**가을 · 자연/휴식/로컬사진/아이와 즐길 곳 · 자가용** 가족 당일 코스입니다. 원주에서 시작해 횡성 쪽으로 이동하는 방향이라 되돌아가는 구간이 적습니다.',
    body_md = replace(body_md,
      '좋아요. 선택하신 조건은 **가을 · 자연/휴식/로컬사진/아이와 즐길 곳 · 자가용 · 추천 코스**로 반영했습니다. 원주에서 시작해 횡성 쪽으로 이동하는 방향이라 되돌아가는 구간을 줄인 가족 당일 코스입니다.',
      '**가을 · 자연/휴식/로컬사진/아이와 즐길 곳 · 자가용** 가족 당일 코스입니다. 원주에서 시작해 횡성 쪽으로 이동하는 방향이라 되돌아가는 구간이 적습니다.')
where slug = '원주에서-횡성으로-이어지는-1일-가족-힐링여행-fjbkc';

-- 5) 개별 수정
update public.guide_articles
set body_md = replace(
      regexp_replace(body_md, '\| 09:00~17:30 \| \*\* 일정까지 안내하고 있습니다 \|[^\n]*\n', ''),
      E'### 하루 일정\n\n| 시간 | 일정 | 포인트 |',
      E'### 하루 일정\n\n2027년 축제 일정은 9월 확인 당시 공식 발표 전이었습니다. 아래는 1월 축제 기간에 맞춘 여행안이고, 2026년에는 얼음·부교·실내낚시, 겨울놀이, 공연·먹거리 등이 운영됐습니다. 방문 전 축제 공식 안내에서 날짜를 확인하세요. ([홍천축제][1])\n\n| 시간 | 일정 | 포인트 |')
where slug = '홍천-겨울축제-감성-1박-2일-rql29';

update public.guide_articles
set body_md = regexp_replace(body_md,
      '정확한 9월 날짜와 출발지를 알려주시면[^\n]*\n\n현재 환경에서는[^\n]*\n\n- 출발 날짜와 출발지 알려주기\n- 케이블카 운영 상태 확인 요청하기\n- 비 올 때 대체 코스 추천 요청\n\n',
      '')
where slug = '동해삼척-1일-힐링-휴식의-해안선-여행-zkel5';

update public.guide_articles
set body_md = replace(replace(body_md,
      E'**추가 질문이 있거나 시간을 조정하고 싶으면 언제든 말씀해 주세요!**\n\n', ''),
      '[창덕궁 공식정보](https://www.deoksu.go.kr/)', '[창덕궁 공식정보](https://cdg.go.kr/)')
where slug = '인사동에서-펼쳐지는-감성-데이트-1일-코스-32a4q';

commit;

-- 되돌리기:
-- update public.guide_articles g
-- set summary = b.summary, body_md = b.body_md, translations = b.translations
-- from backup.guide_articles_content_20261117 b where b.id = g.id;
