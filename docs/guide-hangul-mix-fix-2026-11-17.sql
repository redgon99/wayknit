-- 가이드 번역(ja·zh-CN·zh-TW)에 섞인 한글 정리 (2026-11-17)
-- 한자·가나와 붙어 반쯤 한글로 남은 표기(景福궁, 北촌, 방字유기, テンプルステ이, 자라섬から… 등)를 고치고,
-- "X（X，漢字）" 꼴은 "漢字（한글）"로 바꾼다. 「韓語稱빈대떡」 같은 원어 소개·한국어 주소는 그대로 둔다.
-- 번체 변환(OpenCC)이 지명의 「里」를 「裡」로 바꾼 것(廣安裡, 清涼裡)도 되돌린다.
-- 실행 전 원본 번역을 backup 스키마에 보관한다. 되돌리기는 맨 아래.

begin;

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;
create table if not exists backup.guide_translations_hangul_20261117 as
  select id, slug, translations, now() as saved_at from public.guide_articles where status = 'published';
alter table backup.guide_translations_hangul_20261117 enable row level security;

do $fix$
declare r record;
begin
  for r in
    select * from (values
      -- zh-CN
      (1,  'zh-CN', false, null, '北촌한옥마을（北村韩屋村）', '北村韩屋村（북촌한옥마을）'),
      (2,  'zh-CN', false, null, '钟路五가站', '钟路5街站'),
      (3,  'zh-CN', false, null, '钟路三가站', '钟路3街站'),
      (4,  'zh-CN', false, null, '昌경宫路', '昌庆宫路'),
      (5,  'zh-CN', false, null, '“방字유기”', '“방짜유기”'),
      (6,  'zh-CN', false, null, '방字유기（Bangjja Yugi）', '方字鍮器（방짜유기，Bangjja Yugi）'),
      (7,  'zh-CN', false, null, '方字유기', '方字鍮器'),
      (8,  'zh-CN', false, null, '방字유기', '方字鍮器'),
      (9,  'zh-CN', false, null, '北汉산', '北汉山'),
      (10, 'zh-CN', false, null, '华계寺', '华溪寺'),
      (11, 'zh-CN', false, null, '景福궁（경복궁，景福宫）', '景福宫（경복궁）'),
      (12, 'zh-CN', false, null, '景福궁（Gyeongbokgung，景福宫）', '景福宫（Gyeongbokgung）'),
      (13, 'zh-CN', false, null, '北촌（북촌，北촌）', '北村（북촌）'),
      (14, 'zh-CN', false, null, '海운대（해운대，海云台）', '海云台（해운대）'),
      (15, 'zh-CN', false, null, '昌德궁（창덕궁，昌德宫）', '昌德宫（창덕궁）'),
      (16, 'zh-CN', false, null, '仁寺동（인사동，仁寺洞）', '仁寺洞（인사동）'),
      (17, 'zh-CN', false, null, '弘대（홍대，弘大）', '弘大（홍대）'),
      (18, 'zh-CN', true,  null, '([가-힣]+)（\1，([^）]+)）', '\2（\1）'),
      (19, 'zh-CN', false, null, '北촌', '北村'),
      (20, 'zh-CN', false, null, '꼬마김밥是用', '迷你紫菜包饭（꼬마김밥）是用'),
      (21, 'zh-CN', false, null, '主要有배달의민족(Baemin)', '主要有Baemin（배달의민족）'),
      (22, 'zh-CN', false, null, '김밥详解：', '紫菜包饭（김밥）详解：'),
      (23, 'zh-CN', false, null, '权金성', '权金城'),
      -- zh-TW
      (31, 'zh-TW', false, null, '北촌한옥마을（北村韓屋村）', '北村韓屋村（북촌한옥마을）'),
      (32, 'zh-TW', false, null, '鐘路五가站', '鍾路5街站'),
      (33, 'zh-TW', false, null, '鍾路三가站', '鍾路3街站'),
      (34, 'zh-TW', false, null, '昌경宮路', '昌慶宮路'),
      (35, 'zh-TW', false, null, '“방字유기”', '“방짜유기”'),
      (36, 'zh-TW', false, null, '방字유기（Bangjja Yugi）', '方字鍮器（방짜유기，Bangjja Yugi）'),
      (37, 'zh-TW', false, null, '方字유기', '方字鍮器'),
      (38, 'zh-TW', false, null, '방字유기', '方字鍮器'),
      (39, 'zh-TW', false, null, '北漢산', '北漢山'),
      (40, 'zh-TW', false, null, '華계寺', '華溪寺'),
      (41, 'zh-TW', false, null, '景福궁（경복궁，景福宮）', '景福宮（경복궁）'),
      (42, 'zh-TW', false, null, '景福궁（Gyeongbokgung，景福宮）', '景福宮（Gyeongbokgung）'),
      (43, 'zh-TW', false, null, '北촌（북촌，北촌）', '北村（북촌）'),
      (44, 'zh-TW', false, null, '海운대（해운대，海雲臺）', '海雲臺（해운대）'),
      (45, 'zh-TW', false, null, '昌德궁（창덕궁，昌德宮）', '昌德宮（창덕궁）'),
      (46, 'zh-TW', false, null, '仁寺동（인사동，仁寺洞）', '仁寺洞（인사동）'),
      (47, 'zh-TW', false, null, '弘대（홍대，弘大）', '弘大（홍대）'),
      (48, 'zh-TW', true,  null, '([가-힣]+)（\1，([^）]+)）', '\2（\1）'),
      (49, 'zh-TW', false, null, '北촌', '北村'),
      (50, 'zh-TW', false, null, '꼬마김밥是用', '迷你紫菜包飯（꼬마김밥）是用'),
      (51, 'zh-TW', false, null, '主要有배달의민족(Baemin)', '主要有Baemin（배달의민족）'),
      (52, 'zh-TW', false, null, '김밥詳解：', '紫菜包飯（김밥）詳解：'),
      (53, 'zh-TW', false, null, '權金성', '權金城'),
      (54, 'zh-TW', false, null, '廣安裡', '廣安里'),
      (55, 'zh-TW', false, null, '清涼裡', '清涼里'),
      -- ja
      (61, 'ja', false, null, '鍾路5가駅（鍾路5街駅／종로5가역）', '鍾路5街駅（종로5가역）'),
      (62, 'ja', false, null, '鍾路3가駅（鍾路3街駅／종로3가역）', '鍾路3街駅（종로3가역）'),
      (63, 'ja', false, null, '구파발の入口', '旧把撥（クパバル／구파발）の入口'),
      (64, 'ja', false, null, '북한산성（北漢山城／プハンサンソン）', '北漢山城（プッカンサンソン／북한산성）'),
      (65, 'ja', false, null, '화계사（華계寺／ファゲサ）', '華渓寺（ファゲサ／화계사）'),
      (66, 'ja', false, null, 'テンプルステ이', 'テンプルステイ'),
      (67, 'ja', false, null, '仁寺동（인사동 - インサドン）', '仁寺洞（インサドン／인사동）'),
      (68, 'ja', false, null, 'シ앗ホットック', 'シアッホットク'),
      (69, 'ja', false, null, '（ハンガン / 한ガン）', '（ハンガン／한강）'),
      (70, 'ja', false, null, '（パンプデギョ／반浦大橋）', '（パンポデギョ／반포대교）'),
      (71, 'ja', false, null, '牛島・쇠소깍・正房瀑布', '牛島・スェソッカク・正房瀑布'),
      (72, 'ja', false, null, 'ピンデ떡', 'ピンデトク'),
      (73, 'ja', false, null, '（プク촌한옥마을）', '（プクチョン／북촌한옥마을）'),
      -- ja: 북한강 자전거 가이드의 한글 지명
      (81, 'ja', false, 'seoul-chuncheon-one-day-bukhan%', '자라섬（ジャラソム）', 'チャラ島（자라섬）'),
      (82, 'ja', true,  'seoul-chuncheon-one-day-bukhan%', '(?<!（)자라섬', 'チャラ島'),
      (83, 'ja', true,  'seoul-chuncheon-one-day-bukhan%', '(?<!（)강촌유원지', '江村遊園地'),
      (84, 'ja', true,  'seoul-chuncheon-one-day-bukhan%', '(?<!（)의암호', '衣岩湖'),
      (85, 'ja', true,  'seoul-chuncheon-one-day-bukhan%', '의암(ダム|スカイ)', '衣岩\1'),
      (86, 'ja', false, 'seoul-chuncheon-one-day-bukhan%', '붕어섬や하중도', 'プンオ島（붕어섬）や中島（하중도）')
    ) as v(idx, lang, is_regex, slug_like, pat, rep)
    order by idx
  loop
    update public.guide_articles
    set translations = jsonb_set(
      translations, array[r.lang],
      (case when r.is_regex
            then regexp_replace((translations -> r.lang)::text, r.pat, r.rep, 'g')
            else replace((translations -> r.lang)::text, r.pat, r.rep) end)::jsonb)
    where status = 'published'
      and translations ? r.lang
      and (r.slug_like is null or slug like r.slug_like)
      and (case when r.is_regex then (translations -> r.lang)::text ~ r.pat
                else position(r.pat in (translations -> r.lang)::text) > 0 end);
  end loop;
end
$fix$;

commit;

-- 되돌리기:
-- update public.guide_articles g set translations = b.translations
-- from backup.guide_translations_hangul_20261117 b where b.id = g.id;
