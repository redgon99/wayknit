export const COURSE_TAXONOMY_GROUPS = [
  'region',
  'when',
  'who',
  'theme',
  'style',
  'budget',
  'access',
] as const;

export type CourseTaxonomyGroupId = (typeof COURSE_TAXONOMY_GROUPS)[number];

export type CourseTaxonomyTag = {
  id: string;
  group: CourseTaxonomyGroupId;
  labelKo: string;
  labelEn: string;
  aliases: string[];
};

export const COURSE_TAXONOMY_GROUP_META: Record<
  CourseTaxonomyGroupId,
  { labelKo: string; labelEn: string }
> = {
  region: { labelKo: '여행 지역·명소', labelEn: 'Region & sights' },
  when: { labelKo: '여행 시기·기간', labelEn: 'When & duration' },
  who: { labelKo: '여행자·동행', labelEn: 'Who' },
  theme: { labelKo: '관심사·테마', labelEn: 'Interests' },
  style: { labelKo: '스타일·이동', labelEn: 'Style & getting around' },
  budget: { labelKo: '예산·예약', labelEn: 'Budget & booking' },
  access: { labelKo: '이용 편의', labelEn: 'Access & needs' },
};

export const COURSE_TAXONOMY_TAGS: CourseTaxonomyTag[] = [
  // ① 지역·명소
  { id: 'seoul', group: 'region', labelKo: '서울', labelEn: 'Seoul', aliases: ['서울', '강남', '홍대', '명동', '성수'] },
  { id: 'busan', group: 'region', labelKo: '부산', labelEn: 'Busan', aliases: ['부산', '해운대', '광안리'] },
  { id: 'jeju', group: 'region', labelKo: '제주', labelEn: 'Jeju', aliases: ['제주', '서귀포'] },
  { id: 'incheon', group: 'region', labelKo: '인천', labelEn: 'Incheon', aliases: ['인천'] },
  { id: 'gangneung', group: 'region', labelKo: '강릉', labelEn: 'Gangneung', aliases: ['강릉', '경포', '안목'] },
  { id: 'sokcho', group: 'region', labelKo: '속초', labelEn: 'Sokcho', aliases: ['속초', '설악', '고성'] },
  { id: 'chuncheon', group: 'region', labelKo: '춘천', labelEn: 'Chuncheon', aliases: ['춘천', '소양강'] },
  { id: 'gyeongju', group: 'region', labelKo: '경주', labelEn: 'Gyeongju', aliases: ['경주', '대릉원', '첨성대'] },
  { id: 'jeonju', group: 'region', labelKo: '전주', labelEn: 'Jeonju', aliases: ['전주', '한옥마을'] },
  { id: 'yeosu', group: 'region', labelKo: '여수', labelEn: 'Yeosu', aliases: ['여수'] },
  { id: 'tongyeong', group: 'region', labelKo: '통영', labelEn: 'Tongyeong', aliases: ['통영'] },
  { id: 'chungju', group: 'region', labelKo: '충주', labelEn: 'Chungju', aliases: ['충주', '수안보'] },
  { id: 'jecheon', group: 'region', labelKo: '제천', labelEn: 'Jecheon', aliases: ['제천', '의림지', '청풍'] },
  { id: 'donghae', group: 'region', labelKo: '동해', labelEn: 'Donghae', aliases: ['동해', '추암', '묵호'] },
  { id: 'samcheok', group: 'region', labelKo: '삼척', labelEn: 'Samcheok', aliases: ['삼척', '장호', '근덕'] },
  { id: 'landmark', group: 'region', labelKo: '대표 명소', labelEn: 'Must-see', aliases: ['대표 명소', '꼭 가고'] },
  { id: 'hidden', group: 'region', labelKo: '숨은 명소', labelEn: 'Hidden gem', aliases: ['숨은 명소', '로컬 명소'] },
  { id: 'airport-stay', group: 'region', labelKo: '공항·숙소', labelEn: 'Airport & stay', aliases: ['공항', '숙소', '체크인'] },

  // ② 시기·기간
  { id: 'spring', group: 'when', labelKo: '봄', labelEn: 'Spring', aliases: ['봄'] },
  { id: 'summer', group: 'when', labelKo: '여름', labelEn: 'Summer', aliases: ['여름'] },
  { id: 'autumn', group: 'when', labelKo: '가을', labelEn: 'Autumn', aliases: ['가을'] },
  { id: 'winter', group: 'when', labelKo: '겨울', labelEn: 'Winter', aliases: ['겨울'] },
  { id: 'cherry', group: 'when', labelKo: '벚꽃', labelEn: 'Cherry blossom', aliases: ['벚꽃'] },
  { id: 'foliage', group: 'when', labelKo: '단풍', labelEn: 'Fall colors', aliases: ['단풍'] },
  { id: 'daytrip', group: 'when', labelKo: '당일', labelEn: 'Day trip', aliases: ['당일', '하루'] },
  { id: '1n2d', group: 'when', labelKo: '1박 2일', labelEn: '1 night', aliases: ['1박', '1박 2일', '1박2일'] },
  { id: '2n3d', group: 'when', labelKo: '2박 3일', labelEn: '2 nights', aliases: ['2박', '2박 3일', '2박3일'] },
  { id: 'longstay', group: 'when', labelKo: '장기', labelEn: 'Long stay', aliases: ['장기'] },

  // ③ 여행자·동행
  { id: 'solo', group: 'who', labelKo: '혼자', labelEn: 'Solo', aliases: ['혼자', '혼행'] },
  { id: 'couple', group: 'who', labelKo: '커플', labelEn: 'Couple', aliases: ['커플', '데이트'] },
  { id: 'friends', group: 'who', labelKo: '친구', labelEn: 'Friends', aliases: ['친구'] },
  { id: 'family', group: 'who', labelKo: '가족', labelEn: 'Family', aliases: ['가족'] },
  { id: 'group', group: 'who', labelKo: '단체', labelEn: 'Group', aliases: ['단체'] },
  { id: 'first-visit', group: 'who', labelKo: '첫 방문', labelEn: 'First visit', aliases: ['첫 방문', '처음 가는'] },
  { id: 'repeat', group: 'who', labelKo: '재방문', labelEn: 'Return visit', aliases: ['재방문'] },

  // ④ 관심사·테마
  { id: 'first-korea', group: 'theme', labelKo: '한국 첫 여행', labelEn: 'First Korea trip', aliases: ['한국 첫', '첫 한국'] },
  { id: 'kpop', group: 'theme', labelKo: 'K-POP', labelEn: 'K-POP', aliases: ['k-pop', 'kpop', '케이팝', '아이돌'] },
  { id: 'kfood', group: 'theme', labelKo: 'K-푸드', labelEn: 'K-food', aliases: ['k-푸드', '미식', '맛집', '한식'] },
  { id: 'cafe', group: 'theme', labelKo: '카페', labelEn: 'Cafés', aliases: ['카페', '디저트', '커피'] },
  { id: 'heritage', group: 'theme', labelKo: '전통문화', labelEn: 'Heritage', aliases: ['전통', '역사', '한복', '궁궐', '사찰'] },
  { id: 'beauty-shop', group: 'theme', labelKo: 'K-뷰티·쇼핑', labelEn: 'K-beauty & shopping', aliases: ['뷰티', '패션', '쇼핑', '면세'] },
  { id: 'nature', group: 'theme', labelKo: '자연', labelEn: 'Nature', aliases: ['자연', '풍경', '바다', '해변', '숲'] },
  { id: 'wellness', group: 'theme', labelKo: '휴식', labelEn: 'Wellness', aliases: ['휴식', '웰니스', '스파'] },
  { id: 'activity', group: 'theme', labelKo: '액티비티', labelEn: 'Activities', aliases: ['액티비티', '레저', '스포츠'] },
  { id: 'festival', group: 'theme', labelKo: '축제·야경', labelEn: 'Festivals & night', aliases: ['축제', '공연', '야경', '야시장'] },
  { id: 'local', group: 'theme', labelKo: '로컬 일상', labelEn: 'Local life', aliases: ['로컬', '일상', '사진'] },
  { id: 'dmz', group: 'theme', labelKo: '현대사·DMZ', labelEn: 'DMZ & modern history', aliases: ['dmz', '현대사'] },

  // ⑤ 스타일·이동
  { id: 'transit', group: 'style', labelKo: '대중교통', labelEn: 'Transit', aliases: ['대중교통', '지하철', '버스'] },
  { id: 'rental', group: 'style', labelKo: '렌터카', labelEn: 'Rental car', aliases: ['렌터카', '자가용', '드라이브'] },
  { id: 'slow', group: 'style', labelKo: '여유롭게', labelEn: 'Slow', aliases: ['여유', '천천히'] },
  { id: 'packed', group: 'style', labelKo: '많이 둘러보기', labelEn: 'See more', aliases: ['많이 둘러', '알차게'] },
  { id: 'indoor', group: 'style', labelKo: '실내', labelEn: 'Indoor', aliases: ['실내'] },
  { id: 'outdoor', group: 'style', labelKo: '실외', labelEn: 'Outdoor', aliases: ['실외', '야외'] },
  { id: 'rainy', group: 'style', labelKo: '우천 대체', labelEn: 'Rain plan', aliases: ['우천', '비 오는'] },

  // ⑥ 예산·예약
  { id: 'value', group: 'budget', labelKo: '실속', labelEn: 'Value', aliases: ['실속', '가성비'] },
  { id: 'standard', group: 'budget', labelKo: '일반', labelEn: 'Standard', aliases: ['일반'] },
  { id: 'premium', group: 'budget', labelKo: '프리미엄', labelEn: 'Premium', aliases: ['프리미엄', '럭셔리'] },
  { id: 'no-booking', group: 'budget', labelKo: '예약 없이', labelEn: 'No booking', aliases: ['예약 없이', '예약없이'] },
  { id: 'prebook', group: 'budget', labelKo: '사전예약', labelEn: 'Pre-book', aliases: ['사전예약', '예약 필수'] },

  // ⑦ 편의
  { id: 'en-guide', group: 'access', labelKo: '외국어 안내', labelEn: 'English / foreign language', aliases: ['영어', '외국어 안내'] },
  { id: 'veg', group: 'access', labelKo: '채식', labelEn: 'Vegetarian', aliases: ['채식', '비건'] },
  { id: 'halal', group: 'access', labelKo: '할랄', labelEn: 'Halal', aliases: ['할랄'] },
  { id: 'allergy', group: 'access', labelKo: '알레르기', labelEn: 'Allergy-aware', aliases: ['알레르기'] },
  { id: 'wheelchair', group: 'access', labelKo: '휠체어', labelEn: 'Wheelchair', aliases: ['휠체어'] },
  { id: 'stroller', group: 'access', labelKo: '유모차', labelEn: 'Stroller', aliases: ['유모차'] },
  { id: 'few-stairs', group: 'access', labelKo: '계단 적음', labelEn: 'Few stairs', aliases: ['계단 적'] },
];

const TAG_BY_ID = new Map(COURSE_TAXONOMY_TAGS.map((t) => [t.id, t]));
const TAG_BY_ALIAS = new Map<string, CourseTaxonomyTag>();
for (const tag of COURSE_TAXONOMY_TAGS) {
  TAG_BY_ID.set(tag.id, tag);
  TAG_BY_ALIAS.set(tag.id.toLowerCase(), tag);
  TAG_BY_ALIAS.set(tag.labelKo.toLowerCase(), tag);
  for (const a of tag.aliases) TAG_BY_ALIAS.set(a.toLowerCase(), tag);
}

export function getCourseTaxonomyTag(id: string): CourseTaxonomyTag | undefined {
  return TAG_BY_ID.get(id);
}

export function tagsForGroup(group: CourseTaxonomyGroupId): CourseTaxonomyTag[] {
  return COURSE_TAXONOMY_TAGS.filter((t) => t.group === group);
}

export function resolveCourseTag(raw: string): CourseTaxonomyTag | undefined {
  const key = raw.trim().toLowerCase();
  if (!key) return undefined;
  return TAG_BY_ID.get(raw) ?? TAG_BY_ALIAS.get(key);
}

export function courseTagLabel(raw: string, locale: string): string {
  const tag = resolveCourseTag(raw);
  if (!tag) return raw;
  return locale.toLowerCase().startsWith('en') ? tag.labelEn : tag.labelKo;
}

export function displayCourseTags(rawTags: string[], locale: string, limit = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const order = COURSE_TAXONOMY_GROUPS;
  const resolved = rawTags
    .map((raw) => ({ raw, tag: resolveCourseTag(raw) }))
    .sort((a, b) => {
      const ai = a.tag ? order.indexOf(a.tag.group) : 99;
      const bi = b.tag ? order.indexOf(b.tag.group) : 99;
      return ai - bi;
    });
  for (const item of resolved) {
    const label = item.tag
      ? locale.toLowerCase().startsWith('en')
        ? item.tag.labelEn
        : item.tag.labelKo
      : item.raw;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

function haystackOf(parts: string[]): string {
  return parts.filter(Boolean).join(' \n ').toLowerCase();
}

export function inferCourseTaxonomyTags(parts: string[], max = 8): string[] {
  const hay = haystackOf(parts);
  const found: CourseTaxonomyTag[] = [];
  for (const tag of COURSE_TAXONOMY_TAGS) {
    const keys = [tag.id, tag.labelKo, ...tag.aliases];
    if (keys.some((k) => k.length >= 2 && hay.includes(k.toLowerCase()))) {
      found.push(tag);
    }
  }
  const byGroup = new Map<CourseTaxonomyGroupId, CourseTaxonomyTag[]>();
  for (const tag of found) {
    const list = byGroup.get(tag.group) ?? [];
    list.push(tag);
    byGroup.set(tag.group, list);
  }
  const out: string[] = [];
  for (const group of COURSE_TAXONOMY_GROUPS) {
    const list = byGroup.get(group) ?? [];
    const cap = group === 'region' || group === 'theme' ? 3 : 2;
    for (const tag of list.slice(0, cap)) {
      if (!out.includes(tag.id)) out.push(tag.id);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function guideMatchesCourseFilters(
  tags: string[],
  title: string,
  summary: string,
  selectedIds: string[]
): boolean {
  if (selectedIds.length === 0) return true;
  const hay = haystackOf([...tags, title, summary]);
  const grouped = new Map<CourseTaxonomyGroupId, string[]>();
  for (const id of selectedIds) {
    const tag = TAG_BY_ID.get(id);
    if (!tag) continue;
    const list = grouped.get(tag.group) ?? [];
    list.push(id);
    grouped.set(tag.group, list);
  }
  for (const ids of grouped.values()) {
    const ok = ids.some((id) => {
      const tag = TAG_BY_ID.get(id);
      if (!tag) return false;
      if (tags.includes(tag.id) || tags.includes(tag.labelKo)) return true;
      return [tag.id, tag.labelKo, ...tag.aliases].some(
        (k) => k.length >= 2 && hay.includes(k.toLowerCase())
      );
    });
    if (!ok) return false;
  }
  return true;
}

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function splitTopicTags(tags: string[]): { selected: string[]; extra: string[] } {
  const selected: string[] = [];
  const extra: string[] = [];
  for (const raw of tags) {
    const tag = resolveCourseTag(raw);
    if (tag) {
      if (!selected.includes(tag.id)) selected.push(tag.id);
    } else if (raw.trim()) {
      extra.push(raw.trim());
    }
  }
  return { selected, extra };
}

export function mergeTopicTags(selected: string[], extra: string[]): string[] {
  const out = [...selected];
  for (const e of extra) {
    const t = e.trim();
    if (!t) continue;
    if (resolveCourseTag(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}
